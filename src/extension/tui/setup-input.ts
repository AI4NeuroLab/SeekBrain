import { Input, Key, matchesKey } from "@earendil-works/pi-tui";
import { readSetupClipboardText } from "../../platform/clipboard.mjs";

export class SetupInput extends Input {
  private closed = false;
  private pasting = false;
  private queuedInput: string[] = [];

  constructor(private readonly options: {
    secret?: boolean;
    placeholder?: string;
    placeholderStyle?: (text: string) => string;
    requestRender: () => void;
    onPasteError: () => void;
    readClipboard?: () => Promise<string | null>;
  }) {
    super({ placeholder: options.placeholder, placeholderStyle: options.placeholderStyle });
  }

  override render(width: number): string[] {
    if (!this.options.secret) return super.render(width);
    // Preserve Input's cursor, scrolling, placeholder and focus rendering. Its
    // renderer sees only a same-length mask, never the credential. setValue does
    // not change undo history; equal lengths preserve the UTF-16 cursor offset.
    const value = this.getValue();
    try {
      this.setValue("*".repeat(value.length));
      return super.render(width);
    } finally {
      this.setValue(value);
    }
  }

  override handleInput(data: string): void {
    if (this.closed) return;
    if (this.pasting) {
      if (matchesKey(data, Key.escape)) {
        this.dispose();
        super.handleInput(data);
      } else this.queuedInput.push(data);
      return;
    }
    if (!matchesKey(data, "ctrl+v") && !matchesKey(data, "shift+insert")) {
      super.handleInput(data);
      return;
    }
    this.pasting = true;
    void (this.options.readClipboard || readSetupClipboardText)()
      .then((text) => {
        if (this.closed) return;
        if (text) {
          // Keep pasted controls from escaping the bracketed paste envelope.
          const clean = text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, "");
          super.handleInput(`\x1b[200~${clean}\x1b[201~`);
        } else this.options.onPasteError();
      })
      .catch(() => { if (!this.closed) this.options.onPasteError(); })
      .finally(() => {
        this.pasting = false;
        const queued = this.queuedInput;
        this.queuedInput = [];
        if (this.closed) return;
        for (const next of queued) this.handleInput(next);
        this.options.requestRender();
      });
  }

  dispose(): void {
    this.closed = true;
    this.queuedInput = [];
  }
}
