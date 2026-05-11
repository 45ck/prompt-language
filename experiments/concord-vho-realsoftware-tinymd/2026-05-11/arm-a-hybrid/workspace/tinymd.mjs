// tinymd skeleton — function bodies start as throw-stubs and get filled
// in by the router from local-model output. The convert orchestrator at
// the bottom is frontier-owned (not routed).

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function parseHeading(line) {
  const match = line.match(/^(#{1,6})\s+(.*)$/);
  if (!match) return null;
  return {
    level: match[1].length,
    text: match[2],
  };
}

export function parseListItem(line) {
  const m = line.match(/^-\s+(.*)$/);
  return m ? m[1] : null;
}

export function isFenceLine(line) {
  return line.startsWith('```');
}

export function parseInline(text) {
  let escaped = escapeHtml(text);

  // Bold: **bold** -> <strong>bold</strong>
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic: *italic* -> <em>italic</em>
  escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Code: `code` -> <code>code</code>
  escaped = escaped.replace(/`(.*?)`/g, '<code>$1</code>');

  // Link: [text](url) -> <a href="url">text</a>
  escaped = escaped.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

  return escaped;
}

export function tokenize(markdown) {
  const lines = markdown.split('\n');
  const tokens = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    if (isFenceLine(line)) {
      const start = i;
      i++;
      while (i < lines.length && !isFenceLine(lines[i])) {
        i++;
      }
      const text = lines.slice(start + 1, i).join('\n');
      tokens.push({ type: 'codeblock', text });
      i++;
      continue;
    }

    const heading = parseHeading(line);
    if (heading) {
      tokens.push({ type: 'heading', level: heading.level, text: heading.text });
      i++;
      continue;
    }

    const listItem = parseListItem(line);
    if (listItem !== null) {
      tokens.push({ type: 'list-item', text: listItem });
      i++;
      continue;
    }

    const start = i;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !isFenceLine(lines[i]) &&
      !parseHeading(lines[i]) &&
      !parseListItem(lines[i])
    ) {
      i++;
    }
    const text = lines.slice(start, i).join(' ');
    tokens.push({ type: 'paragraph', text });
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
  const result = [];
  let i = 0;

  while (i < tokens.length) {
    if (tokens[i].type === 'list-item') {
      const items = [];
      while (i < tokens.length && tokens[i].type === 'list-item') {
        items.push(tokens[i]);
        i++;
      }
      result.push({ type: 'list', items });
    } else {
      result.push(tokens[i]);
      i++;
    }
  }

  return result;
}

// FRONTIER-OWNED: integration / orchestrator
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
