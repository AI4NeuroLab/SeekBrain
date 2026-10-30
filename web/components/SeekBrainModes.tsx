"use client";
import { stripAnsi } from "@/lib/ansi";
import { useI18n } from "@/hooks/useI18n";

export function SeekBrainModes({ mode, onCommand, disabled }: { mode: string; onCommand?: (command: string) => void; disabled: boolean }) {
  const { t } = useI18n();
  return <span className="seekbrain-modes" role="group" aria-label={t("seekbrain.mode")}>
    {[["ask", "Ask"], ["plan", "Plan"], ["research", "Research"], ["deep-research", "Deep Research"]].map(([command, label]) => (
      <button key={command} type="button" className="extension-status-item extension-status-command"
        aria-pressed={stripAnsi(mode) === label} disabled={!onCommand || disabled}
        onClick={() => onCommand?.(`/${command}`)}>{label}</button>
    ))}
    <button type="button" className="extension-status-item extension-status-command" disabled={!onCommand || disabled}
      onClick={() => onCommand?.("/seekbrain-setup")}>{t("seekbrain.setup")}</button>
  </span>;
}
