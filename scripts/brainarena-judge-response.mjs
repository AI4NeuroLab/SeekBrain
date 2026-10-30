export function parseJudgeResponse(value) {
  const text = String(value || "").trim();
  const lines = text.split(/\r?\n/);
  const lastLine = lines.at(-1).trim().replace(/^\*\*(.*)\*\*$/, "$1");
  if (!/^(100|[1-9]?\d)$/.test(lastLine)) {
    throw new Error("Judge must end with a 0–100 integer on its own line");
  }
  if (!/\p{L}/u.test(lines.slice(0, -1).join("\n"))) {
    throw new Error("Judge returned a score without grading reasons; detailed rubric feedback is required");
  }
  return { score: Number(lastLine), reasoning: text };
}
