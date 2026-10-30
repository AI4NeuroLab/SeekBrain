import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSeekBrainRuntime } from "./seekbrain-runtime.ts";
import type { SeekBrainRuntimeOptions } from "./runtime/runtime-options.ts";

/** Compose the canonical SeekBrain Pi runtime behind one stable entrypoint. */
export default async function registerSeekBrain(pi: ExtensionAPI, options?: SeekBrainRuntimeOptions) {
  await registerSeekBrainRuntime(pi, options);
}
