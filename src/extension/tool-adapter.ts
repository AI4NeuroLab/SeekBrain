export type ToolDetails = Record<string, unknown>;

export function toPiToolResult<T extends ToolDetails>(
  details: T,
  summarize: (details: T) => unknown = (value) => value,
  text?: string,
) {
  return {
    content: [{
      type: "text" as const,
      text: text ?? JSON.stringify(summarize(details), null, 2),
    }],
    details,
  };
}
