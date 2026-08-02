# X Chat Exporter

One-click browser extension that exports an X (Twitter) chat conversation into a standalone offline HTML page, with every image, video, avatar, and font bundled next to it.

The export reuses the chat's own markup and compiled stylesheets, so the result looks exactly like the real conversation: shared-post preview cards, reply quotes, reactions, date separators, and system notices included. Media sent inside end-to-end encrypted chats is recovered from the decrypted in-page blobs, since it never exists as a downloadable URL.

## Install

```sh
bun install
bun run build
```

Then load it in any Chromium browser (Chrome, Dia, Edge, Brave):

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` folder

## Use

1. Open a conversation at `x.com/i/chat/...`
2. Click the extension icon
3. Stay on the chat tab and watch it scroll itself through the full history; a progress tab opens quietly in the background and comes to the front when the capture is done
4. When it finishes, a zip named after the person downloads (`x-chat-hood.zip`), extracting to a folder of the same name: open `index.html` inside it

Every export also contains `export-report.json` recording how the capture went: item and message counts, whether it reached the start of the conversation, whether trusted auto-scroll was used, and how much media was saved.

The extension drives the chat with real browser-level scroll events (via the `debugger` permission, which is why the browser shows a "started debugging this browser" banner while it runs; nothing is uploaded anywhere). If that is unavailable, the overlay asks you to scroll through the conversation yourself and keeps recording everything you pass. Capture only finishes when it reaches the start of the conversation, so a stalled export waits for you rather than saving a partial one, and if it still ends up short it says so instead of pretending the export is complete.

## How it works

- A content script walks X's virtualized message list with a `MutationObserver`, merging each mounted window of messages into a stable global order
- Blob-backed media from encrypted chats (both images and videos) is read in-page and streamed out as base64, keyed per blob url so multi-attachment messages survive
- The exporter page fetches all CDN media and Chirp fonts, rewrites the captured markup to local paths, repairs X's nested-anchor card links (invalid HTML that breaks on re-parse), and packs everything into a store-only zip built from scratch
- The exported page ships a lightbox: click any photo or video to view it full screen, close with the backdrop or Escape

## Development

```sh
bun test          # unit tests for the pure export pipeline
bun run verify    # lint, comment policy, dead code, cycles, types, tests, build
```

CI enforces all of the above on every push and pull request: Biome formatting and linting, a zero-comment source policy, no em-dash characters, Knip dead-code analysis, Madge circular-dependency checks, strict TypeScript, unit tests, and a reproducible extension build with artifact validation.
