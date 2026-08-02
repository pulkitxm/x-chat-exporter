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
3. A progress tab opens while the chat tab scrolls itself through the full history
4. When it finishes, a zip downloads: unzip it and open `index.html`

If the page blocks synthetic scrolling, the overlay asks you to scroll through the conversation manually; the capture keeps recording while you do.

## How it works

- A content script walks X's virtualized message list with a `MutationObserver`, merging each mounted window of messages into a stable global order
- Blob-backed videos from encrypted chats are read in-page and streamed out as base64
- The exporter page fetches all CDN media and Chirp fonts, rewrites the captured markup to local paths, repairs X's nested-anchor card links (invalid HTML that breaks on re-parse), and packs everything into a store-only zip built from scratch

## Development

```sh
bun test          # unit tests for the pure export pipeline
bun run verify    # lint, comment policy, dead code, cycles, types, tests, build
```

CI enforces all of the above on every push and pull request: Biome formatting and linting, a zero-comment source policy, no em-dash characters, Knip dead-code analysis, Madge circular-dependency checks, strict TypeScript, unit tests, and a reproducible extension build with artifact validation.
