#!/usr/bin/env node

import { createRequire } from "node:module";
import { existsSync, readFileSync, createWriteStream, mkdirSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(packageRoot, "package.json"));
const PDFDocument = require("pdfkit");
const markedPath = require.resolve("marked");
const markedModule = await import(pathToFileURL(markedPath).href);
const lexer = markedModule.lexer || markedModule.marked?.lexer;

const markdownArg = process.argv[2];
if (!markdownArg) {
  console.error("Usage: seekbrain-pdf <report.md> [--output <report.pdf>]");
  process.exit(2);
}

const markdownPath = resolve(process.cwd(), markdownArg);
const briefCommunication = process.argv.includes("--brief-communication");
if (!existsSync(markdownPath)) {
  console.error(`Markdown report not found: ${markdownPath}`);
  process.exit(2);
}
const outputIndex = process.argv.indexOf("--output");
if (outputIndex !== -1 && (!process.argv[outputIndex + 1] || process.argv[outputIndex + 1].startsWith("--"))) { console.error("--output requires a PDF path"); process.exit(2); }
const outputPath = outputIndex === -1 ? join(dirname(markdownPath), `${basename(markdownPath, extname(markdownPath))}.pdf`) : resolve(process.cwd(), process.argv[outputIndex + 1]);
if (outputPath === markdownPath) { console.error("PDF output must differ from the Markdown input"); process.exit(2); }
mkdirSync(dirname(outputPath), { recursive: true });
const markdown = readFileSync(markdownPath, "utf8");
const tokens = lexer(markdown);
const titleToken = tokens.find((token) => token.type === "heading" && token.depth === 1);
const documentTitle = String(titleToken?.text || basename(markdownPath, extname(markdownPath))).replace(/[*_`]/g, "").trim();

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 68, right: 68, bottom: 68, left: 68 },
  info: { Title: documentTitle, Author: "SeekBrain Report Agent", Creator: "SeekBrain", Subject: "Scientific report" },
  bufferPages: true,
  autoFirstPage: true,
});
const output = createWriteStream(outputPath);
doc.pipe(output);

function resolveOptionalFont(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    try {
      const path = isAbsolute(candidate) ? candidate : require.resolve(candidate);
      if (existsSync(path)) return path;
    } catch {}
  }
  return undefined;
}

const stixRegular = resolveOptionalFont([
  process.env.SEEKBRAIN_PDF_BODY_FONT,
  join(packageRoot, "assets/fonts/STIXGeneral.ttf"),
]);
const stixBold = resolveOptionalFont([
  process.env.SEEKBRAIN_PDF_BODY_BOLD_FONT,
  join(packageRoot, "assets/fonts/STIXGeneralBol.ttf"),
]);
const stixItalic = resolveOptionalFont([
  process.env.SEEKBRAIN_PDF_BODY_ITALIC_FONT,
  join(packageRoot, "assets/fonts/STIXGeneralItalic.ttf"),
]);
const stixBoldItalic = resolveOptionalFont([
  process.env.SEEKBRAIN_PDF_BODY_BOLD_ITALIC_FONT,
  join(packageRoot, "assets/fonts/STIXGeneralBolIta.ttf"),
]);
if (stixRegular) doc.registerFont("SeekBrain-STIX", stixRegular);
if (stixBold) doc.registerFont("SeekBrain-STIX-Bold", stixBold);
if (stixItalic) doc.registerFont("SeekBrain-STIX-Italic", stixItalic);
if (stixBoldItalic) doc.registerFont("SeekBrain-STIX-BoldItalic", stixBoldItalic);

const fonts = {
  body: stixRegular ? "SeekBrain-STIX" : "Times-Roman",
  bold: stixBold ? "SeekBrain-STIX-Bold" : "Times-Bold",
  italic: stixItalic ? "SeekBrain-STIX-Italic" : "Times-Italic",
  boldItalic: stixBoldItalic ? "SeekBrain-STIX-BoldItalic" : "Times-BoldItalic",
  heading: "Helvetica-Bold",
  sans: "Helvetica",
  mono: "Courier",
};
const textWidth = () => doc.page.width - doc.page.margins.left - doc.page.margins.right;
const pageBottom = () => doc.page.height - doc.page.margins.bottom;
const ensureSpace = (height) => { if (doc.y + height > pageBottom()) doc.addPage(); };
const stripHtml = (value = "") => String(value).replace(/<!--[^]*?-->/g, "").replace(/<[^>]+>/g, "");
const plain = (value = "") => stripHtml(value)
  .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/[*_~`]/g, "")
  .trim();

function fontFor(style = {}) {
  if (style.code) return fonts.mono;
  if (style.bold && style.italic) return fonts.boldItalic;
  if (style.bold) return fonts.bold;
  if (style.italic) return fonts.italic;
  return fonts.body;
}

