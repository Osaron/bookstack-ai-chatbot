# BookStack AI Chatbot & MCP Server

A full-stack solution to give AI full access to your [BookStack](https://www.bookstackapp.com) documentation. This repository includes two main components:
1. **BookStack AI Chatbot**: A web-based intelligent assistant (using GPT-4o) that searches your BookStack documentation and generates answers complete with citations and source links.
2. **BookStack MCP Server**: A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that exposes BookStack's API natively to MCP-compatible AI clients (like Claude Desktop).

---

## 🤖 1. BookStack AI Chatbot

The easiest way to interact with your BookStack Knowledge Base. It uses a **Retrieval-Augmented Generation (RAG)** pipeline to fetch structural documentation (Books and Chapters) as well as the exact contexts from individual Pages, then streams answers to you using OpenAI's GPT-4o.

### ✨ Features
- **Smart Structural Search**: Fallback indexing capable of searching pages, complete books, and sectioned chapters.
- **Auto-Keyword Fallback**: Intelligent extraction of key search terms if natural language queries do not yield enough primary results.
- **Premium Interface**: A "glassmorphism" dark theme with sidebars for available books, answer streaming, and markdown formatting.
- **Deep Links**: Direct URLs citing the exact BookStack page referenced in the LLM's answer.

### 🚀 Local Deployment via Docker

Everything is fully containerized. You just need Docker installed on your machine.

#### Step 1: Configure Environment Variables
Inside the repository, there is a `chatbot/.env` file. You must provide your BookStack configuration and OpenAI API Key.

```env
# /chatbot/.env

# BookStack Configuration
BOOKSTACK_BASE_URL=https://library.zters.com/
BOOKSTACK_TOKEN_ID=your_bookstack_token_id
BOOKSTACK_TOKEN_SECRET=your_bookstack_token_secret

# OpenAI Configuration
OPENAI_API_KEY=sk-your_openai_api_key
OPENAI_MODEL=gpt-4o

# Server Port
PORT=3000
```
> **Note:** We recommend `gpt-4o` for fast processing and optimal performance with larger context sets.

#### Step 2: Build and Run 
In the root of the project where `docker-compose.yml` is located, run the following command:

```bash
docker compose up --build chatbot -d
```
*The `-d` flag runs it in detached mode so you can continue using your terminal.*

#### Step 3: Access the Chatbot
Open your browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

---

## 🔌 2. BookStack MCP Server

This is the underlying Model Context Protocol (MCP) server if you want to integrate BookStack directly into clients like Claude Desktop instead of using the custom web UI.

### Features
- **17 Read-only Tools & 8 Write Tools** covering complete BookStack API endpoints.
- Embedded URLs and content previews in all responses.
- Write operations disabled by default for maximum safety.

*(For detailed MCP setup with Claude or LibreChat, reference standard MCP integration rules config files)*

---

### Prerequisites
- Node.js (v18 or v20+) — If running manually.
- Docker and Docker Compose — Recommended deployment method.
- An Active OpenAI account with API credits (for the Chatbot).
- API Access enabled on your BookStack instance, with generated Profile API Tokens. 
