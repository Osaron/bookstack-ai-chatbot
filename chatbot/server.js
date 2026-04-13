import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Config ---
const PORT = process.env.PORT || 3000;
const BOOKSTACK_BASE_URL = (process.env.BOOKSTACK_BASE_URL || '').replace(/\/+$/, '');
const BOOKSTACK_TOKEN_ID = process.env.BOOKSTACK_TOKEN_ID || '';
const BOOKSTACK_TOKEN_SECRET = process.env.BOOKSTACK_TOKEN_SECRET || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

if (!BOOKSTACK_BASE_URL || !BOOKSTACK_TOKEN_ID || !BOOKSTACK_TOKEN_SECRET) {
  console.error('ERROR: Missing BookStack config. Set BOOKSTACK_BASE_URL, BOOKSTACK_TOKEN_ID, BOOKSTACK_TOKEN_SECRET');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error('ERROR: Missing OPENAI_API_KEY');
  process.exit(1);
}

// --- BookStack API ---
const bookstackApi = axios.create({
  baseURL: `${BOOKSTACK_BASE_URL}/api`,
  headers: {
    'Authorization': `Token ${BOOKSTACK_TOKEN_ID}:${BOOKSTACK_TOKEN_SECRET}`,
    'Content-Type': 'application/json'
  }
});

async function searchBookStack(query, count = 10) {
  try {
    const res = await bookstackApi.get('/search', { params: { query, count } });
    return res.data.data || [];
  } catch (err) {
    console.error('BookStack search error:', err.message);
    // Surface connection failures with a typed error so the caller can report them
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || (err.response && err.response.status >= 500)) {
      const e = new Error('Cannot reach the BookStack server');
      e.type = 'bookstack_error';
      throw e;
    }
    return [];
  }
}

async function getPage(id) {
  try {
    const res = await bookstackApi.get(`/pages/${id}`);
    return res.data;
  } catch (err) {
    console.error(`BookStack page ${id} error:`, err.message);
    return null;
  }
}

async function getBook(id) {
  try {
    const res = await bookstackApi.get(`/books/${id}`);
    return res.data;
  } catch (err) {
    console.error(`BookStack book ${id} error:`, err.message);
    return null;
  }
}

async function getChapter(id) {
  try {
    const res = await bookstackApi.get(`/chapters/${id}`);
    return res.data;
  } catch (err) {
    console.error(`BookStack chapter ${id} error:`, err.message);
    return null;
  }
}

async function getBookSlug(bookId) {
  try {
    const res = await bookstackApi.get(`/books/${bookId}`);
    return res.data.slug || String(bookId);
  } catch { return String(bookId); }
}

async function getBooks() {
  try {
    const res = await bookstackApi.get('/books', { params: { count: 100 } });
    return res.data.data || [];
  } catch (err) {
    console.error('BookStack books error:', err.message);
    return [];
  }
}

async function getShelves() {
  try {
    const res = await bookstackApi.get('/shelves', { params: { count: 100 } });
    return res.data.data || [];
  } catch (err) {
    console.error('BookStack shelves error:', err.message);
    return [];
  }
}

// Extract keywords from a sentence for better search fallback
function extractKeywords(text) {
  const stopwords = new Set(['what', 'are', 'the', 'in', 'how', 'to', 'do', 'i', 'can', 'you', 'find', 'where', 'is', 'a', 'an', 'of', 'for', 'about', 'and', 'or', 'with', 'on', 'at', 'from', 'by']);
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopwords.has(word))
    .join(' ');
}

// --- OpenAI ---
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// --- Express ---
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Expose config to frontend
app.get('/api/config', (req, res) => {
  res.json({ bookstackUrl: BOOKSTACK_BASE_URL });
});

