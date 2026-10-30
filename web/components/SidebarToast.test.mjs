import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  jsx: { runtime: "automatic" },
  tsconfigPaths: true,
});
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { SidebarToast } = await jiti.import("./SidebarToast.tsx");

const h = React.createElement;

function decode(html) {
  return html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function render(toast) {
  return decode(renderToStaticMarkup(h(SidebarToast, { toast, onDismiss() {}, dismissLabel: "Dismiss" })));
}

test("an empty toast keeps its live region on the page", () => {
  assert.equal(render(null), '<div class="sidebar-toast-region" role="status" aria-live="polite"></div>');
});

test("a toast shows its message, its actions and a labelled dismiss button", () => {
  const html = render({
    id: 3,
    message: "Archived “Fix the flaky test”",
    actions: [
      { id: "undo", label: "Undo", onClick() {} },
      { id: "view", label: "View", onClick() {} },
    ],
  });
  assert.match(html, /^<div class="sidebar-toast-region" role="status" aria-live="polite"><div class="sidebar-toast">/);
  assert.match(html, /<span class="sidebar-toast-message" title="Archived “Fix the flaky test”">Archived “Fix the flaky test”<\/span>/);
  assert.match(html, /<button type="button" class="sidebar-toast-action">Undo<\/button><button type="button" class="sidebar-toast-action">View<\/button>/);
  assert.match(html, /<button type="button" class="sidebar-toast-dismiss" aria-label="Dismiss" title="Dismiss"><svg[^>]*aria-hidden="true"/);
});

test("a toast without actions shows only its message and the dismiss button", () => {
  const html = render({ id: 4, message: "Couldn’t save: locked", actions: [] });
  assert.doesNotMatch(html, /sidebar-toast-action/);
  assert.match(html, /Couldn’t save: locked/);
});

test("a tail renders after the message's head, in a span of its own", () => {
  const html = render({ id: 5, message: "Forked “PR#1030 状态栏命令按钮", tail: " · 3f9a”", actions: [] });
  assert.match(html, /<span class="sidebar-toast-message has-tail" title="Forked “PR#1030 状态栏命令按钮 · 3f9a”"><span class="sidebar-toast-message-head">Forked “PR#1030 状态栏命令按钮<\/span><span class="sidebar-toast-message-tail"> · 3f9a”<\/span><\/span>/);
  // Without one, the message is the plain one-line span.
  assert.doesNotMatch(render({ id: 6, message: "Forked “x”", actions: [] }), /has-tail|sidebar-toast-message-(head|tail)/);
});
