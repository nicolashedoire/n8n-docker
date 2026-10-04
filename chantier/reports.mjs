import { randomBytes } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderStudyPdf } from './pdf-report.mjs';

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const unavailable = () => ({ status: 'unavailable', message: 'Le calcul est disponible, mais le PDF n’a pas pu être créé. Aucun lien de téléchargement n’est disponible.' });

/** Local report snapshots. IDs and filenames are never chosen by the model or caller. */
export function createReportStore({ reportDir, reportPublicBaseUrl = 'http://localhost:8788',
  renderReport = renderStudyPdf, reportTimeoutMs = 8000, now = () => new Date() } = {}) {
  const directory = reportDir ? resolve(reportDir) : null;
  const base = new URL(reportPublicBaseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Adresse des rapports invalide.');
  let inFlight = 0;
  return {
    async create({ input, estimate, catalog }) {
      if (!['ok', 'partial'].includes(estimate.status) || !estimate.lines?.length) {
        return { status: 'not_available', message: 'Un calcul de matériaux est nécessaire avant de produire un PDF.' };
      }
      if (!directory || inFlight >= 2) return unavailable();
      inFlight++;
      const id = randomBytes(16).toString('hex');
      const createdAt = now().toISOString();
      const filename = `etude-materiaux-${id}.pdf`;
      const pdfPath = resolve(directory, `${id}.pdf`);
      const snapshotPath = resolve(directory, `${id}.json`);
      let timer;
      const createdFiles = [];
      async function writeNew(file, data) {
        const handle = await open(file, 'wx', 0o600);
        createdFiles.push(file);
        try { await handle.writeFile(data); } finally { await handle.close(); }
      }
      try {
        // A timed-out render retains its slot until it actually settles.
        const rendering = Promise.resolve()
          .then(() => renderReport({ estimate: structuredClone(estimate), catalog: structuredClone(catalog), reportId: id, generatedAt: createdAt }))
          .finally(() => { inFlight--; });
        const pdf = await Promise.race([
          rendering,
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('report_timeout')), Math.min(8000, Math.max(1, reportTimeoutMs))); }),
        ]);
        clearTimeout(timer);
        if (!Buffer.isBuffer(pdf) || pdf.length > MAX_PDF_BYTES || !pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('invalid_report');
        await mkdir(directory, { recursive: true, mode: 0o700 });
        const snapshot = { schema_version: 1, report_id: id, generated_at: createdAt, input, estimate, catalog };
        await writeNew(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');
        await writeNew(pdfPath + '.tmp', pdf);
        await rename(pdfPath + '.tmp', pdfPath);
        return { status: 'ready', url: new URL(`/reports/${id}.pdf`, base).href, filename, created_at: createdAt };
      } catch {
        // Only this failed creation's files can be removed; existing reports stay intact.
        await Promise.allSettled(createdFiles.map(file => unlink(file)));
        return unavailable();
      } finally { clearTimeout(timer); }
    },
    async read(pathname) {
      const match = /^\/reports\/([a-f0-9]{32})\.pdf$/.exec(pathname);
      if (!directory || !match) return null;
      try {
        const pdf = await readFile(resolve(directory, `${match[1]}.pdf`));
        return { pdf, filename: `etude-materiaux-${match[1]}.pdf` };
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
  };
}
