import type { UserRequest, UserConversationMessage } from "../../../workflows/unified/user-request.ts";

/** Keep ordinary dialogue and its speakers; exclude tools and private reasoning. */
export function userRequestFromSession(ctx: { sessionManager?: { getBranch(): unknown[]; buildContextEntries?(): unknown[] } }): UserRequest {
  const messages: UserConversationMessage[] = [];
  for (const item of ctx.sessionManager?.getBranch() || []) {
    const entry = item as { type?: string; id?: string; message?: { role?: string; content?: unknown } };
    const message = entry.message;
    if (entry.type !== "message" || !entry.id || !message || !["user", "assistant"].includes(message.role || "")) continue;
    const text = typeof message.content === "string" ? message.content : Array.isArray(message.content)
      ? message.content.filter(part => part?.type === "text" && typeof part.text === "string").map(part => part.text).join("\n") : "";
    if (text.trim()) messages.push({ id: entry.id, role: message.role as "user" | "assistant", text });
  }
  let lastUser = messages.length - 1;
  while (lastUser >= 0 && messages[lastUser].role !== "user") lastUser -= 1;
  if (lastUser < 0) throw new Error("No user request is available in the current Pi session.");
  const user = messages[lastUser];
  // Exclude the current assistant's delegation prose and other messages after
  // the request. Earlier proposals remain conversation, with their real role.
  const active = ctx.sessionManager?.buildContextEntries?.() as { id: string; type: string; summary?: string }[] | undefined;
  const visible = active ? new Set(active.map(entry => entry.id)) : undefined;
  const summary = active?.find(entry => entry.type === "compaction")?.summary;
  return {
    messageId: user.id, text: user.text,
    conversation: messages.slice(0, lastUser + 1).filter(message => message.id === user.id || !visible || visible.has(message.id)),
    ...(summary ? { contextSummary: summary } : {}),
  };
}
