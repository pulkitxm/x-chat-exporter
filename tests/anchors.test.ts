import { describe, expect, test } from "bun:test";
import { fixNestedAnchors } from "../src/lib/anchors";

describe("fixNestedAnchors", () => {
  test("leaves plain anchors untouched", () => {
    const html = '<div><a href="https://x.com/a">one</a><a href="https://x.com/b">two</a></div>';
    expect(fixNestedAnchors(html)).toBe(html);
  });

  test("converts an anchor that wraps another anchor into a span", () => {
    const html =
      '<a class="card" href="https://x.com/status/1"><a href="https://x.com/u">u</a></a>';
    const out = fixNestedAnchors(html);
    expect(out).toBe(
      '<span data-card-link="1" class="card" data-href="https://x.com/status/1"><a href="https://x.com/u">u</a></span>',
    );
  });

  test("handles double nesting by converting every wrapping anchor", () => {
    const html =
      '<a href="https://x.com/1"><a href="https://x.com/2"><a href="https://x.com/3">x</a></a></a>';
    const out = fixNestedAnchors(html);
    expect(out.match(/data-card-link/g)?.length).toBe(2);
    expect(out.match(/<a /g)?.length).toBe(1);
    expect(out.match(/<\/span>/g)?.length).toBe(2);
  });

  test("keeps sibling anchors inside a converted wrapper", () => {
    const html =
      '<a class="w" href="https://x.com/s"><span><a href="https://x.com/p">p</a></span><a href="https://x.com/q">q</a></a>';
    const out = fixNestedAnchors(html);
    expect(out.startsWith('<span data-card-link="1" class="w" data-href="https://x.com/s">')).toBe(
      true,
    );
    expect(out.endsWith("</span>")).toBe(true);
    expect(out.match(/<a href/g)?.length).toBe(2);
  });

  test("ignores anchors without href", () => {
    const html = "<a><a>inner</a></a>";
    const out = fixNestedAnchors(html);
    expect(out).toBe('<span data-card-link="1"><a>inner</a></span>');
  });
});
