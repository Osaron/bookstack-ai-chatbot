// === State ===
const state = {
  history: [],
  isStreaming: false
};

// === DOM Elements ===
const messagesContainer = document.getElementById('messages-container');
const welcomeScreen = document.getElementById('welcome-screen');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const clearChat = document.getElementById('clear-chat');
const booksList = document.getElementById('books-list');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  loadBooks();
  setupEventListeners();
});

function setupEventListeners() {
  // Send message
  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Enable/disable send button
  messageInput.addEventListener('input', () => {
    sendButton.disabled = !messageInput.value.trim() || state.isStreaming;
    autoResize();
  });

  // Clear chat
  clearChat.addEventListener('click', () => {
    state.history = [];
    messagesContainer.innerHTML = '';
    messagesContainer.appendChild(createWelcomeScreen());
    messageInput.focus();
  });

  // Sidebar toggle (mobile)
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // Close sidebar on outside click (mobile)
  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        !menuToggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });

  // Suggestion chips
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('suggestion-chip')) {
      messageInput.value = e.target.dataset.query;
      sendMessage();
    }
  });
}

function autoResize() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
}

// === Load Books ===
async function loadBooks() {
  try {
    const res = await fetch('/api/books');
    const books = await res.json();

    if (books.length === 0) {
      booksList.innerHTML = '<div class="loading-books">No books found</div>';
      return;
    }

    booksList.innerHTML = books.map(book =>
      `<div class="book-item" title="${escapeHtml(book.description || '')}">${escapeHtml(book.name)}</div>`
    ).join('');
  } catch (err) {
    booksList.innerHTML = '<div class="loading-books">Failed to load books</div>';
    updateConnectionStatus(false);
  }
}

// === Send Message ===
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || state.isStreaming) return;

  // Hide welcome screen
  if (welcomeScreen) welcomeScreen.remove();

  // Add user message
  addMessage('user', text);
  state.history.push({ role: 'user', content: text });

  // Clear input
  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendButton.disabled = true;
  state.isStreaming = true;

  // Show status
  const statusEl = addStatus('Connecting...');

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: state.history.slice(-6)
      })
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let assistantContent = '';
    let contentEl = null;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        let data;
        try { data = JSON.parse(line.slice(6)); }
        catch { continue; }

        switch (data.type) {
          case 'status':
            updateStatus(statusEl, data.content);
            break;

          case 'sources':
            removeStatus(statusEl);
            addSources(data.content);
            break;

          case 'content':
            if (!contentEl) {
              removeStatus(statusEl);
              contentEl = addMessage('assistant', '');
            }
            assistantContent += data.content;
            renderMarkdown(contentEl, assistantContent);
            scrollToBottom();
            break;

          case 'error':
            removeStatus(statusEl);
            addError(data.content);
            break;

          case 'done':
            if (assistantContent) {
              state.history.push({ role: 'assistant', content: assistantContent });
            }
            break;
        }
      }
    }
  } catch (err) {
    removeStatus(statusEl);
    addError(err.message);
  } finally {
    state.isStreaming = false;
    sendButton.disabled = !messageInput.value.trim();
    messageInput.focus();
  }
}

// === UI Helpers ===
function addMessage(role, content) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? '👤' : '🤖';

  const bubble = document.createElement('div');
  bubble.className = 'message-content';

  if (role === 'user') {
    bubble.textContent = content;
  } else {
    renderMarkdown(bubble, content);
  }

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  messagesContainer.appendChild(wrapper);
  scrollToBottom();

  return bubble;
}

function addSources(sources) {
  const container = document.createElement('div');
  container.className = 'sources-container';

  const label = document.createElement('div');
  label.className = 'sources-label';
  label.textContent = `${sources.length} Sources Found`;

  const grid = document.createElement('div');
  grid.className = 'sources-grid';

  sources.forEach(source => {
    const card = document.createElement('a');
    card.className = 'source-card';
    card.href = source.url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.innerHTML = `<span>${escapeHtml(source.name)}</span>`;
    grid.appendChild(card);
  });

  container.appendChild(label);
  container.appendChild(grid);
  messagesContainer.appendChild(container);
  scrollToBottom();
}

function addStatus(text) {
  const el = document.createElement('div');
  el.className = 'status-message';
  el.innerHTML = `
    <div class="typing-dots"><span></span><span></span><span></span></div>
    <span>${escapeHtml(text)}</span>
  `;
  messagesContainer.appendChild(el);
  scrollToBottom();
  return el;
}

function updateStatus(el, text) {
  if (el) {
    const span = el.querySelector('span:last-child');
    if (span) span.textContent = text;
  }
}

function removeStatus(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function addError(msg) {
  const el = document.createElement('div');
  el.className = 'error-message';
  el.textContent = `❌ Error: ${msg}`;
  messagesContainer.appendChild(el);
  scrollToBottom();
}

function renderMarkdown(el, content) {
  if (typeof marked !== 'undefined') {
    el.innerHTML = marked.parse(content || '', { breaks: true });
  } else {
    el.textContent = content;
  }
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

function updateConnectionStatus(connected) {
  const statusEl = document.getElementById('connection-status');
  if (statusEl) {
    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('span:last-child');
    if (dot) dot.style.background = connected ? 'var(--success)' : 'var(--error)';
    if (text) text.textContent = connected ? 'Connected to BookStack' : 'Connection error';
  }
}

function createWelcomeScreen() {
  const el = document.createElement('div');
  el.className = 'welcome-screen';
  el.id = 'welcome-screen';
  el.innerHTML = `
    <div class="welcome-icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
        <circle cx="12" cy="10" r="2"/><path d="M12 12v3"/>
      </svg>
    </div>
    <h2>Welcome to BookStack AI</h2>
    <p>I can search your documentation and answer questions. Try asking:</p>
    <div class="suggestion-chips">
      <button class="suggestion-chip" data-query="What documentation do we have?">📚 What docs do we have?</button>
      <button class="suggestion-chip" data-query="Show me the most important pages">⭐ Most important pages</button>
      <button class="suggestion-chip" data-query="How do I get started?">🚀 How do I get started?</button>
    </div>
  `;
  return el;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
