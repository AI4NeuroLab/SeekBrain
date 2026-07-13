#!/usr/bin/env python3

import argparse
import json
import os
import re
import shutil
import subprocess
import sys

# Shared presentation spec applied to BOTH engines so DOCX and PDF match. This
# styles the report document, not the plotted figures.
STYLE = {
    "body_font": "Calibri",
    "mono_font": "Consolas",
    "body_pt": 11,
    "h1_pt": 18,
    "h2_pt": 14,
    "h3_pt": 12,
    "caption_pt": 9.5,
    "heading_rgb": (0x1A, 0x1A, 0x1A),
    "image_width_in": 6.0,
}


# --------------------------------------------------------------------------- #
# Engine detection
# --------------------------------------------------------------------------- #

def _can_import(mod: str) -> bool:
    try:
        __import__(mod)
        return True
    except Exception:
        return False


def detect_engines() -> dict:
    pandoc = shutil.which("pandoc")
    pdf_engine = None
    for cand in ("xelatex", "pdflatex", "wkhtmltopdf", "weasyprint", "tectonic"):
        if shutil.which(cand):
            pdf_engine = cand
            break
    return {
        "pandoc": pandoc,
        "pandoc_pdf_engine": pdf_engine,
        "python_docx": _can_import("docx"),
        "xhtml2pdf": _can_import("xhtml2pdf"),
        "markdown_it": _can_import("markdown_it"),
        "markdown": _can_import("markdown"),
    }


# --------------------------------------------------------------------------- #
# Markdown -> HTML (for the PDF path)
# --------------------------------------------------------------------------- #

def md_to_html_body(md_text: str) -> str:
    if _can_import("markdown_it"):
        from markdown_it import MarkdownIt
        return MarkdownIt("commonmark").enable("table").render(md_text)
    if _can_import("markdown"):
        import markdown as _md
        return _md.markdown(md_text, extensions=["tables", "fenced_code"])
    # Last resort: escape and keep paragraph breaks so a PDF is still legible.
    import html
    esc = html.escape(md_text)
    return "".join(f"<p>{block}</p>" for block in esc.split("\n\n"))


def _css() -> str:
    s = STYLE
    r, g, b = s["heading_rgb"]
    hc = f"#{r:02x}{g:02x}{b:02x}"
    return f"""
    @page {{ size: A4; margin: 2cm; }}
    body {{ font-family: "{s['body_font']}", "DejaVu Sans", sans-serif; font-size: {s['body_pt']}pt; color: #111; line-height: 1.4; }}
    h1 {{ font-size: {s['h1_pt']}pt; font-weight: bold; color: {hc}; margin: 14pt 0 8pt; }}
    h2 {{ font-size: {s['h2_pt']}pt; font-weight: bold; color: {hc}; margin: 12pt 0 6pt; }}
    h3 {{ font-size: {s['h3_pt']}pt; font-weight: bold; color: {hc}; margin: 10pt 0 5pt; }}
    p {{ margin: 4pt 0; }}
    img {{ max-width: 100%; }}
    code, pre {{ font-family: "{s['mono_font']}", monospace; }}
    /* Caption paragraphs: any paragraph that begins with a bold "Figure N." label. */
    """


def export_pdf_xhtml2pdf(md_text: str, out_path: str, base_dir: str, title: str) -> tuple:
    from xhtml2pdf import pisa
    body = md_to_html_body(md_text)
    html = f"<html><head><meta charset='utf-8'><title>{title}</title><style>{_css()}</style></head><body>{body}</body></html>"

    def link_callback(uri, rel):
        if uri.startswith(("http://", "https://", "data:")):
            return uri
        if os.path.isabs(uri):
            return uri
        return os.path.normpath(os.path.join(base_dir, uri))

    warnings = []
    with open(out_path, "wb") as fh:
        status = pisa.CreatePDF(html, dest=fh, link_callback=link_callback, encoding="utf-8")
    if status.err:
        warnings.append(f"xhtml2pdf reported {status.err} error(s); PDF may be incomplete")
    return (True, warnings)


