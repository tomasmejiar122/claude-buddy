// Checks that the status line never runs past the terminal width.
// Usage: node design/measure.mjs '{"character":"mr","size":"normal"}'
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const config = JSON.parse(process.argv[2] || '{}');
const script = path.join(path.dirname(import.meta.dirname), 'claude-buddy.mjs');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cb'));
fs.mkdirSync(path.join(home, '.claude'));
const folder = path.join(home, 'proyecto');
fs.mkdirSync(folder);
const key = folder.split(path.sep).join('/').toLowerCase();
fs.writeFileSync(path.join(home, '.claude', 'claude-buddy.json'), JSON.stringify({ projects: { [key]: config } }));
const transcript = path.join(home, 't.jsonl');
fs.writeFileSync(transcript, 'x');

const payload = JSON.stringify({
    session_id: 'measure',
    model: { display_name: 'Opus 5' },
    workspace: { current_dir: folder },
    context_window: { used_percentage: 59 },
    transcript_path: transcript,
});

for (const COLUMNS of ['70', '80', '100', '120', '160']) {
    const out = execFileSync('node', [script], {
        input: payload, encoding: 'utf8',
        env: { ...process.env, USERPROFILE: home, HOME: home, COLUMNS },
    });
    const widths = out.split('\n').filter(Boolean).map((l) => l.replace(/\x1b\[[0-9;]*m/g, '').length);
    const max = Math.max(...widths);
    console.log(`COLUMNS=${COLUMNS.padStart(3)}  ancho impreso=${String(max).padStart(3)}  ` +
        `libre a la derecha=${Number(COLUMNS) - max}  ${max <= Number(COLUMNS) ? 'cabe' : '¡SE PASA!'}`);
}
