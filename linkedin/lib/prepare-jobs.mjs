/**
 * Convert extracted public job cards into deterministic, spreadsheet-safe rows.
 * Kept self-contained so the workflow builder can embed prepareJobs.toString()
 * into an n8n Code node without importing packages or relying on global URL.
 */
export function prepareJobs(rows, config = {}, collectedAt) {
  function fail(code, message) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }

  function clean(value) {
    return typeof value === 'string'
      ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
      : '';
  }

  // A CSV writer quotes delimiters; this additionally prevents spreadsheet
  // software interpreting untrusted text as a formula when the CSV is opened.
  function spreadsheetText(value) {
    const text = clean(value);
    return /^[=+@-]/.test(text) ? `'${text}` : text;
  }

  function tokens(value) {
    return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function canonicalJob(value) {
    if (typeof value !== 'string' || value.length > 2048) return null;
    // Accept only HTTPS LinkedIn job detail links (bare ID or title-ID).
    // Reject credentials, other domains, ports and non-job paths, discard tracking.
    const match = value.trim().match(/^https:\/\/(?:(?:www|[a-z]{2})\.)?linkedin\.com\/jobs\/view\/(?:[^\s/?#]*-)?([0-9]{5,20})\/?(?:[?#][^\s]*)?$/i);
    if (!match) return null;
    return { id: match[1], url: `https://www.linkedin.com/jobs/view/${match[1]}/` };
  }

  function publicationDate(value) {
    const text = clean(value);
    if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(text)) return '';
    const day = text.slice(0, 10);
    const date = new Date(`${day}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) return '';
    if (text.length > 10 && !Number.isFinite(Date.parse(text))) return '';
    return day;
  }

  if (!Array.isArray(rows)) fail('INVALID_ROWS', 'Les annonces extraites doivent être un tableau.');
  if (!config || typeof config !== 'object' || Array.isArray(config)) config = {};
  const collectionDate = typeof collectedAt === 'string' ? new Date(collectedAt) : null;
  if (!collectionDate || !Number.isFinite(collectionDate.getTime())) {
    fail('INVALID_COLLECTION_DATE', 'La date de collecte doit être fournie et valide.');
  }
  const collectionStamp = collectionDate.toISOString();
  const requestedMax = Number(config.max_results);
  const maxResults = Number.isFinite(requestedMax) && config.max_results !== '' && config.max_results != null
    ? Math.min(25, Math.max(1, Math.floor(requestedMax))) : 10;
  const priorities = [];
  const seenTerms = new Set();
  for (const rawTerm of clean(config.priority_terms).split(',')) {
    const term = tokens(rawTerm);
    if (!term || seenTerms.has(term)) continue;
    seenTerms.add(term);
    priorities.push({ term, label: clean(rawTerm) });
  }
  const search = [clean(config.keywords), clean(config.location)].filter(Boolean).join(' — ');
  const seenJobs = new Set();
  const prepared = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const title = clean(row.title);
    const job = canonicalJob(row.url);
    if (!title || !job || seenJobs.has(job.id)) continue;
    seenJobs.add(job.id);
    const titleTokens = ` ${tokens(title)} `;
    const matches = priorities.filter(({ term }) => titleTokens.includes(` ${term} `));
    prepared.push({
      titre: spreadsheetText(title),
      entreprise: spreadsheetText(row.company),
      lieu: spreadsheetText(row.location),
      date_publication: publicationDate(row.published_at),
      url: job.url,
      mots_cles_reperes: spreadsheetText(matches.map(({ label }) => label).join(', ')),
      score_indicatif: matches.length,
      collecte_le: collectionStamp,
      recherche: spreadsheetText(search),
    });
  }
  if (!prepared.length) {
    fail('NO_USABLE_JOBS', 'Aucune annonce exploitable : titre et lien LinkedIn valides requis. Vérifiez la page reçue et les sélecteurs HTML.');
  }
  // Stable sort preserves source order for equal scores. This score counts
  // title keywords only; it is not an assessment of candidate suitability.
  return prepared.sort((a, b) => b.score_indicatif - a.score_indicatif).slice(0, maxResults);
}
