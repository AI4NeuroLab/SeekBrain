"""Offline integration: real Pi serialization, mocked fetch, isolated credentials."""
import base64
import csv
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=")


class Integration(unittest.TestCase):
    def test_run_evaluate_resume_and_failures(self):
        with tempfile.TemporaryDirectory(prefix="brainarena-test-") as temporary:
            directory = Path(temporary)
            answer = directory / "answer.txt"
            answer.write_text("The submitted evidence partially satisfies the rubric.\n73")
            requests_file = directory / "requests.jsonl"
            preload = directory / "mock-fetch.mjs"
            preload.write_text('''
import {appendFileSync, readFileSync} from 'node:fs';
globalThis.fetch = async (url, options) => {
  if (!String(url).startsWith('https://fixture.invalid')) throw new Error('Unexpected network request');
  appendFileSync(process.env.FIXTURE_REQUESTS, options.body + '\\n');
  const answer = readFileSync(process.env.FIXTURE_ANSWER, 'utf8');
  if (answer === '__NETWORK_DENIED__') {
    throw new TypeError('fetch failed', {cause: Object.assign(new Error('socket denied'),
      {code:'EPERM', syscall:'connect', address:'127.0.0.1', port:3888})});
  }
  const events = [
    ['message_start', {type:'message_start',message:{id:'msg_test',type:'message',role:'assistant',model:'claude-opus-4-6',content:[],stop_reason:null,usage:{input_tokens:10,output_tokens:0}}}],
    ['content_block_start', {type:'content_block_start',index:0,content_block:{type:'text',text:''}}],
    ['content_block_delta', {type:'content_block_delta',index:0,delta:{type:'text_delta',text:answer}}],
    ['content_block_stop', {type:'content_block_stop',index:0}],
    ['message_delta', {type:'message_delta',delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:15}}],
    ['message_stop', {type:'message_stop'}],
  ];
  return new Response(events.map(([event,data]) => `event: ${event}\\ndata: ${JSON.stringify(data)}\\n\\n`).join(''),
    {status:200, headers:{'content-type':'text/event-stream'}});
};
''')
            source, data, gt, agent = [directory / name for name in ("source", "data", "gt", "agent")]
            for path in (source, data / "Example", gt / "Example/Fig_1A", agent):
                path.mkdir(parents=True)
            (data / "Example/input.csv").write_text("value\n1\n")
            (gt / "Example/Fig_1A/paper.png").write_bytes(PNG)
            columns = ["问题 Query", "论文ID", "图号", "复现得分", "复现得分细则", "复现结论", "复现结果图", "评测 Rubric（含标注原文分析方法、结果图关键特征、结论）"]
            question = "Test real data and plot a result."
            with (source / "tasks.csv").open("w", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=columns)
                writer.writeheader()
                writer.writerows([
                    {"问题 Query": question, "论文ID": "Example", "图号": "Fig1A"},
                    {"问题 Query": "Already scored", "论文ID": "Example", "图号": "Fig1B", "复现得分": "99"},
                    {},
                ])
            with zipfile.ZipFile(source / "attachments.zip", "w") as archive:
                archive.writestr(f"rubrics/{question}.json", json.dumps({"tag": "Fig_1A", "rubrics": {"score_100": {"test": "fixture-rubric"}}}))
                archive.writestr("images/" + "x" * 300 + ".png", PNG)
            (agent / "auth.json").write_text(json.dumps({"fixture": {"type": "api_key", "key": "test-only"}}))
            (agent / "models.json").write_text(json.dumps({"providers": {"fixture": {
                "baseUrl": "https://fixture.invalid", "api": "anthropic-messages", "apiKey": "test-only",
                "models": [{"id": "claude-opus-4-6", "name": "Fixture", "input": ["text", "image"], "reasoning": True,
                            "compat": {"forceAdaptiveThinking": True},
                            "contextWindow": 100000, "maxTokens": 16384,
                            "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}}]}}}))
            config = directory / "config.json"
            config.write_text(json.dumps({"agents": {"seekbrain_interpret": {"provider": "fixture", "model": "claude-opus-4-7"}},
                                          "workflow": {"seekbrain": {"web_search": True}}}))
            solver = directory / "solver"
            solver.write_text(f'''#!{sys.executable}
import sys,json,pathlib,base64,os,time
args=sys.argv
work=pathlib.Path(args[args.index('--work-dir')+1])
config=json.loads(pathlib.Path(args[args.index('--config')+1]).read_text())
assert config['workflow']['seekbrain']['web_search'] is False
assert config['workflow']['seekbrain']['human_review']['enabled'] is False
if os.environ.get('FIXTURE_TIMEOUT'): time.sleep(30)
(work/'generated_code.py').write_text('# fixture-generated analysis\\n')
(work/'figure.png').write_bytes(base64.b64decode({base64.b64encode(PNG).decode()!r}))
(work/'conclusions.json').write_text(json.dumps({{'conclusions':['Fixture evidence.']}}))
sys.exit(int(os.environ.get('FIXTURE_EXIT','0')))
''')
            solver.chmod(0o700)
            output = directory / "output"
            base = [sys.executable, str(ROOT / "scripts/brainarena.py")]
            options = ["--source", str(source), "--dataset-root", str(data), "--gt-root", str(gt),
                       "--prepared", str(directory / "prepared"), "--output", str(output),
                       "--config", str(config), "--seekbrain", str(solver), "--timeout", "10", "--judge-timeout", "15"]
            env = {**os.environ, "PI_CODING_AGENT_DIR": str(agent), "SEEKBRAIN_USER_CONFIG": str(config),
                   "NODE_OPTIONS": f"--import={preload}", "FIXTURE_ANSWER": str(answer), "FIXTURE_REQUESTS": str(requests_file)}

            def requests():
                return [json.loads(line) for line in requests_file.read_text().splitlines()]

            def run(action, *extra, expected=0, **updates):
                completed = subprocess.run([*base, action, *options, *extra], env={**env, **updates},
                                           text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=60)
                self.assertEqual(completed.returncode, expected, completed.stdout)
                return completed.stdout

            # A nonzero solver exit still permits grading complete artifacts.
            run("run", FIXTURE_EXIT="7")
            status = output / "Example/Fig_1A/status.json"
            state = json.loads(status.read_text())
            self.assertEqual((state["status"], state["score"], state["run_exit_code"]), ("completed", 73, 7))
            self.assertEqual(len(requests()), 1)
            content = requests()[0]["messages"][0]["content"]
            self.assertEqual(sum(block["type"] == "image" for block in content), 2)
            self.assertIn("fixture-rubric", json.dumps(content))
            self.assertIn("fixture-generated analysis", json.dumps(content))
            self.assertEqual(requests()[0].get("tools", []), [])
            self.assertEqual(requests()[0]["thinking"]["type"], "adaptive")
            self.assertEqual(requests()[0]["output_config"]["effort"], "low")
            self.assertEqual(requests()[0]["max_tokens"], 8192)
            self.assertEqual(requests()[0]["model"], "claude-opus-4-6", "judge must ignore the solver's 4.7 configuration")
            self.assertEqual(json.loads((output / "Example/Fig_1A/evaluation.json").read_text())["judge_model"], "fixture/claude-opus-4-6")
            run("run")
            self.assertEqual(len(requests()), 1, "resume must skip completed tasks")
            answer.write_text("__NETWORK_DENIED__")
            failed_output = run("evaluate", expected=1)
            self.assertIn('EPERM', failed_output)
            self.assertIn('EPERM', json.loads(status.read_text())["error"])
            answer.write_text("Malformed score")
            run("evaluate", expected=1)
            self.assertEqual(json.loads(status.read_text())["status"], "judge_failed")
            self.assertIsNone(json.loads(status.read_text())["score"])
            answer.write_text("Recovered evaluation.\n81")
            run("run")
            state = json.loads(status.read_text())
            self.assertEqual((state["score"], state["attempt"]), (81, 1), "judge retry must reuse solver artifacts")
            with (output / "reproduce-100-scored.csv").open(encoding="utf-8-sig") as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual([row["复现得分"] for row in rows], ["81", "99", ""])
            self.assertEqual((output / ".runtime/agent/auth.json").stat().st_mode & 0o777, 0o600)
            run("run", "--rerun", "--timeout", "0.2", expected=1, FIXTURE_TIMEOUT="1")
            state = json.loads(status.read_text())
            self.assertEqual((state["status"], state["run_exit_code"], state["score"]), ("artifact_invalid", 124, None))
            self.assertEqual(json.loads((output / "summary.json").read_text())["evaluated"], 0)


if __name__ == "__main__":
    unittest.main()
