// Release validation only. A file entry is required because Windows node-pty
// creates Worker(filename), which inherits incompatible --input-type flags.
console.log("Loading SDK");
await import("@earendil-works/pi-coding-agent");
console.log("SDK loaded");
const { default: pty } = await import("node-pty");
console.log("PTY module loaded; creating terminal");
const terminal = pty.spawn(process.execPath, ["-e", "process.stdout.write('seekbrain-pty-ready')"], {
  cols: 80, rows: 24, cwd: process.cwd(), env: process.env,
});
console.log("PTY spawn returned");
let output = "";
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { reject(new Error("PTY startup timed out")); }, 15000);
  terminal.onData(data => { output += data; });
  terminal.onExit(({ exitCode }) => {
    clearTimeout(timeout);
    exitCode === 0 && output.includes("seekbrain-pty-ready") ? resolve() : reject(new Error(`PTY failed (${exitCode}): ${output}`));
  });
});
// Windows node-pty retains its output worker until the terminal is disposed.
try { terminal.kill(); } catch { /* shell already exited */ }
console.log("SDK and terminal runtime ready; terminal released");
setTimeout(() => console.log("Remaining runtime resources:", process.getActiveResourcesInfo()), 2000).unref();
