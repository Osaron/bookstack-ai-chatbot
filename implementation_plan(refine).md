# BookStack AI Chatbot — Improvement Plan

## Problem Analysis

Looking at your screenshots, the issue is clear:

- ✅ **"Tell me where to find documents about Hub and Cube"** → Works (finds pages with those keywords)
- ❌ **"What are the sections in the Cube documentation?"** → Fails (can't answer structural questions)

### Current Limitations in `server.js`

| # | Limitation | Impact |
|---|-----------|--------|
| 1 | **Only processes `page` results** (line 109) — ignores `book`, `chapter` types | Can't answer "what's in this book?" |
| 2 | **Only fetches 2000 chars** per page (line 114) | Misses content in longer pages |
| 3 | **No book/chapter structure** — never fetches the table of contents | Can't describe book organization |
| 4 | **Raw user question as search query** | "What are the sections?" doesn't search well |
| 5 | **No fallback** when search returns few/no results | Gives up instead of trying harder |

## Proposed Changes

### [MODIFY] `chatbot/server.js`

#### Fix 1: Add Book & Chapter API Functions
```js
// NEW: Fetch a book's full structure (chapters + pages)
async function getBook(id) { ... }       // Returns book with chapters list
async function getChapter(id) { ... }    // Returns chapter with pages list
```

#### Fix 2: Process ALL Search Result Types (not just pages)
Currently line 109 skips books and chapters. We'll handle all types:
- **`page`** → fetch page content (existing)
- **`book`** → fetch book structure (chapters + page titles)
- **`chapter`** → fetch chapter with its pages

#### Fix 3: Smart Query Detection
Detect what the user is asking about and adjust the search strategy:
- **Structural questions** ("what sections", "table of contents", "what's in") → fetch book/chapter structure
- **Content questions** ("how do I", "what is", "explain") → search pages for content
- **Navigation questions** ("where can I find") → broad search across all types

#### Fix 4: Increase Context Per Page (2000 → 4000 chars)
More content = better answers. GPT-4o can handle it.

#### Fix 5: Multi-Query Search
If the first search returns < 3 results, try:
1. Extract keywords from the user question
2. Search again with simplified keywords
3. Merge results

#### Fix 6: Book Structure Endpoint
New API endpoint `GET /api/books/:id/structure` that returns the full table of contents for a book.

---

## How It Would Work After Improvements

**User asks:** "What are the sections in the Cube documentation?"

1. Detects this is a **structural question** about "Cube"
2. Searches for "Cube" → finds the book
3. Fetches the book's **chapters and page list**
4. Sends the structure as context to GPT-4o
5. GPT-4o explains the book's organization with links

## Verification Plan

### Automated Tests
- Rebuild with `docker compose up --build chatbot -d`
- Test: "What are the sections in the Cube documentation?" → should list chapters
- Test: "How do I update a customer account?" → should find relevant pages
- Test: "What books do we have about the portal?" → should list books
