/**
 * Pure Focus — Strip all footer and status line UI
 *
 * Removes the footer bar and status line entirely, leaving only
 * the conversation and editor. Pure distraction-free mode.
 *
 * Usage: pi -e examples/extensions/pure-focus.ts
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { applyExtensionDefaults } from "./themeMap.ts";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		applyExtensionDefaults(import.meta.url, ctx);
		ctx.ui.setFooter((_tui, _theme, _footerData) => ({
			dispose: () => {},
			invalidate() {},
			render(_width: number): string[] {
				return [];
			},
		}));
	});
}
