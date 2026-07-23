import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSeekBrainRuntime } from "./seekbrain-runtime.ts";

/** Compose the canonical SeekBrain Pi runtime behind one stable entrypoint. */
export default async function registerSeekBrain(pi: ExtensionAPI) {
  await registerSeekBrainRuntime(pi);
}
