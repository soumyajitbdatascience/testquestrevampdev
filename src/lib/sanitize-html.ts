/**
 * Allowlist sanitizer for migrated question / option HTML.
 *
 * The content in tq_questions.text and tq_question_options.text is cleaned
 * legacy HTML that still carries real structure we must preserve: presentation
 * MathML, tables, images, sub/superscripts. It must ALWAYS be rendered, never
 * printed as raw tags — so it flows through here first.
 *
 * Everything is rebuilt from tokens against an allowlist: an unknown tag is
 * dropped, an unknown attribute is dropped. Nothing passes through unexamined.
 *
 * Three repairs are applied to known defects in the migrated content:
 *
 *  1. Office OMML (`<m:omath>`, `<m:r>`, …) — Word's math format, which no
 *     browser renders. It almost always wraps the real symbol
 *     (`<m:omath><i>υ</i></m:omath>`), so these tags are UNWRAPPED (tag
 *     dropped, children kept) rather than removed with their subtree.
 *     Affects ~90 questions / ~259 options.
 *  2. Word-paste images (`src="file:///C:/Users/…/msohtmlclip1/…"`) point at
 *     someone's local temp folder and can never load. The <img> is dropped so
 *     it renders as nothing instead of a broken-image icon. ~29 questions.
 *  3. Junk attributes left by the Word export (`cyii`, `erkjggg`, Word's
 *     `id="_x0000_i1025"`) are dropped by the attribute allowlist.
 */

/** Tags kept as-is (with filtered attributes). */
const ALLOWED_TAGS = new Set([
  // text / structure
  "p", "br", "b", "strong", "i", "em", "u", "s", "span", "div",
  "sub", "sup", "ul", "ol", "li", "blockquote", "pre", "code", "hr",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption",
  "img", "a",
  // presentation MathML — browsers render this natively (MathML Core)
  "math", "mrow", "mi", "mn", "mo", "ms", "mtext", "mspace",
  "mfrac", "msqrt", "mroot", "msup", "msub", "msubsup",
  "munder", "mover", "munderover", "mmultiscripts", "mprescripts",
  "mfenced", "menclose", "mpadded", "mphantom", "mstyle", "merror",
  "mtable", "mtr", "mtd", "mlabeledtr", "maction", "semantics",
  "annotation", "annotation-xml", "none",
]);

/**
 * Tags whose own markup is dropped but whose children are kept. Office OMML
 * lives here: unrenderable wrappers around content worth saving.
 */
function isUnwrapped(tag: string): boolean {
  return tag.startsWith("m:") || tag === "font" || tag === "o:p";
}

/** Tags dropped together with everything inside them. */
const VOID_CONTENT_TAGS = new Set(["script", "style", "head", "title", "iframe", "object", "embed"]);

/** Self-closing / void elements that must not emit a closing tag. */
const VOID_TAGS = new Set(["br", "hr", "img", "mspace", "mprescripts", "none"]);

/** Attributes allowed on any element. */
const GLOBAL_ATTRS = new Set(["xmlns", "class"]);

/** Attributes allowed per tag, beyond the global set. */
const TAG_ATTRS: Record<string, Set<string>> = {
  img: new Set(["src", "alt", "width", "height"]),
  a: new Set(["href", "title"]),
  td: new Set(["colspan", "rowspan", "columnalign"]),
  th: new Set(["colspan", "rowspan", "columnalign"]),
  table: new Set(["border", "cellpadding", "cellspacing"]),
  math: new Set(["display", "displaystyle", "mathvariant", "altimg", "alttext"]),
  mfenced: new Set(["open", "close", "separators"]),
  menclose: new Set(["notation"]),
  mfrac: new Set(["bevelled", "linethickness"]),
  mo: new Set(["stretchy", "fence", "separator", "largeop", "movablelimits", "linebreak"]),
  mspace: new Set(["width", "height", "depth"]),
  mstyle: new Set(["displaystyle", "scriptlevel", "mathvariant"]),
  annotation: new Set(["encoding"]),
  "annotation-xml": new Set(["encoding"]),
};

/** Every MathML element may carry mathvariant / displaystyle. */
const MATHML_COMMON = new Set(["mathvariant", "displaystyle", "dir"]);

