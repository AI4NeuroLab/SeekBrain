export const seekBrainStages = [
  "skill",
  "plan",
  "code",
  "validate",
  "interpret",
] as const;

export type SeekBrainStage = typeof seekBrainStages[number];

export function nextStage(stage: SeekBrainStage): SeekBrainStage | undefined {
  return seekBrainStages[seekBrainStages.indexOf(stage) + 1];
}
