/**
 * Journal metrics, flagship journals, group papers and co-authorship. All of it is worked out
 * from the API at build time, so a new paper or member is handled without extra bookkeeping.
 */

const fold = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** One key per journal, whatever the punctuation: "Earth's Future" = "Earth’s Future". */
export const journalKey = (name) =>
  fold(name)
    .replace(/&amp;/g, '&')
    .replace(/&/g, ' and ')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]/g, '');

const familyKey = (s) => fold(s).replace(/[^a-z]/g, '');

/** "Zhang, Y., Chiew, F. H. S., & Post, D." -> [{ family, initials }] */
export function parseAuthors(authors) {
  const parts = String(authors ?? '')
    .replace(/\s*&\s*/g, ', ')
    .split(/,\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  const out = [];
  for (let i = 0; i < parts.length; i += 1) {
    const next = parts[i + 1]?.replace(/\s+/g, '');
    if (next && /^[A-Z]\.?(?:[.-]*[A-Z]\.?)*$/.test(next)) {
      out.push({ family: parts[i], initials: next.match(/[A-Z]/g), raw: `${parts[i]}, ${parts[i + 1]}` });
      i += 1;
    } else {
      out.push({ family: parts[i], initials: [], raw: parts[i] });
    }
  }
  return out;
}

/** The ways a person can appear in an author list. */
function nameForms(person) {
  const words = String(person.name_en ?? '').trim().split(/\s+/);
  const forms = [];
  if (words.length >= 2) {
    forms.push({ family: familyKey(words.at(-1)), initial: words[0][0].toUpperCase() });
    // "Muhammad Abrar Faiz" is also cited as "Abrar Faiz, M."
    if (words.length >= 3) forms.push({ family: familyKey(words.slice(1).join('')), initial: words[0][0].toUpperCase() });
  }
  for (const alias of person.author_names ?? []) {
    const [a] = parseAuthors(alias);
    if (a?.initials.length) forms.push({ family: familyKey(a.family), initial: a.initials[0] });
  }
  return forms;
}

/** Everyone who is or was in the group, alumni included. */
export function groupRoster(api) {
  const forms = [];
  for (const group of api.people.groups) for (const person of group.members) for (const form of nameForms(person)) forms.push({ ...form, id: person.id });
  return forms;
}

/** The member an author entry refers to, or null. Initials can be shared, so this is a best match. */
const memberOf = (author, roster) =>
  author.initials.length > 0 ? (roster.find((f) => f.family === familyKey(author.family) && f.initial === author.initials[0])?.id ?? null) : null;

/** Each author with the member they match: [{ raw, member }] */
export const markAuthors = (p, roster) => parseAuthors(p.authors).map((a) => ({ raw: a.raw, member: memberOf(a, roster) }));

/** Papers on which a collaborator is an author: same family name and a shared initial. */
export function coauthored(collaborator, publications) {
  const [me] = parseAuthors(collaborator.author_name || '');
  if (!me) return [];
  const family = familyKey(me.family);
  return publications.filter((p) =>
    parseAuthors(p.authors).some((a) => familyKey(a.family) === family && (!me.initials.length || a.initials.some((x) => me.initials.includes(x)))),
  );
}

/** Builds lookups once per build. */
export function scholarly(api) {
  const setting = api.site['site.journal_metrics'] ?? { journals: {}, priority: [] };
  const metrics = new Map(Object.entries(setting.journals ?? {}).map(([name, m]) => [journalKey(name), m]));
  const tiers = (setting.priority ?? []).map((list) => list.map(journalKey));
  const roster = groupRoster(api);

  /** [tier, position] for a flagship journal, or null. Lower sorts first. */
  const priority = (venue) => {
    const key = journalKey(venue);
    for (let t = 0; t < tiers.length; t += 1) {
      const i = tiers[t].indexOf(key);
      if (i >= 0) return [t, i];
    }
    return null;
  };

  return {
    setting,
    roster,
    metrics: (venue) => metrics.get(journalKey(venue)) ?? null,
    priority,
    isFlagship: (p) => priority(p.venue) !== null,
    authors: (p) => markAuthors(p, roster),
  };
}

/** Flagship papers first, by tier, then newest first; within a year, in the tier's journal order. */
export function byPriority(sch) {
  return (a, b) => {
    const [ta, ia] = sch.priority(a.venue) ?? [99, 0];
    const [tb, ib] = sch.priority(b.venue) ?? [99, 0];
    return ta - tb || b.year - a.year || ia - ib || (a.sort_order ?? 0) - (b.sort_order ?? 0);
  };
}