function inlineRuns(tokensToRender = [], style = {}) {
  const runs = [];
  for (const token of tokensToRender || []) {
    if (token.type === "text" || token.type === "escape") {
      if (token.tokens?.length) runs.push(...inlineRuns(token.tokens, style));
      else runs.push({ text: stripHtml(token.text || token.raw || ""), style });
    } else if (token.type === "strong") runs.push(...inlineRuns(token.tokens, { ...style, bold: true }));
    else if (token.type === "em") runs.push(...inlineRuns(token.tokens, { ...style, italic: true }));
    else if (token.type === "codespan") runs.push({ text: token.text || "", style: { ...style, code: true } });
    else if (token.type === "link") runs.push(...inlineRuns(token.tokens, { ...style, link: token.href }));
    else if (token.type === "br") runs.push({ text: "\n", style });
    else if (token.type !== "image") runs.push({ text: plain(token.text || token.raw || ""), style });
  }
  return runs.filter((run) => run.text);
}

function writeRuns(runs, options = {}) {
  if (!runs.length) return;
  const size = options.size || 10.7;
  const width = options.width || textWidth();
  doc.fontSize(size).fillColor(options.color || "#202124");
  runs.forEach((run, index) => {
    doc.font(fontFor(run.style));
    doc.fillColor(run.style?.link ? "#1f4e79" : options.color || "#202124");
    doc.text(run.text, {
      width,
      align: options.align || "justify",
      lineGap: options.lineGap ?? 1.25,
      continued: index < runs.length - 1,
      link: run.style?.link,
      underline: Boolean(run.style?.link),
    });
  });
  doc.fillColor("#202124");
  doc.moveDown(options.paragraphGap ?? 0.3);
}

function writeParagraph(token, options = {}) {
  const runs = token.tokens?.length ? inlineRuns(token.tokens) : [{ text: plain(token.text || ""), style: {} }];
  writeRuns(runs, options);
}

function writeHeading(token) {
  const depth = Number(token.depth || 2);
  const settings = depth === 1
    ? { size: briefCommunication ? 20 : 22, before: 0, after: 0.8, align: briefCommunication ? "left" : "center" }
    : depth === 2 ? { size: 14, before: 0.9, after: 0.35, align: "left" }
      : { size: 11.5, before: 0.65, after: 0.25, align: "left" };
  ensureSpace(depth === 1 ? 74 : 46);
  if (settings.before) doc.moveDown(settings.before);
  doc.font(fonts.heading).fontSize(settings.size).fillColor("#111111")
    .text(plain(token.text), { width: textWidth(), align: settings.align, lineGap: 1.5 });
  doc.moveDown(settings.after);
}

function imageInfo(href) {
  if (!href || /^(?:https?:|data:)/i.test(href)) return undefined;
  const path = isAbsolute(href) ? href : resolve(dirname(markdownPath), decodeURIComponent(href));
  if (!existsSync(path)) return undefined;
  try {
    const image = doc.openImage(path);
    const maxHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 76;
    const scale = Math.min(1, textWidth() / image.width, maxHeight / image.height);
    return { path, width: image.width * scale, height: image.height * scale };
  } catch (error) {
    console.warn(`Skipping unsupported image '${path}': ${String(error)}`);
    return undefined;
  }
}

function writeImage(token, captionToken) {
  const info = imageInfo(token.href);
  if (!info) return false;
  const captionHeight = captionToken ? 70 : 24;
  ensureSpace(info.height + captionHeight);
  const x = doc.page.margins.left + (textWidth() - info.width) / 2;
  doc.image(info.path, x, doc.y, { width: info.width, height: info.height });
  doc.y += info.height + 7;
  if (captionToken) writeParagraph(captionToken, { size: 9, align: "left", lineGap: 1.5, paragraphGap: 0.7, color: "#333333" });
  else if (token.text) writeRuns([{ text: plain(token.text), style: { italic: true } }], { size: 9, align: "center", color: "#444444" });
  return true;
}

function writeList(token) {
  for (let index = 0; index < token.items.length; index += 1) {
    const item = token.items[index];
    const marker = token.ordered ? `${Number(token.start || 1) + index}.` : "•";
    ensureSpace(24);
    doc.font(fonts.body).fontSize(10.5).fillColor("#202124").text(marker, doc.page.margins.left + 7, doc.y, { width: 18 });
    const itemY = doc.y - doc.currentLineHeight();
    doc.y = itemY;
    const runs = item.tokens?.length ? inlineRuns(item.tokens.flatMap((child) => child.tokens || [child])) : [{ text: plain(item.text), style: {} }];
    doc.x = doc.page.margins.left + 27;
    writeRuns(runs, { size: 10.5, width: textWidth() - 27, align: "left", paragraphGap: 0.25 });
    doc.x = doc.page.margins.left;
  }
  doc.moveDown(0.25);
}

function cellText(cell) {
  return plain(cell?.text ?? cell ?? "");
}

