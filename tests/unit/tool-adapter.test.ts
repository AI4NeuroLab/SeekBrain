import { describe, expect, it } from "vitest";
import { toPiToolResult } from "../../src/extension/tool-adapter.ts";

describe("Pi tool adapter", () => {
  it("preserves details while allowing a bounded main-agent rendering", () => {
    const details = { ok: true, large: "full payload" };
    expect(toPiToolResult(details, ({ ok }) => ({ ok }))).toEqual({
      content: [{ type: "text", text: '{\n  "ok": true\n}' }],
      details,
    });
  });
});
