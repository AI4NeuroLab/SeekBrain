/** Inputs owned by one agent session. Web hosts must pass their session cwd. */
export interface SeekBrainRuntimeOptions {
  projectRoot?: string;
  env?: NodeJS.ProcessEnv;
}
