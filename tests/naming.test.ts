import { describe, expect, test } from "bun:test";
import { cleanConversationName, conversationSlug } from "../src/lib/naming";

describe("cleanConversationName", () => {
  test("drops the encryption status the header appends", () => {
    expect(cleanConversationName("Hood Unencrypted")).toBe("Hood");
    expect(cleanConversationName("Ayush Encrypted")).toBe("Ayush");
    expect(cleanConversationName("Divv Saxena end-to-end encrypted")).toBe("Divv Saxena");
  });

  test("collapses whitespace", () => {
    expect(cleanConversationName("  Manu   Arora \n")).toBe("Manu Arora");
  });

  test("keeps a name that has no status suffix", () => {
    expect(cleanConversationName("Hood")).toBe("Hood");
  });
});

describe("conversationSlug", () => {
  test("names the export after the person", () => {
    expect(conversationSlug("Hood Unencrypted", "1-2")).toBe("x-chat-hood");
    expect(conversationSlug("Manu Arora", "1-2")).toBe("x-chat-manu-arora");
  });

  test("strips emoji, punctuation and accents", () => {
    expect(conversationSlug("Farza 🇮🇳🇺🇸", "1-2")).toBe("x-chat-farza");
    expect(conversationSlug("Émma", "1-2")).toBe("x-chat-émma");
    expect(conversationSlug("Emma Lorrae | UGC", "1-2")).toBe("x-chat-emma-lorrae-ugc");
  });

  test("keeps non-latin names readable instead of dropping them", () => {
    expect(conversationSlug("विक्रम", "1-2")).toBe("x-chat-विक्रम");
  });

  test("falls back to the conversation id when no name survives", () => {
    expect(conversationSlug("🙂", "1698011510042251264-2036235055815860224")).toBe(
      "x-chat-1698011510042251264-2036235055815860224",
    );
    expect(conversationSlug("", "")).toBe("x-chat-conversation");
  });

  test("never emits path separators or trailing dashes", () => {
    const slug = conversationSlug("a/b\\c ..", "1-2");
    expect(slug.includes("/")).toBe(false);
    expect(slug.includes("\\")).toBe(false);
    expect(slug.endsWith("-")).toBe(false);
  });

  test("stays a bounded length", () => {
    expect(conversationSlug("x".repeat(300), "1-2").length).toBeLessThanOrEqual(68);
  });
});
