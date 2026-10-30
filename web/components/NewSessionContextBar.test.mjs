import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const { NewSessionContextBar } = await jiti.import("./NewSessionContextBar.tsx");
const source = await readFile(new URL("./NewSessionContextBar.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const contextSource = await readFile(new URL("../lib/new-session-context.ts", import.meta.url), "utf8");

const h = React.createElement;
const noop = () => {};

const context = {
  cwd: "/work/app-worktrees/feature",
  project: { key: "app-key", root: "/work/app" },
  worktrees: [
    { path: "/work/app", branch: "main", isMain: true },
    { path: "/work/app-worktrees/feature", branch: "feature/x", isMain: false },
  ],
  currentWorktreePath: "/work/app-worktrees/feature",
  projects: [{ key: "app-key", root: "/work/app" }],
};

function render(props = {}) {
  return renderToStaticMarkup(h(I18nProvider, null, h(NewSessionContextBar, {
    context,
    mobile: false,
    initialFocus: null,
    onInitialFocusDone: noop,
    onPick: noop,
    onUseDefaultDirectory: noop,
    onOpenFolder: noop,
    onRefreshWorktrees: noop,
    onCreateWorktree: async () => ({ error: "unused" }),
    ...props,
  })));
}

test("the bar shows the project's name and the worktree's branch as two menu buttons", () => {
  const html = render();
  // No visible label: the folder icon says what the row is; the group keeps its name.
  assert.match(html, /^<div class="new-session-context"><div class="project-picker is-inline" role="group" aria-label="New session location"><button /);
  assert.equal((html.match(/New session location/g) ?? []).length, 1);
  // The project: a 12px folder icon, its name in code type, a chevron; the
  // full path is the tooltip (and the menu's rows), never the button's text.
  assert.match(html, /<button type="button" class="project-picker-button is-project" title="\/work\/app" aria-haspopup="menu" aria-expanded="false"><svg width="12" height="12"[^>]*class="project-picker-icon" aria-hidden="true"><path d="M3 8a2[^"]*"><\/path><\/svg><span class="project-picker-name"><span class="project-picker-leaf">app<\/span><\/span><svg width="9" height="9"[^>]*class="project-picker-chevron sidebar-icon-down" aria-hidden="true">/);
  assert.doesNotMatch(html, /project-picker-path"><span>\/work\/app</);
  // The worktree: the branch icon (the accent for a linked checkout), the
  // branch cut at its left, a chevron; no "main" note and no count.
  assert.match(html, /<button type="button" class="project-picker-button" title="Worktree: \/work\/app-worktrees\/feature" aria-haspopup="menu" aria-expanded="false"><svg width="11" height="11"[^>]*class="project-picker-icon is-linked"[\s\S]*?<\/svg><span class="project-picker-path"><span>feature\/x<\/span><\/span><svg width="9" height="9"[^>]*class="project-picker-chevron sidebar-icon-down"[\s\S]*?<\/svg><\/button><\/div><\/div>$/);
  const main = render({ context: { ...context, currentWorktreePath: "/work/app" } });
  assert.match(main, /class="project-picker-icon" aria-hidden="true">[\s\S]*?<span class="project-picker-path"><span>main<\/span><\/span><svg width="9"/);
  assert.doesNotMatch(main, /project-picker-note|is-linked/);
  assert.doesNotMatch(html, /project-picker-note|project-picker-divider|style=/);
  // The side padding is the header's (ChatWindow), on phones too.
  assert.match(render({ mobile: true }), /^<div class="new-session-context"><div class="project-picker is-inline"/);
});

test("the project's name is the menus': its display name, else its folder's, its parent only where names collide", () => {
  const twins = { ...context, projects: [{ key: "app-key", root: "/work/app" }, { key: "other", root: "/other/app" }] };
  // The parent and "/" outside the name's own span: the parent is cut first.
  assert.match(render({ context: twins }), /<span class="project-picker-name"><span class="project-picker-parent">work<\/span>\/<span class="project-picker-leaf">app<\/span><\/span>/);
  // A project the user named: that name alone, the path still the tooltip.
  const named = { ...twins, project: { ...context.project, alias: "Thermal <b>Models</b>" } };
  const html = render({ context: named });
  assert.match(html, /title="\/work\/app"[^>]*><svg[^>]*>[\s\S]*?<\/svg><span class="project-picker-name"><span class="project-picker-leaf">Thermal &lt;b&gt;Models&lt;\/b&gt;<\/span><\/span>/);
  assert.doesNotMatch(html, /project-picker-parent|is-alias/);
  // A name only the list knows (a move names its project by key and root).
  const listed = { ...context, projects: [{ key: "app-key", root: "/work/app", alias: "Listed" }] };
  assert.match(render({ context: listed }), /<span class="project-picker-name"><span class="project-picker-leaf">Listed<\/span><\/span>/);
});

test("the worktree button needs a worktree list: a non-git folder or a subdirectory has none", () => {
  const html = render({ context: { ...context, cwd: "/work/app/sub", project: { key: "/work/app/sub", root: "/work/app/sub" }, worktrees: null, currentWorktreePath: null } });
  assert.match(html, /title="\/work\/app\/sub"[^>]*>[\s\S]*?<span class="project-picker-name"><span class="project-picker-leaf">sub<\/span><\/span>/);
  assert.doesNotMatch(html, /Worktree:|project-picker-divider|is-inactive/);
  assert.equal((html.match(/aria-haspopup="menu"/g) ?? []).length, 1);
  // A detached checkout shows its path, cut at its left as a branch is.
  assert.match(
    render({ context: { ...context, worktrees: [{ path: "/work/app", branch: null, isMain: true }], currentWorktreePath: "/work/app" } }),
    /title="Worktree: \/work\/app"[^>]*>[\s\S]*?picker-path"><span>\/work\/app<\/span>/,
  );
});

test("client code stays parseable by Safari 16.2 and its CSS flat", () => {
  for (const file of [source, contextSource]) {
    assert.doesNotMatch(file, /\(\?<[=!]/, "no RegExp lookbehind");
  }
  const header = css.slice(css.indexOf(".new-session-hero-inner {"), css.indexOf("/* The project and worktree picker (ProjectWorktreePicker)"));
  const rules = css.slice(css.indexOf(".new-session-hero-inner {"), css.indexOf(".file-viewer-icon-button {"));
  assert.ok(header.length > 0 && rules.length > header.length);
  assert.doesNotMatch(rules.replace(/@media[^{]*\{/g, ""), /\{[^}]*\{|&/, "no nested rules");
  // The link's box: padding offset by equal negative margins, so hover and
  // focus never move the line.
  const update = header.match(/\.new-session-update \{[^}]*\smargin: -(\d+)px -(\d+)px;\s*padding: (\d+)px (\d+)px;/);
  assert.ok(update);
  assert.deepEqual([update[1], update[2]], [update[3], update[4]]);
  // The bar is pulled left by the project button's own padding, so its
  // folder icon stands on the logo's and the composer card's edge.
  const row = header.match(/\.new-session-context \{[^}]*\smargin: 0 0 \d+px -(\d+)px;/);
  assert.ok(row);
  const button = rules.match(/\.project-picker\.is-inline \.project-picker-button \{[^}]*\spadding: 0 (\d+)px;/);
  assert.ok(button);
  assert.equal(row[1], button[1]);
  // The inline boxes never take a share of the row (60% of a lone project
  // button, in a repo subdirectory, once left it 0px wide).
  assert.doesNotMatch(rules.slice(0, rules.indexOf(".project-picker.is-stacked {")), /max-width: [1-9]\d?%/);
});
