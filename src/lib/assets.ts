const SRC_PATTERNS = [
  /<img[^>]+src="(https:[^"]+)"/g,
  /<video[^>]+src="(https:[^"]+)"/g,
  /background-image:\s*url\(&quot;(https:[^&]+)&quot;\)/g,
];

export function extractAssetUrls(htmlBlobs: string[]): string[] {
  const urls = new Set<string>();
  for (const html of htmlBlobs) {
    for (const pattern of SRC_PATTERNS) {
      pattern.lastIndex = 0;
      let match = pattern.exec(html);
      while (match !== null) {
        const url = match[1];
        if (url !== undefined) urls.add(url);
        match = pattern.exec(html);
      }
    }
  }
  return [...urls].sort();
}

function hashString(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return combined.toString(36).slice(0, 8);
}

export function localAssetName(url: string): string {
  const parsed = new URL(url);
  const base = parsed.pathname.split("/").pop() ?? "asset";
  const dotIndex = base.lastIndexOf(".");
  const format = parsed.searchParams.get("format");
  const ext = dotIndex > 0 ? base.slice(dotIndex) : format !== null ? `.${format}` : "";
  const stem = dotIndex > 0 ? base.slice(0, dotIndex) : base;
  const safeStem = stem.replace(/[^\w.-]/g, "_").slice(0, 60);
  return `${safeStem}_${hashString(url)}${ext}`;
}

export function buildAssetManifest(urls: string[]): Record<string, string> {
  const manifest: Record<string, string> = {};
  for (const url of urls) manifest[url] = localAssetName(url);
  return manifest;
}

const FONT_PATTERN = /url\("(https:\/\/abs\.twimg\.com\/[^"]+\.woff2?)"\)/g;

export function extractChirpFontUrls(css: string): string[] {
  const urls = new Set<string>();
  FONT_PATTERN.lastIndex = 0;
  let match = FONT_PATTERN.exec(css);
  while (match !== null) {
    const url = match[1];
    if (url !== undefined && /chirp/i.test(url)) urls.add(url);
    match = FONT_PATTERN.exec(css);
  }
  return [...urls].sort();
}

export function fontFileName(url: string): string {
  return url.split("/").pop() ?? "font.woff2";
}