function writeTable(token) {
  const rows = [token.header, ...token.rows];
  if (!rows.length) return;
  const columns = Math.max(1, ...rows.map((row) => row.length));
  const columnWidth = textWidth() / columns;
  const padding = 4;
  const renderRow = (row, header = false) => {
    doc.font(header ? fonts.heading : fonts.body).fontSize(header ? 8.7 : 8.5);
    const heights = Array.from({ length: columns }, (_, index) => doc.heightOfString(cellText(row[index]), { width: columnWidth - padding * 2, lineGap: 1 }));
    const height = Math.max(20, ...heights) + padding * 2;
    if (doc.y + height > pageBottom()) {
      doc.addPage();
      if (!header) renderRow(token.header, true);
    }
    const y = doc.y;
    for (let index = 0; index < columns; index += 1) {
      const x = doc.page.margins.left + index * columnWidth;
      doc.rect(x, y, columnWidth, height).fillAndStroke(header ? "#E9ECEF" : "#FFFFFF", "#AEB4BA");
      doc.fillColor("#202124").font(header ? fonts.heading : fonts.body).fontSize(header ? 8.7 : 8.5)
        .text(cellText(row[index]), x + padding, y + padding, { width: columnWidth - padding * 2, lineGap: 1, align: "left" });
    }
    doc.y = y + height;
    doc.x = doc.page.margins.left;
  };
  rows.forEach((row, index) => renderRow(row, index === 0));
  doc.moveDown(0.65);
}

let reportSection = "";
let afterMainText = false;
for (let index = 0; index < tokens.length; index += 1) {
  const token = tokens[index];
  if (briefCommunication && token.type === "html") {
    const marker = /seekbrain:(abstract|main|displays|references|end)/.exec(token.raw || "");
    if (marker) reportSection = marker[1];
    if (reportSection === "main") {
      const paragraphs = [];
      while (index + 1 < tokens.length && !/seekbrain:(displays|references|end)/.test(tokens[index + 1].raw || "")) {
        index++;
        if (tokens[index].type !== "space") paragraphs.push(plain(tokens[index].text || tokens[index].raw || ""));
      }
      const width = textWidth();
      doc.font(fonts.body).fontSize(10.3).fillColor("#202124")
        .text(paragraphs.join("\n\n"), doc.page.margins.left, doc.y, { width, columns: 2, columnGap: 20, align: "justify", lineGap: 1.4 });
      afterMainText = true;
    }
    continue;
  }
  if (token.type === "space" || token.type === "html") continue;
  if (afterMainText) { doc.addPage(); afterMainText = false; }
  if (token.type === "heading") { writeHeading(token); continue; }
  if (token.type === "paragraph") {
    if (briefCommunication && reportSection === "abstract") {
      const runs = inlineRuns(token.tokens || [], { bold: true });
      writeRuns(runs, { size: 11, align: "left", paragraphGap: 0.9 });
      continue;
    }
    const imageToken = token.tokens?.length === 1 && token.tokens[0]?.type === "image" ? token.tokens[0] : null;
    if (imageToken) {
      let captionIndex = index + 1;
      while (tokens[captionIndex]?.type === "space") captionIndex++;
      const next = tokens[captionIndex];
      const caption = next?.type === "paragraph" && /^\s*(?:\*\*)?Figure\s+\d+/i.test(String(next.raw || next.text || "")) ? next : undefined;
      if (writeImage(imageToken, caption)) { if (caption) index = captionIndex; continue; }
    }
    writeParagraph(token);
    continue;
  }
  if (token.type === "blockquote") {
    ensureSpace(32);
    const x = doc.page.margins.left;
    doc.moveTo(x, doc.y).lineTo(x, doc.y + 24).lineWidth(2).strokeColor("#8A8F94").stroke();
    doc.x = x + 12;
    writeRuns([{ text: plain(token.text), style: { italic: true } }], { width: textWidth() - 12, color: "#4B4F52", align: "left" });
    doc.x = x;
    continue;
  }
  if (token.type === "list") { writeList(token); continue; }
  if (token.type === "table") { writeTable(token); continue; }
  if (token.type === "code") {
    ensureSpace(42);
    doc.font(fonts.mono).fontSize(8.3).fillColor("#2F3337").text(token.text || "", { width: textWidth(), lineGap: 1, align: "left" });
    doc.moveDown(0.6);
    continue;
  }
  if (token.type === "hr") {
    ensureSpace(18);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).lineWidth(0.5).strokeColor("#9AA0A6").stroke();
    doc.moveDown(0.8);
    continue;
  }
  if (typeof token.text === "string") writeRuns([{ text: plain(token.text), style: {} }]);
}

const range = doc.bufferedPageRange();
for (let index = range.start; index < range.start + range.count; index += 1) {
  doc.switchToPage(index);
  const pageNumber = index - range.start + 1;
  if (pageNumber > 1) {
    doc.font(fonts.sans).fontSize(7.5).fillColor("#666666")
      .text(documentTitle, doc.page.margins.left, 34, { width: textWidth() - 50, ellipsis: true, lineBreak: false });
  }
  doc.font(fonts.sans).fontSize(8).fillColor("#666666");
  // Render inside the lower margin, outside the body columns, without starting a new page.
  const bottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.text(String(pageNumber), doc.page.margins.left, doc.page.height - 40, { width: textWidth(), align: "center", lineBreak: false });
  doc.page.margins.bottom = bottomMargin;
}

doc.end();
await new Promise((resolvePromise, reject) => {
  output.on("finish", resolvePromise);
  output.on("error", reject);
});
console.log(outputPath);
