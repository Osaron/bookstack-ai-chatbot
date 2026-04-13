# UnitTest — BookStack AI Chatbot

This folder contains the automated unit tests for the **BookStack AI Chatbot** (`chatbot/`). The tests focus specifically on the error-detection and error-classification logic that determines which alert card a user sees when something goes wrong.

---

## 🧪 What Is Being Tested

The chatbot surfaces three distinct user-facing error conditions — each rendered as a styled alert card in the chat interface. These tests verify the logic that detects and classifies each condition **without making any real network calls**.

### Test Files

| File | What it tests |
|---|---|
| `connectivity.test.js` | `checkBookStackConnectivity()` — pre-flight BookStack health check |
| `errorClassification.test.js` | `classifyServerError()` — maps caught errors to the correct SSE event type |

---

### `connectivity.test.js` (8 tests)

Tests the pre-flight function that runs **before every chat request** to verify BookStack is reachable. A mock API client is injected instead of a real axios instance, so tests are fast and fully offline.

| # | Scenario | Expected Result |
|---|---|---|
| 1 | BookStack returns HTTP 200 | `{ ok: true }` ✅ |
| 2 | BookStack returns HTTP **401** (expired/invalid API token) | `{ ok: false, reason: 'auth' }` 🔑 |
| 3 | BookStack returns HTTP **403** (VPN not connected) | `{ ok: false, reason: 'connection' }` 🔌 |
| 4 | BookStack returns HTTP **500** (server error) | `{ ok: false, reason: 'connection' }` 🔌 |
| 5 | Network error: **ECONNREFUSED** (server unreachable) | `{ ok: false, reason: 'connection' }` 🔌 |
| 6 | Network error: **ETIMEDOUT** (request timed out) | `{ ok: false, reason: 'connection' }` 🔌 |
| 7 | Network error: **ENOTFOUND** (DNS resolution failed) | `{ ok: false, reason: 'connection' }` 🔌 |
| 8 | Unknown/transient error (e.g. HTTP 418) | `{ ok: true }` — avoids false positives ✅ |

---

### `errorClassification.test.js` (10 tests)

Tests the error classifier that runs in the `/api/chat` catch block. It maps server errors to SSE event types, which the frontend uses to render the right alert card.

| # | Scenario | SSE Type | Frontend Card |
|---|---|---|---|
| 1 | OpenAI HTTP 429 status | `quota_error` | ⚠️ Amber — AI Token Quota Reached |
| 2 | Error message includes `insufficient_quota` | `quota_error` | ⚠️ Amber |
| 3 | Error message includes `rate limit` | `quota_error` | ⚠️ Amber |
| 4 | OpenAI error object `{ type: 'insufficient_quota' }` | `quota_error` | ⚠️ Amber |
| 5 | Pre-tagged `bookstack_error` type | `bookstack_error` | 🔌 Red — Cannot Connect / Check VPN |
| 6 | `ECONNREFUSED` network code | `bookstack_error` | 🔌 Red |
| 7 | `ENOTFOUND` network code | `bookstack_error` | 🔌 Red |
| 8 | `ETIMEDOUT` network code | `bookstack_error` | 🔌 Red |
| 9 | Unrecognized error message | `error` | ❌ Red — Generic error |
| 10 | Empty error object `{}` | `error` | ❌ Red — Generic error |

> **Note:** The `auth_error` type (🔑 blue card — API token expired) is produced by the **pre-flight connectivity check** (`connectivity.test.js` test #2) rather than the error classifier, since it's detected before the chat search begins.

---

## 🔧 Running Tests Locally

```bash
# From the repo root
cd UnitTest
npm install
npm test
```

Or with CI-friendly output (no interactive prompts):

```bash
npm run test:ci
```

---

## ⚙️ CI/CD Pipeline Integration

These tests are automatically run as part of the **"Sanity Checks & Auto Merge to Main"** GitHub Actions workflow, defined at `.github/workflows/auto-merge.yml`.

### Pipeline Order

```
push to Develop
    ↓
1. Checkout repository
    ↓
2. Verify Docker assets (Dockerfile, docker-compose.yml)
    ↓
3. ⬛ Install & Run Unit Tests  ← NEW
       cd UnitTest && npm ci && npm run test:ci
       ✗ If any test fails → pipeline stops, Develop is NOT merged to main
    ↓
4. Merge Develop → main (only if all tests pass)
```

### Failure Behavior

If a test fails, the GitHub Actions step exits with a non-zero code, which:
- **Blocks the merge** to `main`
- Marks the commit as ❌ failed on GitHub
- Sends a notification to the repository owner

This ensures that broken error-handling logic can **never reach production** without being noticed.

---

## 🗂️ Folder Structure

```
UnitTest/
├── helpers/
│   └── connectivity.js        # Extracted, testable logic (dependency injection)
├── connectivity.test.js       # 8 tests — BookStack connectivity check
├── errorClassification.test.js # 10 tests — Server error type classification
├── package.json               # Jest configuration (self-contained)
└── README.md                  # This file
```

---

## ➕ Adding New Tests

1. Create a new `*.test.js` file in `UnitTest/`
2. Import helpers from `./helpers/connectivity` or add a new helper file
3. Jest automatically discovers all `*.test.js` files — no config change needed
4. Run `npm test` locally to verify before pushing to `Develop`
