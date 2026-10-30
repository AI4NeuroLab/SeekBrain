import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const { ProjectWorktreePicker, WorktreeRemoveForm } = await jiti.import("./ProjectWorktreePicker.tsx");
const { SidebarMenuSurface } = await jiti.import("./SidebarMenu.tsx");
const source = await readFile(new URL("./ProjectWorktreePicker.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

const h = React.createElement;
const noop = () => {};

const context = {
  cwd: "/home/me/work/app-worktrees/feature",
  project: { key: "app-key", root: "/home/me/work/app" },
  worktrees: [
    { path: "/home/me/work/app", branch: "main", isMain: true },
    { path: "/home/me/work/app-worktrees/feature", branch: "feature/x", isMain: false },
  ],
  currentWorktreePath: "/home/me/work/app-worktrees/feature",
  projects: [{ key: "app-key", root: "/home/me/work/app" }, { key: "lib-key", root: "/home/me/work/lib" }],
};

function render(props = {}) {
  return renderToStaticMarkup(h(I18nProvider, null, h(ProjectWorktreePicker, {
    layout: "stacked",
    context,
    mobile: false,
    label: "Project and worktree",
    newWorktreeTitle: "Create a worktree checkout for a branch",
    onPick: noop,
    onUseDefaultDirectory: noop,
    onOpenFolder: noop,
    onRefreshWorktrees: noop,
    onCreateWorktree: async () => ({ error: "unused" }),
    ...props,
  })));
}

test("inline: the project's name and the branch as text, no path and no notes", () => {
  const html = render({ layout: "inline", homeDir: "/home/me" });
  assert.match(html, /^<div class="project-picker is-inline" role="group" aria-label="Project and worktree">/);
  // A folder icon, the name, a chevron; the whole path only as the tooltip
  // (the menu's rows show it on a desktop).
  assert.match(html, /<button type="button" class="project-picker-button is-project" title="\/home\/me\/work\/app" aria-haspopup="menu" aria-expanded="false"><svg width="12" height="12"[^>]*class="project-picker-icon"[\s\S]*?<\/svg><span class="project-picker-name"><span class="project-picker-leaf">app<\/span><\/span><svg width="9" height="9"[^>]*class="project-picker-chevron sidebar-icon-down"[\s\S]*?<\/svg><\/button>/);
  assert.doesNotMatch(html, /~\/work\/app<|project-picker-label/);
  // The branch, cut at its left, and the chevron: neither "main" nor the count.
  assert.match(html, /class="project-picker-icon is-linked"[\s\S]*?<\/svg><span class="project-picker-path"><span>feature\/x<\/span><\/span><svg width="9" height="9"/);
  const main = render({ layout: "inline", context: { ...context, currentWorktreePath: "/home/me/work/app" } });
  assert.match(main, /<span class="project-picker-path"><span>main<\/span><\/span><svg width="9"/);
  assert.doesNotMatch(html + main, /project-picker-note|project-picker-divider|is-name/);
  // Twins get the parent folder and "/", dim, before the name, each in a
  // span of its own: the parent is cut first, the name last.
  const twins = { ...context, projects: [...context.projects, { key: "old-key", root: "/home/me/old/app" }] };
  assert.match(render({ layout: "inline", context: twins }), /<span class="project-picker-name"><span class="project-picker-parent">work<\/span>\/<span class="project-picker-leaf">app<\/span><\/span>/);
  // The files tab's own: activity elsewhere and the hint for a missing worktree list.
  assert.doesNotMatch(render({ layout: "inline", projectActivity: new Map([["lib-key", { running: 1, unread: 0 }]]) }), /project-picker-activity/);
  // The files' boxes keep their paths and notes.
  assert.doesNotMatch(render({ homeDir: "/home/me" }) + render({ layout: "row" }), /project-picker-name|<svg width="12"/);
});

test("row: the files' boxes below the sessions, side by side, with everything the stacked ones have", () => {
  const activity = new Map([["lib-key", { running: 1, unread: 0 }]]);
  const hint = { label: "Open repo root", title: "Open the repository root to manage worktrees." };
  const subdir = { ...context, worktrees: null, currentWorktreePath: null };
  // The same markup as the files tab's but for the layout: the activity
  // dot, the worktree hint, the menus' minimum width.
  for (const props of [{ homeDir: "/home/me" }, { projectActivity: activity }, { context: subdir, worktreeHint: hint }]) {
    const row = render({ ...props, layout: "row" });
    assert.match(row, /^<div class="project-picker is-row" role="group" aria-label="Project and worktree">/);
    assert.equal(row.replace("project-picker is-row", "project-picker is-stacked"), render(props));
  }
  assert.match(render({ layout: "row", projectActivity: activity }), /project-picker-activity/);
  assert.match(render({ layout: "row", context: subdir, worktreeHint: hint }), /project-picker-button is-inactive/);
  // The main checkout's "main" note stays out of the row: there the box is a
  // share of a narrow sidebar, and the branch needs the room (at 180px the
  // note left it none); the icon, in the accent only for a linked checkout,
  // still tells the main one. The tab and the bar keep the note.
  const mainContext = { ...context, currentWorktreePath: "/home/me/work/app" };
  const mainRow = render({ layout: "row", context: mainContext });
  assert.match(mainRow, /class="project-picker-icon"[\s\S]*?<span class="project-picker-path"><span>main<\/span><\/span><span class="project-picker-note">2<\/span><svg/);
  assert.doesNotMatch(mainRow, /project-picker-note">main</);
  assert.doesNotMatch(mainRow, /is-linked/);
  assert.match(render({ context: mainContext }), /<span class="project-picker-note">main<\/span>/);
  assert.doesNotMatch(render({ layout: "inline", context: mainContext }), /project-picker-note/);
});

test("stacked: main's two boxes, the project's whole path and the worktree's branch with its notes", () => {
  const html = render({ homeDir: "/home/me" });
  assert.match(html, /^<div class="project-picker is-stacked" role="group" aria-label="Project and worktree">/);
  // The project box is its path, cut at its left: no folder icon, no name, no chevron.
  assert.match(html, /<button type="button" class="project-picker-button is-project" title="\/home\/me\/work\/app" aria-haspopup="menu" aria-expanded="false"><span class="project-picker-path"><span>~\/work\/app<\/span><\/span><\/button>/);
  assert.doesNotMatch(html, /project-picker-divider|is-name/);
  // A linked checkout: its branch icon in the accent, the branch, how many checkouts there are.
  assert.match(html, /<svg width="11" height="11"[^>]*class="project-picker-icon is-linked"[\s\S]*?<\/svg><span class="project-picker-path"><span>feature\/x<\/span><\/span><span class="project-picker-note">2<\/span><svg width="9" height="9"[^>]*class="project-picker-chevron sidebar-icon-down"/);
  // The main checkout says so, its icon not in the accent.
  const main = render({ context: { ...context, currentWorktreePath: "/home/me/work/app" } });
  assert.match(main, /class="project-picker-icon"[\s\S]*?<span class="project-picker-path"><span>main<\/span><\/span><span class="project-picker-note">main<\/span><span class="project-picker-note">2<\/span>/);
  assert.doesNotMatch(main, /is-linked/);
  // A checkout without a branch shows its path.
  const detached = render({ homeDir: "/home/me", context: { ...context, worktrees: [context.worktrees[0], { ...context.worktrees[1], branch: null }] } });
  assert.match(detached, /<span class="project-picker-path"><span>~\/work\/app-worktrees\/feature<\/span><\/span>/);
  // Without the home folder the path shows as it is.
  assert.match(render(), /<span class="project-picker-path"><span>\/home\/me\/work\/app<\/span><\/span>/);
  assert.doesNotMatch(html, /style=/, "no inline styles");
});

test("a project the user named shows that name in its box, the path as the tooltip", () => {
  const named = { ...context, project: { ...context.project, alias: "Thermal <b>Models</b>" } };
  for (const layout of ["stacked", "row"]) {
    const html = render({ layout, homeDir: "/home/me", context: named });
    assert.match(html, /<button type="button" class="project-picker-button is-project" title="\/home\/me\/work\/app" aria-haspopup="menu" aria-expanded="false"><span class="project-picker-label is-alias">Thermal &lt;b&gt;Models&lt;\/b&gt;<\/span><\/button>/);
    assert.doesNotMatch(html, /~\/work\/app<\/span>/);
  }
  // Inline every project shows a name: this one its own.
  const inline = render({ layout: "inline", homeDir: "/home/me", context: named });
  assert.match(inline, /title="\/home\/me\/work\/app"[^>]*><svg[^>]*>[\s\S]*?<\/svg><span class="project-picker-name"><span class="project-picker-leaf">Thermal &lt;b&gt;Models&lt;\/b&gt;<\/span><\/span>/);
  assert.doesNotMatch(inline, /is-alias|~\/work\/app<\/span>/);
});

test("stacked: activity elsewhere shows a dot; the project in use does not count", () => {
  const elsewhere = render({ projectActivity: new Map([["lib-key", { running: 0, unread: 2 }]]) });
  assert.match(elsewhere, /<span class="project-picker-activity" role="img" title="New activity" aria-label="New activity"><\/span><\/button>/);
  assert.doesNotMatch(render({ projectActivity: new Map([["app-key", { running: 1, unread: 1 }]]) }), /project-picker-activity/);
  assert.doesNotMatch(render({ projectActivity: new Map([["lib-key", { running: 0, unread: 0 }]]) }), /project-picker-activity/);
  // The chips never show it.
  assert.doesNotMatch(render({ layout: "inline", projectActivity: new Map([["lib-key", { running: 1, unread: 0 }]]) }), /project-picker-activity/);
});

test("stacked: no project yet, and no worktree list", () => {
  const empty = render({ context: { project: null, worktrees: null, currentWorktreePath: null, projects: [] }, placeholder: "Select project…" });
  assert.match(empty, /<button type="button" class="project-picker-button is-project is-empty" title="" aria-haspopup="menu" aria-expanded="false">/);
  assert.match(empty, /<span class="project-picker-label">Select project…<\/span>/);
  assert.equal((empty.match(/<button /g) ?? []).length, 1);

  // A subdirectory of a git checkout: a disabled row says why, out of the tab order.
  const hint = { label: "Open repo root", title: "Open the repository root to manage worktrees." };
  const subdir = render({ context: { ...context, worktrees: null, currentWorktreePath: null }, worktreeHint: hint });
  assert.match(subdir, /<button type="button" aria-disabled="true" tabindex="-1" title="Open the repository root to manage worktrees\." class="project-picker-button is-inactive"><svg[^>]*class="project-picker-icon"[\s\S]*?<span class="project-picker-label">Open repo root<\/span><\/button>/);
  assert.equal((subdir.match(/aria-haspopup="menu"/g) ?? []).length, 1, "one menu button");
  // A folder outside git gets no hint from the sidebar: the project box
  // alone, in the tab and in the row, where it takes the whole row.
  for (const layout of ["stacked", "row"]) {
    const plain = render({ layout, context: { ...context, worktrees: null, currentWorktreePath: null } });
    assert.equal((plain.match(/<button /g) ?? []).length, 1, layout);
    assert.doesNotMatch(plain, /is-inactive|project-picker-icon/, layout);
  }
  // The chips have no hint: the project alone.
  assert.doesNotMatch(render({ layout: "inline", context: { ...context, worktrees: null }, worktreeHint: hint }), /is-inactive|project-picker-divider/);
});

test("only the files tab removes worktrees, never the main one", () => {
  assert.match(source, /secondary: onRemoveWorktree && !worktree\.isMain \? \{/);
});

test("client code stays parseable by Safari 16.2 and its CSS flat", () => {
  assert.doesNotMatch(source, /\(\?<[=!]/, "no RegExp lookbehind");
  const rules = css.slice(css.indexOf("/* The project and worktree picker (ProjectWorktreePicker)"), css.indexOf(".file-viewer-icon-button {"));
  assert.ok(rules.length > 0);
  assert.doesNotMatch(rules.replace(/@media[^{]*\{/g, ""), /\{[^}]*\{|&/, "no nested rules");
});

/** The removal body inside the menu surface, as the picker hands it over. */
function removalSurface({ sheet, dirty = true, error = null }) {
  return renderToStaticMarkup(h(I18nProvider, null, h(SidebarMenuSurface, {
    sheet,
    ariaLabel: "Remove feature/x?",
    title: "Remove feature/x?",
    cancelLabel: "Cancel",
    focusCancel: true,
    onActivate: noop,
    onClose: noop,
  }, h(WorktreeRemoveForm, {
    heading: sheet ? null : "Remove feature/x?",
    dirty,
    busy: false,
    error,
    showCancel: !sheet,
    onForce: noop,
    onCancel: noop,
  }))));
}

test("the force question starts on a Cancel on a desktop and in a sheet, never on Force", () => {
  const desktop = removalSurface({ sheet: false });
  assert.equal((desktop.match(/data-sidebar-menu-autofocus=""/g) ?? []).length, 1);
  assert.match(desktop, /<button type="button" class="sidebar-worktree-cancel" data-sidebar-menu-autofocus="">Cancel<\/button>/);
  // The sheet brings its own Cancel, which takes the focus Force would get as the first control.
  const sheet = removalSurface({ sheet: true });
  assert.equal((sheet.match(/data-sidebar-menu-autofocus=""/g) ?? []).length, 1);
  assert.match(sheet, /<button type="button" class="sidebar-worktree-force">Force<\/button>/);
  assert.match(sheet, /<button type="button" class="sidebar-sheet-cancel" data-sidebar-menu-autofocus="">Cancel<\/button><\/div><\/div>$/);
  assert.doesNotMatch(sheet, /sidebar-worktree-cancel/, "one Cancel in the sheet");
  // A failure without the question: the error, and still Cancel first.
  const failed = removalSurface({ sheet: true, dirty: false, error: "locked" });
  assert.doesNotMatch(failed, /sidebar-worktree-force/);
  assert.match(failed, /<div class="sidebar-worktree-error" role="alert">locked<\/div>/);
});