// List books
app.get('/api/books', async (req, res) => {
  try {
    const books = await getBooks();
    res.json(books.map(b => ({ id: b.id, name: b.name, slug: b.slug, description: b.description })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// List shelves
app.get('/api/shelves', async (req, res) => {
  try {
    const shelves = await getShelves();
    res.json(shelves.map(s => ({ id: s.id, name: s.name, slug: s.slug, description: s.description })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Direct fetch for Cube structure
app.get('/api/cube-sections', async (req, res) => {
  try {
    // Attempting to find the "Cube" book to get its chapters as sections
    const searchRes = await searchBookStack('Cube', 5);
    const cubeBook = searchRes.find(r => r.type === 'book' && r.name.toLowerCase().includes('cube'));
    if (cubeBook) {
      const bookDetails = await getBook(cubeBook.id);
      const sections = (bookDetails.contents || [])
        .filter(c => c.type === 'chapter' || c.type === 'page')
        .map(c => c.name);
      return res.json({ sections });
    }
    res.json({ sections: ["Getting started with the Cube", "Cube - Functional Documentation", "Cube - Technical Documentation", "Cube - Release Notes"] });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// Chat endpoint with SSE streaming
app.post('/api/chat', async (req, res) => {
  const { message, history = [], isSystemCommand = false } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    res.write(`data: ${JSON.stringify({ type: 'status', content: 'Searching documentation...' })}\n\n`);
    
    // Multi-query strategy
    let searchResults = await searchBookStack(message, 10);
    if (searchResults.length < 3 && !isSystemCommand) {
      const keywords = extractKeywords(message);
      if (keywords && keywords !== message.toLowerCase()) {
        const fallbackResults = await searchBookStack(keywords, 10);
        // Merge results avoiding duplicates
        const existingIds = new Set(searchResults.map(r => r.id + '-' + r.type));
        for (const item of fallbackResults) {
          if (!existingIds.has(item.id + '-' + item.type)) {
            searchResults.push(item);
          }
        }
      }
    }

    const sources = [];
    const contextParts = [];
    let contextSize = 0;
    const MAX_CONTEXT_SIZE = 15000; // soft limit on characters

    // Process top results, now including books and chapters
    for (const result of searchResults.slice(0, 6)) { // process top 6
      if (contextSize > MAX_CONTEXT_SIZE) break;

      if (result.type === 'page' && result.id) {
        const page = await getPage(result.id);
        if (page) {
          const bookSlug = await getBookSlug(page.book_id);
          const url = `${BOOKSTACK_BASE_URL}/books/${bookSlug}/page/${page.slug}`;
          const text = (page.markdown || page.text || '').substring(0, 4000); // Increased content
          
          sources.push({
            id: page.id,
            name: `Page: ${page.name}`,
            url,
            preview: text.substring(0, 150).replace(/\n/g, ' ') + '...'
          });
          const part = `--- Page: "${page.name}" ---\nURL: ${url}\n${text}\n\n`;
          contextParts.push(part);
          contextSize += part.length;
        }
      } 
      else if (result.type === 'book' && result.id) {
        const book = await getBook(result.id);
        if (book) {
          const url = `${BOOKSTACK_BASE_URL}/books/${book.slug}`;
          
          // Build Table of Contents for the book
          let toc = `Book Description: ${book.description || 'N/A'}\n\nStructure:\n`;
          if (book.contents && Array.isArray(book.contents)) {
            book.contents.forEach(item => {
              toc += `- [${item.type}] ${item.name} (url: ${item.url})\n`;
            });
          }

          sources.push({
            id: book.id,
            name: `Book: ${book.name}`,
            url,
            preview: book.description ? book.description.substring(0, 150) + '...' : 'Book structure and contents.'
          });
          const part = `--- Book Table of Contents: "${book.name}" ---\nURL: ${url}\n${toc}\n\n`;
          contextParts.push(part);
          contextSize += part.length;
        }
      }
      else if (result.type === 'chapter' && result.id) {
        const chapter = await getChapter(result.id);
        if (chapter) {
          const bookSlug = await getBookSlug(chapter.book_id);
          const url = `${BOOKSTACK_BASE_URL}/books/${bookSlug}/chapter/${chapter.slug}`;
          
          let toc = `Chapter Description: ${chapter.description || 'N/A'}\n\nPages in this chapter:\n`;
          if (chapter.pages && Array.isArray(chapter.pages)) {
            chapter.pages.forEach(item => {
              toc += `- [page] ${item.name} (url: ${item.url})\n`;
            });
          }

          sources.push({
            id: chapter.id,
            name: `Chapter: ${chapter.name}`,
            url,
            preview: chapter.description ? chapter.description.substring(0, 150) + '...' : 'Chapter structure and pages.'
          });
          const part = `--- Chapter Table of Contents: "${chapter.name}" ---\nURL: ${url}\n${toc}\n\n`;
          contextParts.push(part);
          contextSize += part.length;
        }
      }
    }

    if (sources.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'sources', content: sources })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'status', content: 'Generating answer...' })}\n\n`);

    // 3. Build prompt
    let contextBlock = contextParts.length > 0
      ? `Here is relevant documentation from BookStack:\n\n${contextParts.join('\n')}`
      : 'No relevant documentation was found. Answer based on general knowledge and let the user know.';
      
    if (isSystemCommand && contextParts.length === 0) {
      contextBlock = "Provide a general summary or overview based on typical system knowledge.";
    }

    const systemPrompt = `You are a helpful UI Assistant for Zters employees specifically tasked with retrieving documentation from the BookStack knowledge base at ${BOOKSTACK_BASE_URL}.
Answer questions primarily using the provided documentation context. Note that you are querying 'BookStack' which contains details about 'Zters' systems, such as Cube, Hub, portals, and various business logic.

Rules:
- Give thorough and accurate answers based on the documentation context.
- If the docs don't have the answer, say so clearly. Do not hallucinate specifics about Zters systems.
- Use the Table of Contents structures if the user asks about the organization, sections, or "what is in" a specific book.
- Reference page/book names when citing info.
- Provide provided URLs when pointing users to specific resources.
- Use clean formatting, prioritize short bullet points.

${contextBlock}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    // 4. Stream OpenAI response
    const stream = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
      stream: true,
      temperature: 0.3,
      max_tokens: 2000
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Chat error:', err);

    // Classify the error for the frontend
    let errorType = 'error';
    let errorMsg  = err.message;

    if (err.type === 'bookstack_error') {
      errorType = 'bookstack_error';
      errorMsg  = 'Cannot reach the BookStack server.';
    } else if (
      err?.status === 429 ||
      err?.error?.type === 'insufficient_quota' ||
      (err.message && (err.message.includes('quota') || err.message.includes('rate limit') || err.message.includes('insufficient_quota') || err.message.includes('429')))
    ) {
      errorType = 'quota_error';
      errorMsg  = 'OpenAI token quota exceeded.';
    } else if (
      err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT'
    ) {
      errorType = 'bookstack_error';
      errorMsg  = 'Cannot reach the BookStack server.';
    }

    res.write(`data: ${JSON.stringify({ type: errorType, content: errorMsg })}\n\n`);
    res.end();
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🤖 Zters AI Chatbot`);
  console.log(`   Server:    http://localhost:${PORT}`);
  console.log(`   BookStack: ${BOOKSTACK_BASE_URL}`);
  console.log(`   Model:     ${OPENAI_MODEL}\n`);
});
