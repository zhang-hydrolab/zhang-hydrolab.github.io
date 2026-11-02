import { escapeHtml, raw, safeHref } from './html.mjs';

/** Inline markdown over already-escaped text. Raw HTML in content stays inert. */
function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
      const href = safeHref(url.replaceAll('&amp;', '&'));
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${label}</a>`;
    });
}

/**
 * Small, safe Markdown subset for news articles: headings, paragraphs, lists,
 * quotes, emphasis, links and `![alt](media:id)` figures.
 */
export function renderMarkdown(source, renderFigure = () => '') {
  const out = [];
  for (const block of source.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)) {
    const figure = block.match(/^!\[([^\]]*)\]\(media:([0-9a-f]{16})\)$/);
    if (figure) {
      out.push(String(renderFigure(figure[2], figure[1])));
      continue;
    }
    const heading = block.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
      continue;
    }
    if (/^[-*]\s/.test(block)) {
      const items = block.split('\n').map((line) => `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (block.startsWith('>')) {
      out.push(`<blockquote>${inline(block.replace(/^>\s?/gm, ''))}</blockquote>`);
      continue;
    }
    out.push(`<p>${inline(block.replace(/\n/g, ' '))}</p>`);
  }
  return raw(out.join('\n'));
}
