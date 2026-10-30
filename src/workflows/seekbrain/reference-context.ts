import type { WorkflowJson } from "./run-lifecycle.ts";

/** Pass locations, not a pre-ingested corpus; agents decide what is relevant. */
export function referenceContext(run: WorkflowJson, cwd: string): string {
  const state = run.state || {};
  const paths = Array.isArray(state.reference_paths) ? state.reference_paths : [];
  return [
    `User request working directory (resolve relative reference paths here):\n${state.request_cwd || cwd}`,
    paths.length ? `User-provided reference files or directories:\n${paths.join("\n")}` : "",
    state.extra_path_info ? `User-provided path/access notes:\n${state.extra_path_info}` : "",
    "Reference material can be any relevant file, image, notes, documentation, code, or paper. Use read as needed; use ls to inspect an explicitly supplied directory. Path/access notes locate material, not a new method contract. Do not assume a supplied path has already been read. For formats read cannot decode (such as PDF), bash may be used only for read-only extraction with an available tool. Do not execute reference code or modify reference material. If a reference is unavailable or unreadable, say so and continue with usable context. No reference input is required.",
  ].filter(Boolean).join("\n\n");
}
