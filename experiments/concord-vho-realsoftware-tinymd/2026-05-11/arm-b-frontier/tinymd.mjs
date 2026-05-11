// tinymd — frontier-only baseline. Markdown subset → HTML.
// Written in one pass before any local routing.

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function parseHeading(line) {
  const m = line.match(/^(#{1,6})\s+(.*)$/);
  if (!m) return null;
  return { level: m[1].length, text: m[2] };
}

export function parseListItem(line) {
  const m = line.match(/^-\s+(.*)$/);
  if (!m) return null;
  return m[1];
}

export function isFenceLine(line) {
  return /^```/.test(line);
}

export function parseInline(text) {
  let s = escapeHtml(text);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

export function tokenize(markdown) {
  const lines = markdown.split('\n');
  const tokens = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    if (isFenceLine(line)) {
      const start = i + 1;
      let end = start;
      while (end < lines.length && !isFenceLine(lines[end])) end++;
      tokens.push({ type: 'codeblock', text: lines.slice(start, end).join('\n') });
      i = end + 1;
      continue;
    }
    const h = parseHeading(line);
    if (h) {
      tokens.push({ type: 'heading', level: h.level, text: h.text });
      i++;
      continue;
    }
    const li = parseListItem(line);
    if (li !== null) {
      tokens.push({ type: 'list-item', text: li });
      i++;
      continue;
    }
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !isFenceLine(lines[i]) &&
      !parseHeading(lines[i]) &&
      parseListItem(lines[i]) === null
    ) {
      para.push(lines[i]);
      i++;
    }
    tokens.push({ type: 'paragraph', text: para.join(' ') });
  }
  return tokens;
}

export function renderToken(token) {
  switch (token.type) {
    case 'heading':
      return `<h${token.level}>${parseInline(token.text)}</h${token.level}>`;
    case 'paragraph':
      return `<p>${parseInline(token.text)}</p>`;
    case 'codeblock':
      return `<pre><code>${escapeHtml(token.text)}</code></pre>`;
    case 'list-item':
      return `<li>${parseInline(token.text)}</li>`;
    default:
      return '';
  }
}

export function groupListTokens(tokens) {
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i].type === 'list-item') {
      const items = [];
      while (i < tokens.length && tokens[i].type === 'list-item') {
        items.push(tokens[i]);
        i++;
      }
      out.push({ type: 'list', items });
    } else {
      out.push(tokens[i]);
      i++;
    }
  }
  return out;
}

export function convert(markdown) {
  const tokens = tokenize(markdown);
  const grouped = groupListTokens(tokens);
  return grouped
    .map((t) => {
      if (t.type === 'list') {
        return `<ul>\n${t.items.map(renderToken).join('\n')}\n</ul>`;
      }
      return renderToken(t);
    })
    .join('\n');
}