# --------------------------------------------------------------------------- #
# Markdown -> DOCX (line-based renderer; only needs python-docx)
# --------------------------------------------------------------------------- #

_IMG_RE = re.compile(r"^!\[(?P<alt>[^\]]*)\]\((?P<src>[^)]+)\)\s*$")
_INLINE_RE = re.compile(r"(\*\*.+?\*\*|`.+?`|\*.+?\*|\[[^\]]+\]\([^)]+\))")
_LINK_RE = re.compile(r"^\[(?P<text>[^\]]+)\]\((?P<url>[^)]+)\)$")


def _add_inline(paragraph, text, caption=False):
    from docx.shared import Pt
    pos = 0
    for m in _INLINE_RE.finditer(text):
        if m.start() > pos:
            _run(paragraph, text[pos:m.start()], caption=caption)
        tok = m.group(0)
        if tok.startswith("**"):
            _run(paragraph, tok[2:-2], bold=True, caption=caption)
        elif tok.startswith("`"):
            _run(paragraph, tok[1:-1], mono=True, caption=caption)
        elif tok.startswith("["):
            lm = _LINK_RE.match(tok)
            _run(paragraph, lm.group("text") if lm else tok, caption=caption)
        else:
            _run(paragraph, tok[1:-1], italic=True, caption=caption)
        pos = m.end()
    if pos < len(text):
        _run(paragraph, text[pos:], caption=caption)


def _run(paragraph, text, bold=False, italic=False, mono=False, caption=False):
    from docx.shared import Pt
    if not text:
        return
    run = paragraph.add_run(text)
    if bold:
        run.bold = True
    if caption:
        run.font.size = Pt(STYLE["caption_pt"])
        if not bold:
            run.italic = True
    if italic:
        run.italic = True
    if mono:
        run.font.name = STYLE["mono_font"]


def export_docx_pydocx(md_text: str, out_path: str, base_dir: str, title: str) -> tuple:
    from docx import Document
    from docx.shared import Pt, Inches, RGBColor

    doc = Document()
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = STYLE["body_font"]
    normal.font.size = Pt(STYLE["body_pt"])
    rgb = RGBColor(*STYLE["heading_rgb"])
    for name, pt in (("Heading 1", STYLE["h1_pt"]), ("Heading 2", STYLE["h2_pt"]), ("Heading 3", STYLE["h3_pt"])):
        try:
            st = styles[name]
            st.font.size = Pt(pt)
            st.font.bold = True
            st.font.color.rgb = rgb
        except Exception:
            pass

    warnings = []
    lines = md_text.splitlines()
    i = 0
    n = len(lines)
    while i < n:
        raw = lines[i]
        line = raw.rstrip()
        stripped = line.strip()

        if not stripped:
            i += 1
            continue
        if stripped.startswith("<!--") and stripped.endswith("-->"):
            i += 1
            continue

        # Headings
        if stripped.startswith("#"):
            level = len(stripped) - len(stripped.lstrip("#"))
            text = stripped[level:].strip()
            doc.add_heading(text, level=min(max(level, 1), 3))
            i += 1
            continue

        # Standalone image
        img = _IMG_RE.match(stripped)
        if img:
            src = img.group("src")
            path = src if os.path.isabs(src) else os.path.normpath(os.path.join(base_dir, src))
            try:
                doc.add_picture(path, width=Inches(STYLE["image_width_in"]))
            except Exception as exc:
                warnings.append(f"could not embed image '{src}': {exc}")
                p = doc.add_paragraph()
                _run(p, f"[missing figure: {img.group('alt') or src}]", italic=True)
            i += 1
            continue

        # Bullet list
        if stripped.startswith(("- ", "* ")):
            p = doc.add_paragraph(style="List Bullet")
            _add_inline(p, stripped[2:].strip())
            i += 1
            continue

        # Blockquote
        if stripped.startswith("> "):
            p = doc.add_paragraph(style="Intense Quote" if "Intense Quote" in [s.name for s in styles] else "Normal")
            _add_inline(p, stripped[2:].strip())
            i += 1
            continue

        # Paragraph: caption if it begins with a bold "Figure N." label.
        caption = bool(re.match(r"^\*\*Figure\s+\d+", stripped))
        p = doc.add_paragraph()
        _add_inline(p, stripped, caption=caption)
        i += 1

    doc.save(out_path)
    return (True, warnings)


