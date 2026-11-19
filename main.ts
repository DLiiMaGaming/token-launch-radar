// Token Launch Radar — a token-radar-01 entry (Node 22, standard library only).
//
// One sealed DefiLlama snapshot in, one ranked board out. The program reads
// the snapshot at /input/snapshot.json (or --input <file|dir>), prices every
// pre-token protocol with the comparables model in src/, writes the ranked
// board to /output/board.json, the dashboard's dataset to /output/data.js,
// copies this repository's dashboard/ and screenshots/ into /output, and
// finishes by writing /output/dossier.json — the file the judge reads — with
// the vendored make.fun library, byte for byte as the scorer rebuilds it.
//
// The model is the entry: category multiples are derived from the snapshot's
// own tokenised protocols, never from a list of names, and every board row
// carries the farm plan the dashboard shows.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../kit/input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleBundle } from './src/scoring.ts';
import { BadSnapshot, loadSnapshot } from './src/snapshot.ts';
import { boardFileText, datasetScript, validateBoard } from './src/emit.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The gate's caps, restated here so this program refuses locally what the scorer would refuse remotely. */
const TEXT_CAP_BYTES = 65_536;
const SHOT_CAP = 4;
const SHOT_CAP_BYTES = 524_288;
const DASH_CAP_FILES = 400;
const DASH_CAP_BYTES = 4_194_304;
const PLAIN_FILE = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Fail loudly and early: a graded run that writes a refused board helps no one. */
function fail(message: string): never {
  process.stderr.write(`launch radar: ${message}\n`);
  process.exit(1);
}

/** The value after `--name value` or inside `--name=value`, else the fallback. */
function opt(name: string, fallback: string): string {
  const argv = process.argv;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === `--${name}` && i + 1 < argv.length) return argv[i + 1]!;
    if (a.startsWith(`--${name}=`)) return a.slice(name.length + 3);
  }
  return fallback;
}

const inputOpt = opt('input', '/input');
const snapshotPath = inputOpt.endsWith('.json') ? inputOpt : join(inputOpt, 'snapshot.json');
if (!existsSync(snapshotPath)) {
  fail(`no snapshot at ${snapshotPath}: pass --input <snapshot.json|directory> or mount the sealed /input`);
}
const outDir = opt('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

let snap;
try {
  snap = loadSnapshot(readFileSync(snapshotPath, 'utf8'));
} catch (err) {
  if (err instanceof BadSnapshot) fail(`the snapshot cannot be scored: ${err.message}`);
  throw err;
}
const { board, bundle } = assembleBundle(snap);
const problems = validateBoard(board, snap);
if (problems.length > 0) {
  fail(`the model wrote a board the gate refuses: ${problems.join('; ')}`);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), boardFileText(board));
writeFileSync(join(outDir, 'data.js'), datasetScript(bundle));

/**
 * Copy a directory tree of regular files into `to`, refusing anything the
 * gate would refuse: dot-names, non-plain names, links and nested surprises
 * are reported, never silently shipped. Returns the copied paths, relative
 * to `from`, in walk order.
 */
function copyTree(from: string, to: string, what: string): string[] {
  if (!existsSync(from)) return [];
  const copied: string[] = [];
  const stack: { dir: string; rel: string }[] = [{ dir: from, rel: '' }];
  while (stack.length > 0) {
    const { dir, rel } = stack.pop()!;
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.')) fail(`${what}/${rel}${name}: a name starting with a dot is not shippable`);
      if (!PLAIN_FILE.test(name)) fail(`${what}/${rel}${name}: names are letters, digits and . _ -, 1 to 128 characters`);
      const path = join(dir, name);
      const st = statSync(path);
      if (st.isDirectory()) {
        stack.push({ dir: path, rel: `${rel}${name}/` });
      } else if (st.isFile()) {
        const dest = join(to, rel, name);
        mkdirSync(join(dest, '..'), { recursive: true });
        copyFileSync(path, dest);
        copied.push(`${rel}${name}`);
      } else {
        fail(`${what}/${rel}${name}: not a regular file`);
      }
    }
  }
  return copied;
}

const dashFiles = copyTree(join(here, 'dashboard'), join(outDir, 'dashboard'), 'dashboard');
if (!dashFiles.includes('index.html')) fail('dashboard/ holds no index.html');
if (!dashFiles.some((f) => f.endsWith('.css'))) fail('dashboard/ holds no .css file');
if (!dashFiles.some((f) => f.endsWith('.js'))) fail('dashboard/ holds no .js file');
if (dashFiles.length > DASH_CAP_FILES) fail(`dashboard/ holds ${dashFiles.length} files, over the ${DASH_CAP_FILES} cap`);
const dashBytes = dashFiles.reduce((sum, f) => sum + statSync(join(outDir, 'dashboard', f)).size, 0);
if (dashBytes > DASH_CAP_BYTES) fail(`dashboard/ is ${dashBytes} bytes, over the ${DASH_CAP_BYTES} cap`);
if (dashBytes > TEXT_CAP_BYTES) {
  process.stderr.write(
    `launch radar: warning: dashboard source is ${dashBytes} bytes, past the dossier's ${TEXT_CAP_BYTES}-byte text cap: the judge will read a cut source\n`,
  );
}

const shots = copyTree(join(here, 'screenshots'), join(outDir, 'screenshots'), 'screenshots');
if (shots.length < 3 || shots.length > SHOT_CAP) {
  fail(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3 or 4, the board, a detail view and a filtered view`);
}
for (const name of shots) {
  const size = statSync(join(outDir, 'screenshots', name)).size;
  if (size > SHOT_CAP_BYTES) fail(`screenshots/${name} is ${size} bytes, over the ${SHOT_CAP_BYTES} cap`);
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: TEXT_CAP_BYTES,
    screenshots: { max: SHOT_CAP, max_bytes: SHOT_CAP_BYTES },
    dashboard: { max_files: DASH_CAP_FILES, max_bytes: DASH_CAP_BYTES },
  }),
);

const s = bundle.stats;
process.stdout.write(
  `launch radar: ${s.protocols} protocols scanned, ${s.tokenized} live tokens set aside as comparables, ` +
    `${s.derivativesExcluded} wrapped/staked products excluded, ${board.length} pre-token rows ranked\n` +
    `launch radar: watchlist covered ${s.watchlistCovered}/${s.watchlistSize}; wrote board.json (${board.length} rows), ` +
    `data.js, dashboard/ (${dashFiles.length} files, ${dashBytes} bytes), screenshots/ (${shots.length} images) and dossier.json in ${outDir}\n`,
);
