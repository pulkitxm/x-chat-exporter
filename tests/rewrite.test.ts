import { describe, expect, test } from "bun:test";
import { rewriteFontUrls, rewriteItemHtml } from "../src/lib/rewrite";

const options = {
  assetManifest: {
    "https://pbs.twimg.com/media/abc.jpg": "abc_12345678.jpg",
  },
  blobFileNames: {},
};

describe("rewriteItemHtml", () => {
  test("points sources at local assets", () => {
    const out = rewriteItemHtml('<img src="https://pbs.twimg.com/media/abc.jpg">', options);
    expect(out).toContain('src="assets/abc_12345678.jpg"');
  });

  test("strips srcset attributes", () => {
    const out = rewriteItemHtml(
      '<img src="https://pbs.twimg.com/media/abc.jpg" srcset="https://pbs.twimg.com/media/abc.jpg 1x">',
      options,
    );
    expect(out).not.toContain("srcset");
  });

  test("mutes videos so autoplay keeps working offline", () => {
    const out = rewriteItemHtml('<video src="https://pbs.twimg.com/media/abc.jpg" autoplay>', {
      assetManifest: {},
      blobFileNames: {},
    });
    expect(out).toContain("<video muted ");
  });

  test("absolutizes relative profile links and opens them in a new tab", () => {
    const out = rewriteItemHtml('<a href="/someuser">user</a>', options);
    expect(out).toBe('<a target="_blank" rel="noopener" href="https://x.com/someuser">user</a>');
  });

  test("converts nested card anchors before adding targets", () => {
    const html = '<a href="/u/status/1"><a href="/u">u</a></a>';
    const out = rewriteItemHtml(html, options);
    expect(out).toContain('data-card-link="1"');
    expect(out).toContain('data-href="https://x.com/u/status/1"');
  });
});

describe("blob source rewriting", () => {
  test("maps each captured blob url to its own local file", () => {
    const html =
      '<div data-testid="message-1"><img src="blob:https://x.com/aaa"><img src="blob:https://x.com/bbb"></div>';
    const out = rewriteItemHtml(html, {
      assetManifest: {},
      blobFileNames: {
        "blob:https://x.com/aaa": "dm_media_1.jpg",
        "blob:https://x.com/bbb": "dm_media_2.jpg",
      },
    });
    expect(out).toContain('src="assets/dm_media_1.jpg"');
    expect(out).toContain('src="assets/dm_media_2.jpg"');
    expect(out).not.toContain("blob:");
  });

  test("replaces uncaptured blob sources with a placeholder", () => {
    const html = '<img src="blob:https://x.com/gone">';
    const out = rewriteItemHtml(html, { assetManifest: {}, blobFileNames: {} });
    expect(out).not.toContain("blob:");
    expect(out).toContain("data:image/svg+xml");
  });
});

describe("rewriteFontUrls", () => {
  test("rewrites only fonts that were downloaded", () => {
    const css =
      'src: url("https://abs.twimg.com/fonts/a.woff2"); src: url("https://abs.twimg.com/fonts/b.woff2");';
    const out = rewriteFontUrls(css, ["a.woff2"]);
    expect(out).toContain('url("fonts/a.woff2")');
    expect(out).toContain('url("https://abs.twimg.com/fonts/b.woff2")');
  });
});