# --------------------------------------------------------------------------- #
# pandoc paths
# --------------------------------------------------------------------------- #

def export_via_pandoc(md_path: str, out_path: str, base_dir: str, extra: list) -> tuple:
    cmd = ["pandoc", md_path, "-o", out_path, "--resource-path", base_dir] + list(extra)
    proc = subprocess.run(cmd, cwd=base_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        return (False, [f"pandoc failed: {proc.stderr.strip()[-500:]}"])
    return (True, [])


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #

def main() -> int:
    ap = argparse.ArgumentParser(description="Export paper_report.md to DOCX/PDF (best-effort).")
    ap.add_argument("--md", required=True, help="path to paper_report.md")
    ap.add_argument("--outdir", help="output directory (default: md's directory)")
    ap.add_argument("--basename", default="paper_report", help="output basename")
    ap.add_argument("--formats", default="docx,pdf", help="comma list: docx,pdf")
    ap.add_argument("--title", default="Analysis Report")
    args = ap.parse_args()

    md_path = os.path.abspath(args.md)
    if not os.path.isfile(md_path):
        print(json.dumps({"ok": False, "error": f"markdown not found: {md_path}"}))
        return 2
    try:
        with open(md_path, "r", encoding="utf-8") as fh:
            md_text = fh.read()
    except Exception as exc:
        print(json.dumps({"ok": False, "error": f"could not read markdown: {exc}"}))
        return 2

    base_dir = os.path.dirname(md_path)
    outdir = os.path.abspath(args.outdir) if args.outdir else base_dir
    os.makedirs(outdir, exist_ok=True)
    formats = [f.strip().lower() for f in args.formats.split(",") if f.strip()]
    engines = detect_engines()

    outputs = {"md": md_path}
    used = {}
    skipped = []
    warnings = []

    if "docx" in formats:
        out = os.path.join(outdir, args.basename + ".docx")
        ok = False
        if engines["pandoc"]:
            ok, w = export_via_pandoc(md_path, out, base_dir, [])
            warnings += w
            if ok:
                used["docx"] = "pandoc"
        if not ok and engines["python_docx"]:
            try:
                ok, w = export_docx_pydocx(md_text, out, base_dir, args.title)
                warnings += w
                if ok:
                    used["docx"] = "python-docx"
            except Exception as exc:
                warnings.append(f"python-docx export failed: {exc}")
        if ok:
            outputs["docx"] = out
        else:
            skipped.append("docx")
            used["docx"] = "skipped"
            warnings.append("DOCX skipped: no working engine (need pandoc or python-docx).")

    if "pdf" in formats:
        out = os.path.join(outdir, args.basename + ".pdf")
        ok = False
        if engines["pandoc"] and engines["pandoc_pdf_engine"]:
            ok, w = export_via_pandoc(md_path, out, base_dir, ["--pdf-engine", engines["pandoc_pdf_engine"]])
            warnings += w
            if ok:
                used["pdf"] = f"pandoc+{engines['pandoc_pdf_engine']}"
        if not ok and engines["xhtml2pdf"]:
            try:
                ok, w = export_pdf_xhtml2pdf(md_text, out, base_dir, args.title)
                warnings += w
                if ok:
                    used["pdf"] = "xhtml2pdf"
            except Exception as exc:
                warnings.append(f"xhtml2pdf export failed: {exc}")
        if ok:
            outputs["pdf"] = out
        else:
            skipped.append("pdf")
            used["pdf"] = "skipped"
            warnings.append("PDF skipped: no working engine (need pandoc+PDF-engine or xhtml2pdf).")

    print(json.dumps({
        "ok": True,
        "outputs": outputs,
        "engines": used,
        "skipped": skipped,
        "warnings": warnings,
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
