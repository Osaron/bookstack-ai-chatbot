const form = document.getElementById('chat-form');
const input = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesWrapper = document.getElementById('messages-wrapper');
const welcomeScreen = document.getElementById('welcome-screen');
const sourcesPanel = document.getElementById('sources-panel');
const sourcesList = document.getElementById('sources-list');
const closeSourcesBtn = document.getElementById('close-sources');

// Sidebar Elements
const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menu-btn');
const shelvesBtn = document.getElementById('shelves-btn');
const shelvesList = document.getElementById('shelves-list');
const exploreBtn = document.getElementById('explore-btn');
const cubeBtn = document.getElementById('cube-btn');
const cubeList = document.getElementById('cube-list');
const settingsBtn = document.getElementById('settings-btn');

// Settings Items
const themeCheckbox = document.getElementById('theme-checkbox');
const langCheckbox = document.getElementById('lang-checkbox');
const homeLinkBtn = document.getElementById('home-link-btn');

let chatHistory = [];
let currentSources = [];
let shelvesLoaded = false;
let cubeSectionsLoaded = false;
let bookstackBaseUrl = '';
let isPinned = false;

// Initialize marked options
marked.setOptions({ breaks: true, gfm: true });

// Load Config
async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        bookstackBaseUrl = data.bookstackUrl;
    } catch(e) { console.error('Failed to load config'); }
}
loadConfig();

// ── Theme: respect OS/browser preference on first load ──────────────────
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(dark) {
    if (dark) {
        document.body.classList.remove('light-theme');
        themeCheckbox.checked = true;
    } else {
        document.body.classList.add('light-theme');
        themeCheckbox.checked = false;
    }
}

// Apply immediately on load
applyTheme(prefersDark.matches);

// Follow live system changes (e.g. macOS auto switch)
prefersDark.addEventListener('change', (e) => applyTheme(e.matches));

// Manual toggle still works and overrides for the session
themeCheckbox.addEventListener('change', (e) => {
    applyTheme(e.target.checked);
});

langCheckbox.addEventListener('change', (e) => {
    const isES = e.target.checked;
    const msg = isES ? '<em>Sistema Interno: Idioma cambiado a Español.</em>' : '<em>Internal System: Language switched to English.</em>';
    e.target.parentElement.previousElementSibling.innerHTML = isES ? '<i class="fa-solid fa-language"></i> Español' : '<i class="fa-solid fa-language"></i> English';
    appendMessage('bot', msg, true);
});

homeLinkBtn.addEventListener('click', () => {
    if (bookstackBaseUrl) {
        window.open(bookstackBaseUrl, '_blank');
    }
});

// Sidebar Expansion Logic (Hover over anywhere entirely opens it, clicking pins it)
sidebar.addEventListener('mouseenter', () => {
    if (isPinned) return; // Prevent unnecessary class changes if pinned
    sidebar.classList.add('expanded');
    fetchShelves();
    fetchCubeSections();
});

menuBtn.addEventListener('click', () => {
    isPinned = !isPinned;
    if (isPinned) {
        sidebar.classList.add('expanded');
    } else {
        sidebar.classList.remove('expanded');
    }
});

sidebar.addEventListener('mouseleave', () => {
    if (!isPinned) {
        sidebar.classList.remove('expanded');
    }
});

// Keep existing message logic
function appendMessage(role, content, html = false) {
    if (welcomeScreen.style.display !== 'none') {
        welcomeScreen.style.display = 'none';
    }
    const div = document.createElement('div');
    div.className = `message ${role}`;
    if (html) { div.innerHTML = content; } else { div.textContent = content; }
    messagesWrapper.appendChild(div);
    scrollToBottom();
    return div;
}

// Styled error alert cards
function appendErrorCard(type) {
    if (welcomeScreen.style.display !== 'none') {
        welcomeScreen.style.display = 'none';
    }

    let variant, icon, title, desc;

    if (type === 'quota_error') {
        variant = 'quota';
        icon    = '⚠️';
        title   = 'AI Token Quota Reached';
        desc    = 'The OpenAI token quota for this account has been exhausted. Please contact your Zters IT administrator to top up the API credits.';
    } else if (type === 'auth_error') {
        variant = 'auth';
        icon    = '🔑';
        title   = 'BookStack API Token Expired';
        desc    = 'The API token used to authenticate with the Zters knowledge base has expired or is no longer valid. Please contact your Zters IT administrator to generate a new token.';
    } else if (type === 'bookstack_error') {
        variant = 'connection';
        icon    = '🔌';
        title   = 'Cannot Connect to BookStack';
        desc    = 'The assistant is unable to reach the Zters knowledge base. Please check your <strong>Zters VPN connection</strong> and try again.';
    } else {
        variant = 'generic';
        icon    = '❌';
        title   = 'Something went wrong';
        desc    = 'An unexpected error occurred. Please try again or contact Zters IT support if the problem persists.';
    }

    const card = document.createElement('div');
    card.className = `error-card ${variant}`;
    card.innerHTML = `
        <span class="error-icon">${icon}</span>
        <div class="error-body">
            <span class="error-title">${title}</span>
            <span class="error-desc">${desc}</span>
        </div>
    `;
    messagesWrapper.appendChild(card);
    scrollToBottom();
}

function updateStatus(text) {
    let indicator = document.getElementById('current-status');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'current-status';
        indicator.className = 'status-indicator';
        messagesWrapper.appendChild(indicator);
    }
    indicator.innerHTML = `<div class="spinner"></div> ${text}`;
    scrollToBottom();
}

