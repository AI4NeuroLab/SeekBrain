export interface UserConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

/** Supplied by the runtime from Pi's session, never a model-authored tool argument. */
export interface UserRequest {
  messageId: string;
  text: string;
  conversation: UserConversationMessage[];
  contextSummary?: string;
}
