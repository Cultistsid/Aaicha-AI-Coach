import React from "react"

// Tiny markdown renderer: handles fenced code blocks, inline code, bold,
// italic, and bullet/numbered lists. Avoids a dependency for what Gemini
// typically returns.

type Block =
  | { kind: "code"; lang: string; body: string }
  | { kind: "text"; body: string }

function tokenize(src: string): Block[] {
  const out: Block[] = []
  const fence = /```([\w-]*)\n([\s\S]*?)```/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = fence.exec(src)) !== null) {
    if (m.index > last) out.push({ kind: "text", body: src.slice(last, m.index) })
    out.push({ kind: "code", lang: m[1] || "", body: m[2].replace(/\n$/, "") })
    last = m.index + m[0].length
  }
  if (last < src.length) out.push({ kind: "text", body: src.slice(last) })
  return out
}

function renderInline(s: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // process inline code first, then bold, then italic
  const parts = s.split(/(`[^`]+`)/g)
  parts.forEach((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      nodes.push(<code key={`c${i}`}>{part.slice(1, -1)}</code>)
      return
    }
    // bold **x** then italic *x*
    const sub: React.ReactNode[] = []
    let rest = part
    let key = 0
    const boldRe = /\*\*([^*]+)\*\*/
    while (true) {
      const bm = boldRe.exec(rest)
      if (!bm) break
      if (bm.index > 0) sub.push(...renderItalics(rest.slice(0, bm.index), `${i}b${key}`))
      sub.push(<strong key={`${i}B${key}`}>{bm[1]}</strong>)
      rest = rest.slice(bm.index + bm[0].length)
      key++
    }
    if (rest) sub.push(...renderItalics(rest, `${i}t${key}`))
    nodes.push(<React.Fragment key={`f${i}`}>{sub}</React.Fragment>)
  })
  return nodes
}

function renderItalics(s: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  // *x* or _x_ — the coach emits both forms.
  const re = /(?<!\*)\*([^*\n]+)\*(?!\*)|(?<![\w_])_([^_\n]+)_(?![\w_])/
  let rest = s
  let n = 0
  while (true) {
    const m = re.exec(rest)
    if (!m) break
    if (m.index > 0) out.push(rest.slice(0, m.index))
    out.push(<em key={`${keyPrefix}i${n}`}>{m[1] ?? m[2]}</em>)
    rest = rest.slice(m.index + m[0].length)
    n++
  }
  if (rest) out.push(rest)
  return out
}

function renderTextBlock(body: string, keyBase: string): React.ReactNode {
  const lines = body.split("\n")
  const out: React.ReactNode[] = []
  let i = 0
  let pi = 0
  while (i < lines.length) {
    const line = lines[i]
    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""))
        i++
      }
      out.push(
        <ul key={`${keyBase}-ul-${pi++}`}>
          {items.map((it, k) => (
            <li key={k}>{renderInline(it)}</li>
          ))}
        </ul>
      )
      continue
    }
    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""))
        i++
      }
      out.push(
        <ol key={`${keyBase}-ol-${pi++}`}>
          {items.map((it, k) => (
            <li key={k}>{renderInline(it)}</li>
          ))}
        </ol>
      )
      continue
    }
    // paragraph: gather until blank line
    const para: string[] = []
    while (i < lines.length && lines[i].trim() !== "" && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
      para.push(lines[i])
      i++
    }
    if (para.length) {
      out.push(
        <p key={`${keyBase}-p-${pi++}`}>
          {para.map((line, k) => (
            <React.Fragment key={k}>
              {renderInline(line)}
              {k < para.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      )
    }
    while (i < lines.length && lines[i].trim() === "") i++
  }
  return <>{out}</>
}

export function Markdown({ children }: { children: string }) {
  const blocks = tokenize(children)
  return (
    <div className="prose-claude">
      {blocks.map((b, i) =>
        b.kind === "code" ? (
          <pre key={i}>
            <code>{b.body}</code>
          </pre>
        ) : (
          <React.Fragment key={i}>{renderTextBlock(b.body, String(i))}</React.Fragment>
        )
      )}
    </div>
  )
}
