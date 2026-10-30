export interface ReportPdfPolicy {
  enabled: boolean;
  force?: boolean;
  command?: string;
  timeoutSeconds?: number;
}

/** CLI switches apply to this process only, above user/project configuration. */
export function reportPdfPolicy(config?: { enabled?: boolean; command?: string; timeout_seconds?: number }, override?: string): ReportPdfPolicy {
  return {
    enabled: override === "true" ? true : override === "false" ? false : config?.enabled ?? true,
    force: override === "true",
    command: config?.command,
    timeoutSeconds: config?.timeout_seconds,
  };
}

export function reportFormats(requested: string[] = ["markdown", "pdf"], policy: ReportPdfPolicy): string[] {
  if (!requested.length || requested.some(value => !["markdown", "pdf"].includes(value))) throw new Error("Choose markdown, pdf, or both report formats.");
  if (!policy.enabled) return ["markdown"];
  return policy.force ? [...new Set([...requested, "pdf"])] : [...requested];
}
