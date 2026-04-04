# BookStack AI Chatbot — Improvement Plan Task List

- [x] Update `chatbot/server.js` with improved search logic
  - [x] Add `getBook` API wrapper 
  - [x] Add `getChapter` API wrapper
  - [x] Enhance API search result loop to handle `book` and `chapter` items
  - [x] Adjust page context truncation length (e.g. up to 4000 characters)
  - [x] Add smart keyword extraction for multi-query if needed
- [x] Build and restart docker container
- [x] Verify search quality
