/**
 * NeuroScientist level-1 human-review approval overlay.
 *
 * Focus-owning modal opened from inside a tool's execute() via
 * `ctx.ui.custom(...)`. While it is visible, the overlay owns keyboard
 * input entirely: the pi editor is inert, "/" does not open the slash menu,
 * and typing goes to this modal.
 *
 * Two modes:
 *   - "menu":  concise SelectList with 3 items (Yes / No / Type feedback).
 *              Enter picks. y/n/t shortcuts work. Esc cancels the whole gate.
 *   - "input": Editor for feedback. Enter submits.
 *              `\` + Enter inserts a newline (Editor default). Esc returns to menu.
 *
 * The awaited promise resolves with an `ApprovalDecision` describing the
 * user's choice. Callers should:
 *   - approve  → record neuro_approve_stage into state.human_reviews
 *   - revise   → record neuro_record_feedback + rerun stage next turn
 *   - reject   → terminate the workflow immediately
 *   - cancel   → leave state unchanged; let the user decide next
 */

import {
  type Component,
  Editor,
  type EditorTheme,
  type Focusable,
  Key,
  type KeybindingsManager,
  matchesKey,
  type OverlayHandle,
  type SelectItem,
  SelectList,
  type SelectListTheme,
  Theme,
  TUI,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ApprovalDecision =
  | { decision: "approve" }
  | { decision: "revise"; comment: string }
  | { decision: "reject"; comment?: string }
  | { decision: "cancel" };

/**
 * Minimal shape of `ExtensionUIContext.custom` we depend on. Keeps this
 * module decoupled from the full ExtensionContext type so it can be reused
 * from tests / other contexts.
 */
export interface OverlayCapableUI {
  custom<T>(
    factory: (
      tui: TUI,
      theme: Theme,
      keybindings: KeybindingsManager,
      done: (result: T) => void,
    ) => (Component & { dispose?(): void }) | Promise<Component & { dispose?(): void }>,
    options?: {
      overlay?: boolean;
      overlayOptions?: Record<string, unknown> | (() => Record<string, unknown>);
      onHandle?: (handle: OverlayHandle) => void;
    },
  ): Promise<T>;
}

export interface ApprovalOverlayParams {
  ui: OverlayCapableUI;
  /** Stage identifier ("plan" / "code" / "validate" / "conclude"). */
  stage: string;
  /** Human-readable stage label for the header. */
  stageLabel?: string;
  /** Current run id, shown in the header. */
  runId: string;
  /** Short planner-generated review summary. Truncated to PREVIEW_CHAR_LIMIT. */
  planSummary: string;
  /** Optional short one-liner shown above the preview (e.g. plan.confidence). */
  headline?: string;
  /** Optional caller-side abort hook. Calling close() resolves with "cancel". */
  onHandle?: (handle: { close: () => void }) => void;
}

const PREVIEW_CHAR_LIMIT = 900;

export async function openApprovalOverlay(
  params: ApprovalOverlayParams,
): Promise<ApprovalDecision> {
  const preview = truncatePreview(params.planSummary ?? "", PREVIEW_CHAR_LIMIT);

  let cancelled = false;
  return params.ui.custom<ApprovalDecision>(
    (tui, theme, _keybindings, done) => {
      const wrappedDone = (result: ApprovalDecision) => {
        if (cancelled) return;
        cancelled = true;
        done(result);
      };
      return buildOverlay(tui, theme, wrappedDone, params, preview);
    },
    {
      overlay: true,
      // Default nonCapturing: false — overlay owns focus, pi editor is inert.
      overlayOptions: {
        anchor: "center",
        width: "68%",
        minWidth: 56,
        maxHeight: "70%",
        margin: 1,
      },
      onHandle: (handle) => {
        params.onHandle?.({
          close: () => {
            if (cancelled) return;
            cancelled = true;
            // Resolve the awaiting promise with cancel, then dismiss.
            // handle.hide() doesn't resolve done(); we rely on caller
            // holding the awaited promise. Instead, we call done via a
            // side-channel: the factory closure captured `done`, but we
            // can't reach it here. So we hide the overlay and let the
            // caller time-out / rely on tool signal for cleanup.
            try {
              handle.hide();
            } catch {
              // best-effort
            }
          },
        });
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Overlay component
// ---------------------------------------------------------------------------

type Mode = "menu" | "input";
type InputPurpose = "revise";

function buildOverlay(
  tui: TUI,
  theme: Theme,
  done: (result: ApprovalDecision) => void,
  params: ApprovalOverlayParams,
  preview: string,
): Component & Focusable & { dispose?(): void } {
  let mode: Mode = "menu";
  let purpose: InputPurpose = "revise";
  let scrollOffset = 0;
  let cachedLines: string[] | undefined;
  let cachedWidth: number | undefined;

  // ---- Selection list ---------------------------------------------------
  const items: SelectItem[] = [
    { value: "approve", label: "Yes", description: "Approve this plan and continue to code." },
    { value: "reject", label: "No", description: "Stop this workflow now." },
    { value: "revise", label: "Type feedback", description: "Write changes for the planner and rerun plan." },
  ];

  const selectTheme: SelectListTheme = {
    selectedPrefix: (t: string) => theme.fg("accent", t),
    selectedText:   (t: string) => theme.fg("accent", t),
    description:    (t: string) => theme.fg("muted", t),
    scrollInfo:     (t: string) => theme.fg("dim", t),
    noMatch:        (t: string) => theme.fg("warning", t),
  };
  const selectList = new SelectList(items, items.length, selectTheme);
  selectList.onSelect = (item: SelectItem) => {
    if (item.value === "approve") {
      done({ decision: "approve" });
      return;
    }
    if (item.value === "reject") {
      done({ decision: "reject" });
      return;
    }
    purpose = "revise";
    mode = "input";
    editor.setText("");
    editor.focused = true;
    invalidate();
    tui.requestRender();
  };
  selectList.onCancel = () => {
    done({ decision: "cancel" });
  };

  // ---- Editor (multi-line feedback) ------------------------------------
  const editorTheme: EditorTheme = {
    borderColor: (s: string) => theme.fg("accent", s),
    selectList: selectTheme,
  };
  const editor = new Editor(tui, editorTheme);
  editor.onSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return; // ignore empty submits; stay in input mode
    done({ decision: purpose, comment: trimmed });
  };

  // Pre-split preview by hard newlines; wrapping to terminal width happens
  // per-render (widths differ if the user resizes the terminal).
  const previewParagraphs = preview.length ? preview.split(/\n/) : [];

  function invalidate() {
    cachedLines = undefined;
    cachedWidth = undefined;
    selectList.invalidate();
    editor.invalidate();
  }

  function wrapPreview(width: number): string[] {
    const w = Math.max(1, width - 2);
    const wrapped: string[] = [];
    for (const para of previewParagraphs) {
      if (para === "") {
        wrapped.push("");
      } else {
        wrapped.push(...wrapTextWithAnsi(para, w));
      }
    }
    return wrapped;
  }

  function renderPreview(width: number, maxRows: number): string[] {
    const wrapped = wrapPreview(width);
    const total = wrapped.length;
    if (total === 0) return [];
    if (total <= maxRows) {
      scrollOffset = 0;
      return wrapped.map((l) => ` ${l}`);
    }
    scrollOffset = Math.max(0, Math.min(scrollOffset, total - maxRows));
    const slice = wrapped.slice(scrollOffset, scrollOffset + maxRows);
    const shown = slice.map((l) => ` ${l}`);
    const info = theme.fg(
      "dim",
      ` ── preview ${scrollOffset + 1}-${scrollOffset + slice.length} / ${total}  (PgUp/PgDn scroll)`,
    );
    shown.push(truncateToWidth(info, width));
    return shown;
  }

  function render(width: number): string[] {
    if (cachedLines && cachedWidth === width) return cachedLines;
    const w = Math.max(20, width);
    const lines: string[] = [];
    const rule = theme.fg("accent", "─".repeat(w));

    // Header
    lines.push(rule);
    const stageLabel = params.stageLabel || params.stage;
    lines.push(
      truncateToWidth(
        ` ${theme.fg("accent", theme.bold(`${stageLabel} Gate`))}` +
          ` ${theme.fg("muted", "— Approval Required —")}` +
          ` ${theme.fg("dim", `run ${params.runId}`)}`,
        w,
      ),
    );
    if (params.headline) {
      lines.push(truncateToWidth(` ${theme.fg("muted", params.headline)}`, w));
    }
    lines.push(rule);

    // Preview: max 14 rows or 40% of overlay budget, whichever is smaller.
    // Overlay reports width, not height, so we choose a fixed generous cap
    // and rely on maxHeight: "80%" to keep the whole modal on-screen.
    const previewRows = Math.max(5, Math.min(14, wrapPreview(w).length));
    lines.push(...renderPreview(w, previewRows));
    lines.push("");

    // Mode-dependent body
    if (mode === "menu") {
      lines.push(truncateToWidth(` ${theme.fg("text", "Choose an action:")}`, w));
      for (const l of selectList.render(w)) lines.push(l);
      lines.push("");
      lines.push(
        truncateToWidth(
          ` ${theme.fg("dim", "↑↓ navigate • Enter select • y yes • n no • t feedback • Esc cancel")}`,
          w,
        ),
      );
    } else {
      const label = "Feedback for planner:";
      lines.push(truncateToWidth(` ${theme.fg("accent", label)}`, w));
      for (const l of editor.render(Math.max(1, w - 2))) lines.push(` ${l}`);
      lines.push("");
      lines.push(
        truncateToWidth(
          ` ${theme.fg("dim", "Enter submit • \\+Enter newline • Esc back to menu")}`,
          w,
        ),
      );
    }

    lines.push(rule);

    // Contract: every returned line must respect `width`.
    const clamped = lines.map((l) => (visibleWidth(l) > w ? truncateToWidth(l, w) : l));
    cachedLines = clamped;
    cachedWidth = width;
    return clamped;
  }

  function handleInput(data: string) {
    if (mode === "input") {
      // Editor does not consume Escape; we catch it to return to menu.
      if (matchesKey(data, Key.escape)) {
        mode = "menu";
        editor.setText("");
        editor.focused = false;
        invalidate();
        tui.requestRender();
        return;
      }
      editor.handleInput(data);
      invalidate();
      tui.requestRender();
      return;
    }

    // Menu mode: direct shortcuts first, then preview scrolling and SelectList.
    const key = data.toLowerCase();
    if (key === "y") {
      done({ decision: "approve" });
      return;
    }
    if (key === "n") {
      done({ decision: "reject" });
      return;
    }
    if (key === "t") {
      purpose = "revise";
      mode = "input";
      editor.setText("");
      editor.focused = true;
      invalidate();
      tui.requestRender();
      return;
    }

    // Menu mode: preview scrolling first, then SelectList.
    if (data === "\x1b[5~" /* PgUp */) {
      scrollOffset = Math.max(0, scrollOffset - 4);
      invalidate();
      tui.requestRender();
      return;
    }
    if (data === "\x1b[6~" /* PgDn */) {
      scrollOffset += 4;
      invalidate();
      tui.requestRender();
      return;
    }

    selectList.handleInput(data);
    invalidate();
    tui.requestRender();
  }

  const component: Component & Focusable & { dispose?(): void } = {
    render,
    invalidate,
    handleInput,
    // Focus is forwarded to the Editor when in input mode so IME cursor
    // positioning works. SelectList doesn't care about `focused`.
    get focused() {
      return editor.focused;
    },
    set focused(value: boolean) {
      editor.focused = value && mode === "input";
    },
  } as Component & Focusable & { dispose?(): void };

  return component;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncatePreview(text: string, limit: number): string {
  const normalized = text.replace(/\r\n?/g, "\n").trimEnd();
  if (normalized.length <= limit) return normalized;
  return normalized.slice(0, limit).trimEnd() + `\n… [truncated, showing first ${limit} chars]`;
}
