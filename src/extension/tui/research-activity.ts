import type { Theme } from "@earendil-works/pi-coding-agent";

type TaskStatus = { id: string; status: string; instruction?: string };
function elapsedTime(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600), minutes = Math.floor(total / 60) % 60, seconds = total % 60;
  const twoDigits = (value: number) => String(value).padStart(2, "0");
  if (hours) return `${hours}h${twoDigits(minutes)}m${twoDigits(seconds)}s`;
  if (minutes) return `${minutes}m${twoDigits(seconds)}s`;
  return `${seconds}s`;
}
export function activityLines(input: { projectPath?: string; activity: string; elapsedMs?: number; tasks: TaskStatus[]; outputs: string[] }, theme?: Pick<Theme, "fg" | "bold">): string[] {
  const color = (style: Parameters<Theme["fg"]>[0], text: string) => theme ? theme.fg(style, text) : text;
  const visibleTasks = input.tasks.filter(task => task.status === "running" || task.status === "failed");
  const tasks = visibleTasks.slice(0, 8).map(task => `  ${color(task.status === "failed" ? "error" : "accent", task.status === "failed" ? "×" : "●")} ${task.id}`);
  const label = color(input.elapsedMs === undefined ? "muted" : "accent", input.activity);
  const activity = input.activity ? (input.elapsedMs === undefined ? label : `${theme ? theme.bold(label) : label}  ${color("dim", elapsedTime(input.elapsedMs))}`) : "";
  return [input.projectPath ? color("dim", input.projectPath) : "", activity, ...tasks,
    ...(visibleTasks.length > 8 ? [color("dim", `  … ${visibleTasks.length - 8} more`)] : []),
    ...input.outputs.map(path => color("dim", path))].filter(Boolean);
}