function removeStatus() {
    const indicator = document.getElementById('current-status');
    if (indicator) indicator.remove();
}

function scrollToBottom() {
    messagesWrapper.scrollTop = messagesWrapper.scrollHeight;
}

closeSourcesBtn.addEventListener('click', () => { sourcesPanel.classList.remove('open'); });

function openSourcesPanel(sources) {
    sourcesList.innerHTML = '';
    sources.forEach(source => {
        const card = document.createElement('div');
        card.className = 'source-card';
        card.innerHTML = `
            <a href="${source.url}" target="_blank" rel="noopener noreferrer">
                <i class="fa-solid fa-link"></i> ${source.name}
            </a>
            <p>${source.preview}</p>
        `;
        sourcesList.appendChild(card);
    });
    sourcesPanel.classList.add('open');
}

// Sidebar APIs
async function fetchShelves() {
    if (shelvesLoaded) return;
    try {
        const res = await fetch('/api/shelves');
        const shelves = await res.json();
        shelvesList.innerHTML = '';
        if (shelves.length === 0) {
            shelvesList.innerHTML = '<div class="loading-mini">No shelves found.</div>';
        } else {
            shelves.forEach(s => {
                const item = document.createElement('div');
                item.className = 'shelf-item';
                item.textContent = s.name;
                item.addEventListener('click', () => {
                    handleChatRequest(`Search the BookStack shelf "${s.name}" and give me a summary of what's inside, including links to it if possible.`, false);
                });
                shelvesList.appendChild(item);
            });
        }
        shelvesLoaded = true;
    } catch (e) {
        shelvesList.innerHTML = '<div class="loading-mini">Failed to load shelves</div>';
    }
}

async function fetchCubeSections() {
    if (cubeSectionsLoaded) return;
    try {
        const res = await fetch('/api/cube-sections');
        const data = await res.json();
        cubeList.innerHTML = '';
        if (!data.sections || data.sections.length === 0) {
            cubeList.innerHTML = '<div class="loading-mini">No sections found.</div>';
        } else {
            data.sections.forEach(s => {
                const item = document.createElement('div');
                item.className = 'cube-item';
                item.textContent = s;
                item.addEventListener('click', () => {
                    handleChatRequest(`Retrieve the Cube section "${s}" and summarize its contents for me with links.`, false);
                });
                cubeList.appendChild(item);
            });
        }
        cubeSectionsLoaded = true;
    } catch (e) {
        cubeList.innerHTML = '<div class="loading-mini">Failed to load sections</div>';
    }
}

// Hover Event Listeners for side pane (still active when collapsed)
shelvesBtn.parentElement.addEventListener('mouseenter', fetchShelves);
cubeBtn.parentElement.addEventListener('mouseenter', fetchCubeSections);

// Pre-defined Actions
exploreBtn.addEventListener('click', () => {
    handleChatRequest("Please explore BookStack and provide a general summary of the documentation available for Zters systems.", true);
});

cubeBtn.addEventListener('click', () => {
    handleChatRequest("Please fetch the QuickStart guide and list all the sections for the Cube platform.", true);
});

// Prompt suggestion chips
document.querySelectorAll('.suggestion-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const query = e.target.getAttribute('data-query');
        handleChatRequest(query, false);
    });
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    handleChatRequest(message, false);
});

async function handleChatRequest(message, isSystemCommand = false) {
    appendMessage('user', message);
    input.value = '';
    sendBtn.disabled = true;
    
    chatHistory.push({ role: 'user', content: message });
    
    const botMsgDiv = appendMessage('bot', '', true);
    let fullResponse = '';
    currentSources = [];

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, history: chatHistory.slice(-10), isSystemCommand })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6);
                    if (!dataStr) continue;
                    
                    try {
                        const data = JSON.parse(dataStr);
                        
                        if (data.type === 'status') {
                            updateStatus(data.content);
                        } 
                        else if (data.type === 'sources') {
                            currentSources = data.content;
                        }
                        else if (data.type === 'content') {
                            removeStatus();
                            fullResponse += data.content;
                            botMsgDiv.innerHTML = marked.parse(fullResponse);
                            scrollToBottom();
                        }
                        else if (data.type === 'quota_error' || data.type === 'bookstack_error' || data.type === 'auth_error') {
                            removeStatus();
                            botMsgDiv.remove();
                            appendErrorCard(data.type);
                        }
                        else if (data.type === 'error') {
                            removeStatus();
                            botMsgDiv.remove();
                            appendErrorCard('error');
                        }
                        else if (data.type === 'done') {
                            removeStatus();
                            if (currentSources.length > 0) {
                                const btn = document.createElement('button');
                                btn.className = 'view-sources-btn';
                                btn.innerHTML = '<i class="fa-solid fa-layer-group"></i> View Sources (' + currentSources.length + ')';
                                btn.onclick = () => openSourcesPanel(currentSources);
                                botMsgDiv.appendChild(btn);
                            }
                            chatHistory.push({ role: 'assistant', content: fullResponse });
                        }
                    } catch (err) {
                        console.error('Error parsing SSE:', err, dataStr);
                    }
                }
            }
        }
    } catch (error) {
        removeStatus();
        botMsgDiv.remove();
        appendErrorCard('bookstack_error');
    } finally {
        sendBtn.disabled = false;
        input.focus();
    }
}
