# 🤖 Zters BookStack AI Chatbot - FAQ & Strategy Document

This document answers key questions regarding the deployment, security, maintenance, and future integrations of the newly developed BookStack AI Chatbot for the Zters organization.

---

### 1. Can this chat be integrated into another app (e.g., CUBE)? How do we manage its deployment?

**Yes, the chatbot is highly modular and built with integration in mind.** You have two primary approaches for integrating this into CUBE (or any other internal portal):

*   **Approach A: UI Widget (Iframe/Embedded):** You can host the current Docker container centrally on an internal server. Within CUBE, you can simply embed the `localhost:3000` (or its production equivalent) using an `<iframe>` or a sliding side-panel widget that floats over the CUBE interface.
*   **Approach B: Headless Backend (API Integration):** CUBE's developers can build their own native chat UI inside CUBE and simply send HTTP `POST` requests directly to the Chatbot's backend (`/api/chat`). The backend will handle the RAG pipeline (retrieving BookStack context and calling OpenAI) and return the response.

**Deployment Management:**
You should deploy the Docker container on a centralized server (e.g., AWS EC2, ECS, or an internal Linux host) alongside a Reverse Proxy like Nginx. The Docker Compose setup provided makes it easy to orchestrate. If using Approach B, you will need to configure **CORS** in `server.js` to allow the CUBE domain to interact with your API.

---

### 2. What are the security measures for this given that it uses the OpenAI API?

> [!IMPORTANT]
> The most critical rule of AI architecture is maintaining a secure boundary between the client UI and the LLM provider.

*   **Zero Frontend Exposure**: Your OpenAI API key and your BookStack credentials are **never** shipped to the user's browser. They exist strictly as environmental variables (`.env`) locked inside the Docker backend.
*   **Data Privacy**: By default, OpenAI **does not** use data submitted via their enterprise API (unlike consumer ChatGPT) to train their models. Your internal documentation remains your intellectual property.
*   **Current Security Gap (Action Required)**: Currently, anyone who accesses `http://your-server-ip:3000` has access to query BookStack through the bot. Before full production deployment into existing apps like CUBE, you should protect the `/api/chat` route. This is typically done by passing a Zters JWT (JSON Web Token) or SSO cookie from CUBE to verify the user is logged into the Zters network before the backend processes the request.

---

### 3. ⏰ Maintenance Reminder: The BookStack API Key

> [!WARNING]
> Your BookStack API Key (`BOOKSTACK_TOKEN_ID` and `BOOKSTACK_TOKEN_SECRET`) has been configured to expire in exactly **1 Month**. 

When this expires, the AI will lose the ability to fetch context and will start failing to answer queries about Zters systems. 
**Action item:** Open BookStack Admin configuration, generate a permanent service-account API key (or one with a longer lifespan), and update the `.env` file containing the credentials. Remember to run `docker compose restart` after changing `.env` variables!

---

### 4. What else should Developers and Managers know about this tool?

*   **Hallucination Handling & Fallbacks**: The system has a specific "multi-query fallback" algorithm explicitly built into `server.js`. If the AI suspects the initial BookStack keyword search failed, it automatically extracts clearer noun-keywords and tries a secondary search. However, if BookStack lacks documentation on a subject, the AI is instructed to honestly say "I don't know" rather than guess.
*   **Stateless Architecture**: The backend remembers the last 10 messages of *the active session* passing from the browser. However, if a user refreshes their browser, the history resets. There is no database storing user chat logs.
*   **Operating Costs**: Generative AI via API incurs costs per token. Using GPT-4o with extensive RAG (Retrieval-Augmented Generation) uses thousands of tokens per query securely fed from your BookStack pages. Managers should monitor the OpenAI billing dashboard to ensure usage scales appropriately with internal adoption.
*   **Documentation formatting**: The AI extracts markdown directly from BookStack. The better your BookStack pages are formatted (with clear `H1/H2` tags, bullet points, and clean tables), the more accurate the AI's answers will be!
