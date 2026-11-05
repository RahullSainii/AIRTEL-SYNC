// Copies self-hosted OCR runtime files and the specimen KYC documents into /public so the
// prototype works without a CDN. Runs before dev and build.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (!fs.existsSync(to) || fs.statSync(to).size !== fs.statSync(from).size) fs.copyFileSync(from, to);
};
const tjs = path.dirname(require.resolve('tesseract.js/package.json'));
copy(path.join(tjs, 'dist/worker.min.js'), 'public/ocr/worker.min.js');
const core = path.dirname(require.resolve('tesseract.js-core/package.json', { paths: [tjs] }));
for (const f of fs.readdirSync(core)) if (/^tesseract-core-(simd-)?lstm\.wasm\.js$/.test(f)) copy(path.join(core, f), path.join('public/ocr/core', f));
const specimens = 'YTL_TrackA_Udyam_Digital_Data/kyc_documents';
if (fs.existsSync(specimens)) for (const f of fs.readdirSync(specimens)) copy(path.join(specimens, f), path.join('public/specimens', f));
console.log('assets ready');
