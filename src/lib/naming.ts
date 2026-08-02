const TRAILING_STATUS = /\s*(unencrypted|encrypted|end-to-end encrypted)\s*$/i;
const MAX_SLUG_LENGTH = 60;

export function cleanConversationName(rawName: string): string {
  return rawName.replace(TRAILING_STATUS, "").replace(/\s+/g, " ").trim();
}

export function conversationSlug(rawName: string, fallbackId: string): string {
  const slug = cleanConversationName(rawName)
    .normalize("NFC")
    .replace(/[^\p{Letter}\p{Number}\p{Mark}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
  if (slug.length > 0) return `x-chat-${slug}`;
  const safeFallback = fallbackId.replace(/[^\w-]/g, "-").slice(0, MAX_SLUG_LENGTH);
  return `x-chat-${safeFallback.length > 0 ? safeFallback : "conversation"}`;
}