function isSafeUrl(raw: string): boolean {
  const url = raw.trim();
  // Word-paste local paths can never resolve — drop the element entirely.
  if (/^file:/i.test(url)) return false;
  if (/^data:image\//i.test(url)) return true;
  if (/^https:\/\//i.test(url)) return true;
  if (/^\/\//.test(url)) return false;
  // Relative paths in this content are legacy-host leftovers, not app assets.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false;
  return false;
}

function filterAttributes(tag: string, rawAttrs: string): string | null {
  const allowed = TAG_ATTRS[tag];
  const isMath = tag === "math" || tag.startsWith("m") && ALLOWED_TAGS.has(tag);
  const out: string[] = [];

  const attrRe = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))|([a-zA-Z_:][\w:.-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(rawAttrs)) !== null) {
    const name = (m[1] ?? m[5] ?? "").toLowerCase();
    if (!name) continue;
    const value = m[2] ?? m[3] ?? m[4] ?? "";

    // Never allow event handlers or style, whatever the tag.
    if (name.startsWith("on") || name === "style") continue;

    const permitted =
      GLOBAL_ATTRS.has(name) ||
      allowed?.has(name) ||
      (isMath && MATHML_COMMON.has(name)) ||
      name.startsWith("data-");
    if (!permitted) continue;

    if ((name === "src" || name === "href") && !isSafeUrl(value)) {
      // An image whose source can never load is worse than no image.
      if (tag === "img") return null;
      continue;
    }

    out.push(`${name}="${escapeAttr(value)}"`);
  }
  return out.length ? " " + out.join(" ") : "";
}

/**
 * Escapes only what can break out of a double-quoted attribute value.
 *
 * `<` and `>` are inert inside quotes and are deliberately left alone — some
 * `data-latex` values legitimately contain them (`frac {-3} {-5}<frac {17}`),
 * and escaping them would re-escape on every subsequent pass. `&` is escaped
 * only when it does not already begin an entity, which is what keeps this
 * idempotent over content that already contains `&amp;`.
 */
function escapeAttr(v: string): string {
  return v.replace(/&(?!#?[a-zA-Z0-9]+;)/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Sanitizes migrated question HTML. Returns markup safe to inject with
 * dangerouslySetInnerHTML. Idempotent — running it twice changes nothing.
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";

  let out = "";
  let i = 0;
  // Stack of emitted open tags, so we only close what we actually opened.
  const openStack: string[] = [];
  let skipUntil: string | null = null;

  // The attribute section skips over quoted regions, so a value containing
  // `>` (as `data-latex` sometimes does) doesn't truncate the tag early.
  const tagRe = /<\s*(\/?)\s*([a-zA-Z_][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(input)) !== null) {
    const [full, closing, rawName, rawAttrsRaw] = match;
    const tag = rawName.toLowerCase();
    const selfClose = /\/\s*$/.test(rawAttrsRaw);
    const rawAttrs = selfClose ? rawAttrsRaw.replace(/\/\s*$/, "") : rawAttrsRaw;

    // Text before this tag
    const text = input.slice(i, match.index);
    if (!skipUntil && text) out += text;
    i = match.index + full.length;

    // Inside a dropped subtree (<script>…</script>) — wait for its close tag.
    if (skipUntil) {
      if (closing && tag === skipUntil) skipUntil = null;
      continue;
    }

    if (VOID_CONTENT_TAGS.has(tag)) {
      if (!closing && !selfClose) skipUntil = tag;
      continue;
    }

    // OMML and other wrappers: drop the tag, keep the children.
    if (isUnwrapped(tag)) continue;

    if (!ALLOWED_TAGS.has(tag)) continue;

    if (closing) {
      const idx = openStack.lastIndexOf(tag);
      if (idx !== -1) {
        // Close anything left open inside it, innermost first.
        for (let k = openStack.length - 1; k >= idx; k--) out += `</${openStack[k]}>`;
        openStack.length = idx;
      }
      continue;
    }

    const attrs = filterAttributes(tag, rawAttrs);
    if (attrs === null) continue; // element rejected (e.g. unloadable image)

    if (VOID_TAGS.has(tag) || selfClose) {
      out += `<${tag}${attrs} />`;
    } else {
      out += `<${tag}${attrs}>`;
      openStack.push(tag);
    }
  }

  const tail = input.slice(i);
  if (!skipUntil && tail) out += tail;
  for (let k = openStack.length - 1; k >= 0; k--) out += `</${openStack[k]}>`;

  return out;
}

/**
 * Plain-text projection of question HTML — for search snippets, table sorting,
 * alt text and anywhere markup would be noise. Collapses whitespace.
 */
export function htmlToText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the HTML still carries Office OMML we could not render properly. */
export function hasUnrenderableMath(input: string | null | undefined): boolean {
  return !!input && /<\s*m:/i.test(input);
}

/** True when the HTML references an image that can never load. */
export function hasDeadImage(input: string | null | undefined): boolean {
  return !!input && /<img[^>]+src\s*=\s*["']?file:/i.test(input);
}
