import { html, raw, safeHref, t } from '../lib/html.mjs';

// Inline artwork keeps profile links available without third-party icon requests.
const icons = {
  scholar: '<path fill="#4285F4" d="M5.242 13.769 0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5c-2.977 0-5.548 1.748-6.758 4.269ZM12 10a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z"/>',
  github: '<path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03A9.58 9.58 0 0 1 12 6.82c.85 0 1.71.12 2.51.34 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/>',
  homepage: '<g fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/></g>',
  email: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></g>',
  researchgate: '<rect width="24" height="24" rx="5" fill="#00A99A"/><text x="4" y="19" fill="#fff" font-family="Georgia,serif" font-size="17">R</text><text x="14" y="10" fill="#fff" font-family="Georgia,serif" font-size="10">G</text>',
  orcid: '<path fill="#A6CE39" d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0Zm-4.631 4.378c.525 0 .947.431.947.947s-.422.947-.947.947a.95.95 0 0 1-.947-.947c0-.525.422-.947.947-.947Zm-.722 3.038h1.444v10.041H6.647V7.416Zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.025-5.325 5.025h-3.919V7.416Zm1.444 1.303v7.444h2.297c3.272 0 4.022-2.484 4.022-3.722 0-2.016-1.284-3.722-4.097-3.722h-2.222Z"/>',
  other: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="m10 13 4-4m-6 2-3 3a4 4 0 0 0 6 6l3-3m-4-7 3-3a4 4 0 0 1 6 6l-3 3"/></g>',
};

function kind(link) {
  const url = new URL(link.url);
  const host = url.hostname.toLowerCase();
  if (url.protocol === 'mailto:') return 'email';
  if (/^scholar\.google\./.test(host)) return 'scholar';
  if (host === 'github.com' || host === 'www.github.com') return 'github';
  if (host === 'orcid.org' || host === 'www.orcid.org') return 'orcid';
  if (host === 'researchgate.net' || host === 'www.researchgate.net') return 'researchgate';
  if (/homepage|website|个人主页|主页|IGSNRR/i.test(link.label)) return 'homepage';
  return 'other';
}

const labels = {
  scholar: ['Google Scholar', 'Google Scholar'],
  github: ['GitHub', 'GitHub'],
  homepage: ['Personal homepage', '个人主页'],
  email: ['Email', '邮箱'],
  researchgate: ['ResearchGate', 'ResearchGate'],
  orcid: ['ORCID', 'ORCID'],
};

export function personLinks(person) {
  const links = [...person.links];
  if (person.email && !links.some((l) => l.url.toLowerCase() === `mailto:${person.email}`.toLowerCase())) {
    links.push({ label: 'Email', url: `mailto:${person.email}` });
  }
  const order = ['scholar', 'github', 'homepage', 'email', 'researchgate', 'orcid', 'other'];
  const entries = links.filter((link) => safeHref(link.url) !== '#').map((link) => ({ ...link, kind: kind(link) }));
  entries.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  if (!entries.length) return '';
  return html`<ul class="person-links">
    ${entries.map((link) => {
      const [en, zh] = labels[link.kind] ?? [link.label, link.label];
      const mail = link.kind === 'email';
      return html`<li><a class="person-links__link person-links__link--${link.kind}" href="${safeHref(link.url)}" ${mail ? '' : raw('target="_blank" rel="noopener noreferrer"')}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${raw(icons[link.kind])}</svg>
        <span class="sr-only">${t(`${person.name_en}: ${en}${mail ? ` (${person.email || link.url.slice(7)})` : ''}`, `${person.name_zh || person.name_en}：${zh}${mail ? `（${person.email || link.url.slice(7)}）` : ''}`)}</span>
        <span class="person-links__tooltip" aria-hidden="true">${t(en, zh)}</span>
      </a></li>`;
    })}
  </ul>`;
}
