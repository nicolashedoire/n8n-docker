import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { prepareJobs } from '../lib/prepare-jobs.mjs';

const collectedAt = '2026-10-07T09:00:00.000Z';
const config = { keywords: 'n8n', location: 'France', max_results: 10, priority_terms: 'n8n, automation, automatisation, IA' };
const job = (id, overrides = {}) => ({ title: 'Développeur n8n', company: 'Entreprise exemple', location: 'Paris', url: `https://www.linkedin.com/jobs/view/${id}/`, published_at: '2026-10-06', ...overrides });

test('cleans fields, canonicalizes tracking links and deduplicates by job ID', () => {
  const rows = prepareJobs([
    job('4000000001', { title: '  Développeur\n n8n ', company: ' A\t B ', url: 'https://fr.linkedin.com/jobs/view/developpeur-n8n-4000000001?trackingId=abc' }),
    job('4000000001', { title: 'Même annonce', url: 'https://www.linkedin.com/jobs/view/4000000001/?refId=other' }),
    job('4000000002'),
  ], config, collectedAt);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].titre, 'Développeur n8n');
  assert.equal(rows[0].entreprise, 'A B');
  assert.equal(rows[0].url, 'https://www.linkedin.com/jobs/view/4000000001/');
  assert.equal(rows[0].recherche, 'n8n — France');
  assert.equal(rows[0].collecte_le, collectedAt);
});

test('skips missing required fields without inventing optional fields', () => {
  const rows = prepareJobs([null, {}, job('4000000001', { title: '' }), job('4000000002', { url: '' }), job('4000000003', { company: null, location: undefined, published_at: undefined })], config, collectedAt);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].entreprise, '');
  assert.equal(rows[0].lieu, '');
  assert.equal(rows[0].date_publication, '');
});

test('rejects hostile, non-HTTPS and non-job URLs', () => {
  const urls = [
    'javascript:alert(1)',
    'https://www.linkedin.com.evil.test/jobs/view/4000000001/',
    'https://www.linkedin.com@evil.test/jobs/view/4000000001/',
    'https://evil.test@www.linkedin.com/jobs/view/4000000001/',
    'http://www.linkedin.com/jobs/view/4000000001/',
    'https://www.linkedin.com/in/4000000001/',
    'https://www.linkedin.com:444/jobs/view/4000000001/',
    '//www.linkedin.com/jobs/view/4000000001/',
    'https://www.linkedin.com/jobs/view/not-a-job/',
  ];
  for (const url of urls) {
    assert.throws(() => prepareJobs([job('4000000001', { url })], config, collectedAt), { code: 'NO_USABLE_JOBS' }, url);
  }
});

test('neutralizes spreadsheet formulas in untrusted text', () => {
  const rows = prepareJobs([job('4000000001', {
    title: '\t=HYPERLINK("https://example.invalid")', company: '+SUM(1,2)', location: '@SUM(1,2)',
  }), job('4000000002', { title: '-1+2' })], { ...config, keywords: '=IMPORTXML("x")' }, collectedAt);
  assert.equal(rows[0].titre, '\'=HYPERLINK("https://example.invalid")');
  assert.equal(rows[0].entreprise, "'+SUM(1,2)");
  assert.equal(rows[0].lieu, "'@SUM(1,2)");
  assert.ok(rows[0].recherche.startsWith("'="));
  assert.equal(rows[1].titre, "'-1+2");
});

test('counts unique whole terms in titles only, preserving ties in source order', () => {
  const rows = prepareJobs([
    job('4000000001', { title: 'Social media stagiaire', company: 'n8n IA automation' }),
    job('4000000002', { title: 'Développeur n8n et IA' }),
    job('4000000003', { title: 'Expert N8N N8N' }),
    job('4000000004', { title: 'Automatisation' }),
  ], { ...config, priority_terms: 'n8n, N8N, automation, automatisation, IA' }, collectedAt);
  assert.deepEqual(rows.map(row => row.score_indicatif), [2, 1, 1, 0]);
  assert.equal(rows[0].mots_cles_reperes, 'n8n, IA');
  assert.equal(rows[1].titre, 'Expert N8N N8N');
  assert.equal(rows[2].titre, 'Automatisation');
  assert.equal(rows[3].titre, 'Social media stagiaire');
});

test('caps results after ranking, with limits bounded from one to twenty-five', () => {
  const source = Array.from({ length: 30 }, (_, index) => job(String(4000000000 + index), { title: index === 29 ? 'n8n IA' : 'Développeur' }));
  assert.equal(prepareJobs(source, { ...config, max_results: 999 }, collectedAt).length, 25);
  const one = prepareJobs(source, { ...config, max_results: -4 }, collectedAt);
  assert.equal(one.length, 1);
  assert.equal(one[0].titre, 'n8n IA');
  assert.equal(prepareJobs(source, { ...config, max_results: '3' }, collectedAt).length, 3);
  assert.equal(prepareJobs(source, { ...config, max_results: 'bad' }, collectedAt).length, 10);
});

test('retains valid publication dates and leaves absent or invalid dates empty', () => {
  const dates = ['2026-10-06', '2026-10-05T20:30:00Z', undefined, 'il y a 2 jours', '2026-02-30', '2026-10-05T99:00:00Z'];
  const rows = prepareJobs(dates.map((published_at, index) => job(String(4000000000 + index), { published_at })), config, collectedAt);
  assert.deepEqual(rows.map(row => row.date_publication), ['2026-10-06', '2026-10-05', '', '', '', '']);
});

test('reports unusable data explicitly', () => {
  assert.throws(() => prepareJobs([], config, collectedAt), { code: 'NO_USABLE_JOBS' });
  assert.throws(() => prepareJobs(null, config, collectedAt), { code: 'INVALID_ROWS' });
  assert.throws(() => prepareJobs([job('4000000001')], config, 'invalid'), { code: 'INVALID_COLLECTION_DATE' });
});

test('can be embedded in a Code sandbox without imports or global URL', () => {
  const context = { rows: [job('4000000001')], config, collectedAt, URL: undefined };
  const result = vm.runInNewContext(`(${prepareJobs.toString()})(rows, config, collectedAt)`, context);
  assert.equal(result[0].url, 'https://www.linkedin.com/jobs/view/4000000001/');
  assert.equal(result[0].score_indicatif, 1);
});
