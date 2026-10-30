import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type Json = Record<string, any>;

function messageText(message: Json): string {
  if (typeof message?.content === "string") return message.content.trim();
  if (!Array.isArray(message?.content)) return "";
  return message.content
    .map((item: any) => typeof item === "string" ? item : item?.type === "text" ? item.text : "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function conversationMarkdown(sessionManager: any, savedAt = new Date()): string | undefined {
  const entries = sessionManager?.getBranch?.() || sessionManager?.getEntries?.() || [];
  const conversation: string[] = [];
  for (const entry of entries) {
    if (entry?.type !== "message") continue;
    const role = entry.message?.role;
    if (role !== "user" && role !== "assistant") continue;
    const text = messageText(entry.message);
    if (!text) continue;
    conversation.push(`## ${role === "user" ? "用户" : "SeekBrain"}\n\n${text}`);
  }
  if (!conversation.length) return undefined;
  const sessionId = String(sessionManager?.getSessionId?.() || "").trim();
  const metadata = ["# SeekBrain 对话记录", "", `- 保存时间：${savedAt.toLocaleString()}`];
  if (sessionId) metadata.push(`- 会话 ID：\`${sessionId}\``);
  metadata.push("", "---", "");
  return `${metadata.join("\n")}\n${conversation.join("\n\n")}\n`;
}

function historyTimestamp(date: Date): string {
  const two = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}_${two(date.getHours())}-${two(date.getMinutes())}-${two(date.getSeconds())}`;
}

export async function saveConversationHistory(context: any, savedAt = new Date()): Promise<string | undefined> {
  const markdown = conversationMarkdown(context?.sessionManager, savedAt);
  if (!markdown || !context?.cwd) return undefined;
  const directory = join(context.cwd, "seekbrain-history");
  await mkdir(directory, { recursive: true });
  const sessionId = String(context.sessionManager?.getSessionId?.() || "session").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 8) || "session";
  const path = join(directory, `${historyTimestamp(savedAt)}_${sessionId}.md`);
  await writeFile(path, markdown, "utf8");
  return path;
}
