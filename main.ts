// Vice Cover Studio — the entry program (Node 22, standard library only).
//
// The app itself is plain static files under app/: app/index.html opens in a
// desktop browser and works with no network request (its scripts, styles and
// fonts are files under app/, photos are read on the user's own machine).
// This program hands it in: it copies app/ and screenshots/ from beside this
// file into /output and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library (vendor/makefun-app.ts).
//
// Try it locally first with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The program is deterministic: two runs write the same bytes.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of
// app files, in all, or a path under app/ over 1000 bytes: app/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
