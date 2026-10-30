// Explicit paid-provider check. Unit/contract suites never invoke this script.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { installAnthropicThinkingCompatibility } from "../src/compat/anthropic-thinking.mjs";

if (!process.argv.includes("--live")) {
  console.log("Run with --live to make paid Opus 5.5 relay requests. Optional: --output <directory>.");
  process.exit(0);
}
const outputIndex = process.argv.indexOf("--output");
const directory = outputIndex >= 0 ? resolve(process.argv[outputIndex + 1]) : await mkdtemp(join(tmpdir(), "seekbrain-opus55-live-"));
await mkdir(directory, { recursive: true });
const agentDir = process.env.SEEKBRAIN_CODING_AGENT_DIR || process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
const metadata = { startedAt: new Date().toISOString(), kind: "controlled compatibility regression, not a scientific finding", calls: [], checks: [], directory };
async function save() { await writeFile(join(directory, "result.json"), JSON.stringify(metadata, null, 2)); }
async function runtime() {
  const value = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: join(agentDir, "models.json"), allowModelNetwork: false });
  installAnthropicThinkingCompatibility(value, { stateDir: join(directory, "bindings") });
  return value;
}
let active = await runtime();
const model = active.getModel("anthropic-relay", "claude-opus-5-5");
assert(model, "Configure anthropic-relay/claude-opus-5-5 first");
assert.equal(model.api, "anthropic-messages");
assert.equal(model.compat?.supportsMidConvoEffort, false, "Use the relay compatibility configuration");
const user = content => ({ role: "user", content, timestamp: Date.now() });
const prompt = (messages, system, tools = []) => ({ messages: [{ role: "system", content: system, toolsAdded: tools, timestamp: 0 }, ...messages] });
const visible = answer => answer.content.filter(b => b.type === "text").map(b => b.text).join("\n");
const json = answer => JSON.parse(visible(answer).replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
const signed = answer => answer.content.filter(b => b.type === "thinking" && b.thinkingSignature).length;
async function call(label, context, sessionId = "live-compatibility") {
  const started = Date.now();
  const record = { label, physicalRequests: [], stopReason: undefined, elapsedMs: undefined };
  metadata.calls.push(record);
  console.log(JSON.stringify({ stage: "start", label }));
  const answer = await active.streamSimple(model, context, {
    reasoning: "high", maxTokens: 2200, maxRetries: 0, cacheRetention: "none", sessionId,
    signal: AbortSignal.timeout(90000),
    fetch: async (url, init) => {
      const payload = JSON.parse(init.body);
      record.physicalRequests.push({
        thinkingBlocks: payload.messages.flatMap(m => Array.isArray(m.content) ? m.content : []).filter(b => ["thinking", "redacted_thinking"].includes(b.type)).length,
        toolCalls: payload.messages.flatMap(m => Array.isArray(m.content) ? m.content : []).filter(b => b.type === "tool_use").length,
        toolResults: payload.messages.flatMap(m => Array.isArray(m.content) ? m.content : []).filter(b => b.type === "tool_result").length,
        emptySystemMessages: payload.messages.filter(m => m.role === "system" && !m.content?.length).length,
        betas: payload.betas ?? [],
      });
      return fetch(url, init);
    },
  }).result();
  Object.assign(record, { stopReason: answer.stopReason, elapsedMs: Date.now() - started, signedThinkingBlocks: signed(answer),
    tokens: answer.usage.totalTokens, cost: answer.usage.cost.total, diagnostics: answer.diagnostics,
    error: answer.errorMessage?.replace(/https?:\/\/\S+/g, "[endpoint]").slice(0, 800) });
  console.log(JSON.stringify(record)); await save();
  assert(!["error", "aborted", "length"].includes(answer.stopReason), `${label}: ${record.error || answer.stopReason}`);
  return answer;
}
function check(name) { metadata.checks.push({ name, passed: true }); }

try {
  const systemA = "Compatibility regression. Answer accurately and concisely. Return only JSON when requested.";
  const systemB = "Compatibility regression. The plan was revised. Preserve established evidence. Return only JSON when requested.";
  const question = user("Find the smallest positive integer n with n mod 17 = 11, n mod 19 = 7, n mod 23 = 14. Return only JSON {\"n\":integer,\"remainders\":[integer,integer,integer]}.");
  const first = await call("initial_signed_reasoning", prompt([question], systemA));
  assert.deepEqual(json(first), { n: 4890, remainders: [11, 7, 14] }); assert(signed(first) > 0);
  check("initial numerical answer");
  const messages = [question, first, user("Verify that integer. Return only JSON {\"n\":integer}.")];
  const second = await call("unchanged_prefix_continuation", prompt(messages, systemA));
  assert.deepEqual(json(second), { n: 4890 });
  assert(!second.diagnostics?.some(d => d.type === "seekbrain_thinking_compatibility"));
  check("unchanged prefix preserves old thinking");
  messages.push(second, user("After the plan revision, confirm the same result. Return only JSON {\"n\":integer}."));
  const third = await call("changed_system_recovers_and_keeps_answer", prompt(messages, systemB));
  assert.deepEqual(json(third), { n: 4890 });
  assert(third.diagnostics?.some(d => d.type === "seekbrain_thinking_compatibility" && d.details.removedBlocks > 0));
  check("changed system continues with identical numerical answer"); messages.push(third);

  const csv = "group,value\nA,10\nA,12\nA,14\nA,16\nB,8\nB,10\nB,12\nB,14\n";
  await writeFile(join(directory, "evidence.csv"), csv);
  await writeFile(join(directory, "plan.md"), "Controlled compatibility test only. Read evidence.csv; calculate group means and A-B; save report.md. Preserve the prior CRT answer n=4890.\n");
  const tools = [
    { name: "read_fixture", description: "Read the controlled test CSV and saved plan.", parameters: { type: "object", properties: {} } },
    { name: "write_report", description: "Save the requested Markdown report after reading the fixture. This is a compatibility test, not a scientific discovery.",
      parameters: { type: "object", properties: { markdown: { type: "string" } }, required: ["markdown"] } },
  ];
  messages.push(user("Run the saved controlled test: call read_fixture, compute each group's sample size and mean and the A minus B mean difference, then call write_report to save a concise Markdown report explicitly labeled as compatibility test data. Finally state the result. Use tools to read and save the files."));
  let system = systemB + " Planning stage. Read the saved evidence before writing the report.", read = false, wrote = false;
  for (let i = 0; i < 6; i++) {
    const answer = await call(`file_tool_workflow_${i}`, prompt(messages, system, tools)); messages.push(answer);
    const calls = answer.content.filter(b => b.type === "toolCall");
    if (!calls.length) break;
    for (const item of calls) {
      let result;
      if (item.name === "read_fixture") {
        read = true; result = `COMPATIBILITY TEST DATA ONLY\n${await readFile(join(directory, "evidence.csv"), "utf8")}\nPlan: ${await readFile(join(directory, "plan.md"), "utf8")}`;
        system = "Compatibility regression. Research stage: the plan is finalized. Keep the evidence and prior CRT answer. Calculate the group means, save the requested test report and finish.";
      } else if (item.name === "write_report") {
        assert(read, "Report cannot be written before evidence is read");
        await writeFile(join(directory, "report.md"), item.arguments.markdown); wrote = true; result = "Saved report.md successfully.";
      } else throw new Error(`Unexpected tool ${item.name}`);
      messages.push({ role: "toolResult", toolCallId: item.id, toolName: item.name, content: [{ type: "text", text: result }], isError: false, timestamp: Date.now() });
    }
  }
  assert(read && wrote, "The model must read evidence and write a report");
  const report = await readFile(join(directory, "report.md"), "utf8");
  assert(/13/.test(report) && /11/.test(report) && /\b2\b/.test(report) && /\b4\b/.test(report), "Report must contain both means, their difference and sample sizes");
  assert.equal(await readFile(join(directory, "evidence.csv"), "utf8"), csv);
  check("actual file tools, system change between tool call and result, report and unchanged evidence");

  active = await runtime();
  messages.push(user("Resume the saved task. Using the prior evidence, return only JSON {\"n\":integer,\"mean_a\":number,\"mean_b\":number,\"difference\":number,\"n_a\":integer,\"n_b\":integer}. Do not call tools again."));
  const resumed = await call("fresh_runtime_resume_with_original_history", prompt(messages, system, tools));
  assert.deepEqual(json(resumed), { n: 4890, mean_a: 13, mean_b: 11, difference: 2, n_a: 4, n_b: 4 });
  check("resume preserves task conclusions and cleaned thinking view");
  metadata.reportSha256 = createHash("sha256").update(report).digest("hex");

  const legacy = await call("legacy_session_single_retry", prompt([question, first, user("Confirm the result. Return only JSON {\"n\":integer}.")], "A newly rebuilt system prompt for this imported legacy session."), "legacy-session");
  assert.deepEqual(json(legacy), { n: 4890 });
  metadata.legacyRecoveryObserved = Boolean(legacy.diagnostics?.some(d => d.type === "seekbrain_thinking_compatibility" && d.details.recoveredFromPrefixMismatch));
  check("legacy session continuation returns the correct answer");
  if (metadata.legacyRecoveryObserved) check("real relay rejects legacy thinking and one bounded retry recovers");
  else metadata.notes = ["This relay accepted the legacy block on its first attempt. The live run did not exercise 400 recovery; deterministic SDK/HTTP fixtures cover that branch."];
  metadata.passed = true;
} catch (error) {
  metadata.passed = false; metadata.failure = String(error).replace(/https?:\/\/\S+/g, "[endpoint]"); process.exitCode = 1;
  console.error(metadata.failure);
} finally { metadata.finishedAt = new Date().toISOString(); await save(); console.log(JSON.stringify({ passed: metadata.passed, checks: metadata.checks, directory })); }
