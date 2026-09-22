// claude-buddy — https://github.com/tomasmejiar122/claude-buddy
// Claude Code status line: session info on the left (fixed) and a pixel-art
// character on the right, 7 lines tall.
//
// Which character shows up in a folder (~/.claude/claude-buddy.json):
//   { "projects": { "C:/code/api": "gato" },   // set with /buddy
//     "mrIrrelevant": ["C:/work"],             // folders that always get Mr
//     "mode": "buddies" }                      // "buddies" = a character per
//                                              // folder instead of Mr
// Without that file Mr Irrelevant shows up everywhere. "auto" picks a
// character from a hash of the folder name, so a project always keeps its own.
//
// Everyone stands calmly, blinks now and then, waves from time to time and
// celebrates while Claude works; they get darker as the context fills up.
// Animated through statusLine.refreshInterval in settings.json; the animation
// state lives in a small per-session file in the temp folder.
// Node on purpose: it starts ~10x faster than pwsh, and this runs often.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

let data;
try { data = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { data = null; }
if (!data) { process.stdout.write('Claude Code\n'); process.exit(0); }

const ESC = '\x1b';
const reset = `${ESC}[0m`, dim = `${ESC}[2m`;
const red = `${ESC}[31m`, green = `${ESC}[32m`, yellow = `${ESC}[33m`, blue = `${ESC}[34m`, cyan = `${ESC}[36m`;
const NBSP = '\u00a0';
const BLANK = '\u2800';  // braille blank: looks empty but is not whitespace
const rand = (n) => Math.floor(Math.random() * n);
const randIn = (min, max) => min + rand(max - min);  // max exclusive

// Per-session state: animation + cached git segment
const sessionId = data.session_id || 'default';
const stateFile = path.join(os.tmpdir(), `claude-statusline-${sessionId}.json`);
let state = {};
try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { }
state = { frame: 0, git: '', gitAt: 0, cwd: '', action: 'stand', left: 0, dir: 1, ...state };
const now = Date.now();

const modelName = data.model?.display_name || 'Claude';
const cwd = data.workspace?.current_dir || process.cwd();
const dirName = path.basename(cwd.replace(/[\\/]+$/, '')) || cwd;

// Git: branch, uncommitted changes (*), commits ahead/behind; cached for 5s
let gitStr;
if (state.cwd === cwd && now - state.gitAt < 5000) {
    gitStr = state.git;
} else {
    gitStr = '';
    try {
        const out = execFileSync('git', ['-C', cwd, '--no-optional-locks', 'status', '--porcelain=v1', '--branch'],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
        const lines = out.split('\n').filter(Boolean);
        if (lines.length) {
            const head = lines[0].replace(/^## /, '');
            let branch = head.replace(/^No commits yet on /, '').replace(/\.\.\..*$/, '').replace(/ \[.*$/, '');
            if (branch.startsWith('HEAD (no branch)')) branch = 'detached';
            gitStr = green + branch;
            if (lines.length > 1) gitStr += `${yellow}*`;
            const ahead = head.match(/ahead (\d+)/), behind = head.match(/behind (\d+)/);
            if (ahead) gitStr += ` ${cyan}↑${ahead[1]}`;
            if (behind) gitStr += ` ${cyan}↓${behind[1]}`;
            gitStr += reset;
        }
    } catch { }
    state.git = gitStr; state.gitAt = now; state.cwd = cwd;
}

// Context: color by level + bar
const pct = Number(data.context_window?.used_percentage ?? 0) || 0;
const ctxColor = pct >= 80 ? red : pct >= 50 ? yellow : green;
const filled = Math.min(10, Math.round(pct / 10));
const ctxStr = `${ctxColor}${'▓'.repeat(filled)}${'░'.repeat(10 - filled)} ${Math.round(pct)}%${reset}`;

// Working = the transcript was written in the last few seconds
let working = false;
try { working = (now - fs.statSync(data.transcript_path).mtimeMs) / 1000 < 4; } catch { }

const frame = (state.frame + 1) % 1000;
state.frame = frame;

// What the left side shows. /buddy writes the list; these are the pieces.
const SEGMENTS = {
    model: () => `${cyan}${modelName}${reset}`,
    dir: () => `${blue}${dirName}${reset}`,
    git: () => gitStr,
    context: () => ctxStr,
    clock: () => {
        const d = new Date();
        return `${dim}${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}${reset}`;
    },
    session: () => {  // how long this session has been going
        try {
            const mins = Math.floor((now - fs.statSync(data.transcript_path).birthtimeMs) / 60000);
            return `${dim}${mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`}${reset}`;
        } catch { return ''; }
    },
    lines: () => {  // lines Claude added/removed this session
        const a = data.cost?.total_lines_added, r = data.cost?.total_lines_removed;
        return a == null && r == null ? '' : `${green}+${a || 0}${reset} ${red}-${r || 0}${reset}`;
    },
};
const DEFAULT_SEGMENTS = ['model', 'dir', 'git', 'context'];

// Info block on the left (fixed width) and the character rows on the right.
const visible = (s) => s.replace(/\x1b\[[0-9;]*m/g, '').length;

// Cut a colored string to n visible characters, keeping the escape codes
function truncate(s, n) {
    if (visible(s) <= n) return s;
    let out = '', shown = 0;
    for (const part of s.split(/(\x1b\[[0-9;]*m)/)) {
        if (part.startsWith(ESC)) { out += part; continue; }
        for (const ch of part) {
            if (shown >= n - 1) return `${out}…${reset}`;
            out += ch;
            shown++;
        }
    }
    return `${out}${reset}`;
}
function buildInfo(segments) {
    // lay the segments out in order, wrapping to a new line at ~34 columns
    const lines = [];
    let cur = [], curWidth = 0;
    for (const name of segments) {
        const cell = (SEGMENTS[name] || (() => ''))();
        if (!cell || !visible(cell)) continue;
        const w = visible(cell);
        if (cur.length && curWidth + w + 3 > 34) { lines.push(cur); cur = []; curWidth = 0; }
        cur.push(cell);
        curWidth += w + 3;
    }
    if (cur.length) lines.push(cur);
    // Pad every column to the same width so the separators line up
    const colWidth = [];
    for (const cells of lines) {
        cells.forEach((cell, i) => { colWidth[i] = Math.max(colWidth[i] || 0, visible(cell)); });
    }
    return lines.map((cells) => cells
        .map((cell, i) => cell + NBSP.repeat(colWidth[i] - visible(cell)))
        .join(` ${dim}|${reset} `)
        .replace(/[ ]+$/, ''));
}

function writeRows(rows, segments) {
    let info = buildInfo(segments);
    // Where the character starts: hard against the right edge by default
    // (Claude Code sets COLUMNS to the terminal width), or at a fixed column
    const spriteWidth = Math.max(0, ...rows.map(visible));
    const cols = Number(process.env.COLUMNS) || 0;
    const at = settings.at === 'right' && cols
        ? Math.max(0, cols - spriteWidth - settings.margin)
        : Number(settings.at) || 0;
    // Long folder or branch names get cut instead of pushing the character
    // off the screen
    if (at > 4) info = info.map((line) => truncate(line, at - 2));
    // A minimum text block of 30 columns, unless the terminal is narrower
    const floor = at > 2 ? Math.min(30, at - 2) : 30;
    const textWidth = Math.max(floor, ...info.map(visible));
    const width = Math.max(textWidth, at - 2);
    const top = Math.max(0, Math.floor((rows.length - info.length) / 2));
    // Claude Code trims leading whitespace (NBSP included), which would glue
    // rows without info text to the left edge; they start with BLANK instead.
    // "center" moves the whole text block, not each line: shifting lines one
    // by one would break the aligned separators
    const blockWidth = Math.max(0, ...info.map(visible));
    const indent = settings.align === 'center' ? Math.floor((textWidth - blockWidth) / 2) : 0;
    const out = rows.map((row, i) => {
        const j = i - top;
        const text = j >= 0 && j < info.length ? info[j] : BLANK;
        return `${reset}${NBSP.repeat(indent)}${text}` +
            `${NBSP.repeat(width - indent - visible(text) + 2)}${row}${reset}`;
    });
    process.stdout.write(out.join('\n') + '\n');
}

function saveState() {
    try { fs.writeFileSync(stateFile, JSON.stringify(state)); } catch { }
}

// A letter grid ('.' = transparent) becomes terminal rows.
//   mini   the 8x8 version of the character, 4 rows
//   normal the 14x13 one, 7 rows: '▀' per cell, fg = top pixel,
//          bg = bottom pixel, with a blank pixel row on top
//   grande one row per pixel row and two columns per pixel, 13 rows
const SIZES = { mini: 'mini', normal: 'normal', grande: 'grande' };
function render(grid, pal, size = 'normal') {
    const rgb = (c) => `${c[0]};${c[1]};${c[2]}`;
    // Drop fully transparent columns on both sides, so the drawing is exactly
    // as wide as its pixels and lines up with the right edge
    let first = grid[0].length, last = -1;
    for (const row of grid) {
        const a = row.search(/[^.]/), b = row.search(/\.*$/);
        if (a >= 0) { first = Math.min(first, a); last = Math.max(last, b - 1); }
    }
    if (last >= first) grid = grid.map((row) => row.slice(first, last + 1));
    if (size === 'grande') {
        return grid.map((row) => {
            let s = '';
            for (const ch of row) s += ch === '.' ? `${reset}  ` : `${ESC}[38;2;${rgb(pal[ch])}m██`;
            return s;
        });
    }
    const canvas = size === 'mini' ? [...grid] : ['.'.repeat(grid[0].length), ...grid];
    if (canvas.length % 2) canvas.push('.'.repeat(canvas[0].length));
    const rows = [];
    for (let l = 0; l < canvas.length / 2; l++) {
        const top = canvas[2 * l], bot = canvas[2 * l + 1];
        let s = '';
        for (let c = 0; c < top.length; c++) {
            const t = top[c], b = bot[c];
            if (t === '.' && b === '.') s += `${reset} `;
            else if (b === '.') s += `${reset}${ESC}[38;2;${rgb(pal[t])}m▀`;
            else if (t === '.') s += `${reset}${ESC}[38;2;${rgb(pal[b])}m▄`;
            else s += `${ESC}[38;2;${rgb(pal[t])};48;2;${rgb(pal[b])}m▀`;
        }
        rows.push(s);
    }
    return rows;
}

// Everyone gets darker as the context fills past 50%
function tire(pal, keep = []) {
    const k = 1 - Math.min(1, Math.max(0, (pct - 50) / 40)) * 0.45;
    if (k === 1) return pal;
    const out = {};
    for (const [letter, c] of Object.entries(pal)) {
        out[letter] = keep.includes(letter) ? c : c.map((v) => Math.round(v * k));
    }
    return out;
}

// ---- which character lives here ----

function readConfig() {
    try { return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', 'claude-buddy.json'), 'utf8')); }
    catch { return {}; }
}
const norm = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
function covers(folder, here) {
    folder = norm(folder);
    if (here === folder || here.startsWith(folder + '/')) return true;
    if (!folder.includes('*')) return false;
    const re = new RegExp('^' + folder.replace(/[.+^${}()|[\]]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return re.test(here);
}

// Settings for this folder: character, size and segments. /buddy writes the
// "projects" entries, either "gato" or { character, size, segments }.
function settingsFor(cfg) {
    const here = norm(cwd);
    let best = -1, found = null;
    for (const [folder, value] of Object.entries(cfg.projects || {})) {
        if (covers(folder, here) && norm(folder).length > best) { best = norm(folder).length; found = value; }
    }
    const entry = typeof found === 'string' ? { character: found } : (found || {});
    const fallback = [].concat(cfg.mrIrrelevant || []).some((f) => f && covers(f, here)) ? 'mr'
        : cfg.mode === 'buddies' ? 'auto' : 'mr';
    return {
        character: entry.character || cfg.character || fallback,
        size: SIZES[entry.size || cfg.size] || 'normal',
        segments: entry.segments || cfg.segments || DEFAULT_SEGMENTS,
        // where the character starts: "right" (the terminal's right edge), a
        // column number, or 0 to put it right after the text
        at: entry.at ?? cfg.at ?? 'right',
        // columns left free at the right edge (Claude Code insets the bar a bit)
        margin: Number(entry.margin ?? cfg.margin ?? 4) || 0,
        // "left" or "center" for the text block
        align: entry.align || cfg.align || 'left',
    };
}

const BUDDIES = /*BUDDIES*/{"marciano": {"label": "Marciano","colors": {"S": [255,240,150],"G": [70,170,70],"L": [140,230,110],"D": [50,130,55],"K": [12,16,12],"W": [255,255,255],"M": [30,70,30],"Y": [255,220,80]},"poses": {"normal": ["..Y........Y..","...G......G...","....GGGGGG....","..GGLLLLLLGG..",".GLLLLLLLLLLG.",".GLKWKLLKWKLG.",".GLKKKLLKKKLG.","..GLLLMMLLLG..","...GGLLLLGG...",".GGDLLLLLLDGG.",".G.DLLLLLLD.G.","...DDLLLLDD...","...DD....DD..."],"blink": ["..Y........Y..","...G......G...","....GGGGGG....","..GGLLLLLLGG..",".GLLLLLLLLLLG.",".GLGGGLLGGGLG.",".GLGGGLLGGGLG.","..GLLLMMLLLG..","...GGLLLLGG...",".GGDLLLLLLDGG.",".G.DLLLLLLD.G.","...DDLLLLDD...","...DD....DD..."],"wave": ["..Y........Y..","...G......G...","....GGGGGG....","..GGLLLLLLGG..",".GLLLLLLLLLLG.",".GLKWKLLKWKLGG",".GLKKKLLKKKLGG","..GLLLMMLLLG.G","...GGLLLLGG..G",".GGDLLLLLLDG..",".G.DLLLLLLD...","...DDLLLLDD...","...DD....DD..."],"cheer": ["..Y........Y..","...G......G...","....GGGGGG....","..GGLLLLLLGG..",".GLLLLLLLLLLG.","GGLKWKLLKWKLGG","GGLKKKLLKKKLGG","G.GLLLMMLLLG.G","G..GGLLLLGG..G","..GDLLLLLLDG..","...DLLLLLLD...","...DDLLLLDD...","...DD....DD..."],"cheer2": ["..Y........Y..","...G......G...","....GGGGGG....","..GGLLLLLLGG..",".GLLLLLLLLLLG.","GGLKWKLLKWKLGG","GGLKKKLLKKKLGG","G.GLLLMMLLLG.G","G..GGLLLLGG..G","..GDLLLLLLDG..","...DLLLLLLD...","...DDLLLLDD...","...DD....DD..."]},"mini": [".Y....Y.","..GGGG..",".GLLLLG.",".GKLLKG.",".GLMMLG.",".GLLLLG.","..GLLG..","..G..G.."]},"gato": {"label": "Gato","colors": {"S": [255,240,150],"O": [120,60,20],"B": [245,150,60],"A": [255,190,170],"C": [255,225,190],"K": [20,12,8],"W": [240,240,240],"N": [240,110,130],"M": [120,60,20],"T": [245,150,60]},"poses": {"normal": ["..O........O..","..OO......OO..","..OAOOOOOOAO..","..OBBBBBBBBO..",".OBBBBBBBBBBO.",".OBKWBBBBKWBO.","WOBKKBBBBKKBOW",".OBBBBNNBBBBO.","W.OBBMBBMBBO.W",".BOBCCCCCCBOB.",".O.OCCCCCCO.O.","...OBBBBBBO..T","...OO....OOTT."],"blink": ["..O........O..","..OO......OO..","..OAOOOOOOAO..","..OBBBBBBBBO..",".OBBBBBBBBBBO.",".OBBBBBBBBBBO.","WOBBBBBBBBBBOW",".OBBBBNNBBBBO.","W.OBBMBBMBBO.W",".BOBCCCCCCBOB.",".O.OCCCCCCO.O.","...OBBBBBBO..T","...OO....OOTT."],"wave": ["..O........O..","..OO......OO..","..OAOOOOOOAO..","..OBBBBBBBBO..",".OBBBBBBBBBBO.",".OBKWBBBBKWBOB","WOBKKBBBBKKBOB",".OBBBBNNBBBBOB","W.OBBMBBMBBO.B",".BOBCCCCCCBO..",".O.OCCCCCCO...","...OBBBBBBO..T","...OO....OOTT."],"cheer": ["..O........O..","..OO......OO..","..OAOOOOOOAO..","..OBBBBBBBBO..",".OBBBBBBBBBBO.","BOBKWBBBBKWBOB","BOBKKBBBBKKBOB","BOBBBBNNBBBBOB","B.OBBMBBMBBO.B","..OBCCCCCCBO..","...OCCCCCCO...","...OBBBBBBO..T","...OO....OOTT."],"cheer2": ["..O........O..","..OO......OO..","..OAOOOOOOAO..","..OBBBBBBBBO..",".OBBBBBBBBBBO.","BOBKWBBBBKWBOB","BOBKKBBBBKKBOB","BOBBBBNNBBBBOB","B.OBBMBBMBBO.B","..OBCCCCCCBO..","...OCCCCCCO...","...OBBBBBBO..T","...OO....OOTT."]},"mini": [".O....O.","OBO..OBO",".BBBBBB.",".BKBBKB.",".BBNNBB.",".BCCCCB.",".OCCCCO.","..O..O.."]},"perro": {"label": "Perro","colors": {"S": [255,240,150],"O": [80,50,25],"B": [200,140,80],"E": [120,75,40],"C": [245,225,195],"K": [20,12,8],"W": [255,255,255],"N": [30,20,20],"M": [90,40,40],"T": [240,100,120]},"poses": {"normal": ["....OOOOOO....","..OOBBBBBBOO..",".EEOBBBBBBOEE.","EEEBBBBBBBBEEE","EEEBKWBBKWBEEE","EEEBKKBBKKBEEE",".EEBBCCCCBBEE.","..OBCCNNCCBO..","...OCMMMMCO...",".BOBBCTTCBBOB.",".O.OBBBBBBO.O.","...OBBBBBBO...","...OO....OO..."],"blink": ["....OOOOOO....","..OOBBBBBBOO..",".EEOBBBBBBOEE.","EEEBBBBBBBBEEE","EEEBBBBBBBBEEE","EEEBBBBBBBBEEE",".EEBBCCCCBBEE.","..OBCCNNCCBO..","...OCMMMMCO...",".BOBBCTTCBBOB.",".O.OBBBBBBO.O.","...OBBBBBBO...","...OO....OO..."],"wave": ["....OOOOOO....","..OOBBBBBBOO..",".EEOBBBBBBOEE.","EEEBBBBBBBBEEE","EEEBKWBBKWBEEE","EEEBKKBBKKBEEB",".EEBBCCCCBBEEB","..OBCCNNCCBO.B","...OCMMMMCO..B",".BOBBCTTCBBO..",".O.OBBBBBBO...","...OBBBBBBO...","...OO....OO..."],"cheer": ["....OOOOOO....","..OOBBBBBBOO..",".EEOBBBBBBOEE.","EEEBBBBBBBBEEE","EEEBKWBBKWBEEE","BEEBKKBBKKBEEB","BEEBBCCCCBBEEB","B.OBCCNNCCBO.B","B..OCMMMMCO..B","..OBBCTTCBBO..","...OBBBBBBO...","...OBBBBBBO...","...OO....OO..."],"cheer2": ["....OOOOOO....","..OOBBBBBBOO..",".EEOBBBBBBOEE.","EEEBBBBBBBBEEE","EEEBKWBBKWBEEE","BEEBKKBBKKBEEB","BEEBBCCCCBBEEB","B.OBCCNNCCBO.B","B..OCMMMMCO..B","..OBBCTTCBBO..","...OBBBBBBO...","...OBBBBBBO...","...OO....OO..."]},"mini": ["..BBBB..","EEBBBBEE","EEBKBKBE","EEBCCCBE",".BCTTCB.",".BBBBBB.",".BBBBBB.","..O..O.."]},"robot": {"label": "Robot","colors": {"S": [255,240,150],"O": [60,65,80],"G": [175,185,200],"D": [120,130,150],"K": [20,24,34],"C": [80,230,255],"R": [255,80,90],"M": [90,100,120]},"poses": {"normal": ["......RR......","......OO......","...OOOOOOOO...","..OGGGGGGGGO..",".OGKKKKKKKKGO.",".OGKCCKKCCKGO.",".OGKKKKKKKKGO.","..OGGMMMMGGO..","...OOOOOOOO...",".GOGGDRRDGGOG.",".O.OGDDDDGO.O.","...OGGGGGGO...","...OO....OO..."],"blink": ["......RR......","......OO......","...OOOOOOOO...","..OGGGGGGGGO..",".OGKKKKKKKKGO.",".OGKKKKKKKKGO.",".OGKKKKKKKKGO.","..OGGMMMMGGO..","...OOOOOOOO...",".GOGGDRRDGGOG.",".O.OGDDDDGO.O.","...OGGGGGGO...","...OO....OO..."],"wave": ["......RR......","......OO......","...OOOOOOOO...","..OGGGGGGGGO..",".OGKKKKKKKKGO.",".OGKCCKKCCKGOG",".OGKKKKKKKKGOG","..OGGMMMMGGO.G","...OOOOOOOO..G",".GOGGDRRDGGO..",".O.OGDDDDGO...","...OGGGGGGO...","...OO....OO..."],"cheer": ["......RR......","......OO......","...OOOOOOOO...","..OGGGGGGGGO..",".OGKKKKKKKKGO.","GOGKCCKKCCKGOG","GOGKKKKKKKKGOG","G.OGGMMMMGGO.G","G..OOOOOOOO..G","..OGGDRRDGGO..","...OGDDDDGO...","...OGGGGGGO...","...OO....OO..."],"cheer2": ["......RR......","......OO......","...OOOOOOOO...","..OGGGGGGGGO..",".OGKKKKKKKKGO.","GOGKCCKKCCKGOG","GOGKKKKKKKKGOG","G.OGGMMMMGGO.G","G..OOOOOOOO..G","..OGGDRRDGGO..","...OGDDDDGO...","...OGGGGGGO...","...OO....OO..."]},"mini": ["...RR...","..OOOO..",".OGGGGO.",".GKCCKG.",".OGGGGO.","GOGGGGOG",".OGGGGO.","..O..O.."]},"fantasma": {"label": "Fantasma","colors": {"S": [255,240,150],"O": [150,150,200],"W": [240,240,255],"K": [40,40,70],"M": [60,60,100],"P": [255,170,200]},"poses": {"normal": ["....OOOOOO....","...OWWWWWWO...","..OWWWWWWWWO..",".OWWWWWWWWWWO.",".OWWKKWWKKWWO.",".OWWKKWWKKWWO.",".OWWWWWWWWWWO.",".OWWWPMMPWWWO.",".OWWWWMMWWWWO.","WOWWWWWWWWWWOW",".OWWWWWWWWWWO.",".OWWOWWWWOWWO.",".OO.OO..OO.OO."],"blink": ["....OOOOOO....","...OWWWWWWO...","..OWWWWWWWWO..",".OWWWWWWWWWWO.",".OWWWWWWWWWWO.",".OWWWWWWWWWWO.",".OWWWWWWWWWWO.",".OWWWPMMPWWWO.",".OWWWWMMWWWWO.","WOWWWWWWWWWWOW",".OWWWWWWWWWWO.",".OWWOWWWWOWWO.",".OO.OO..OO.OO."],"wave": ["....OOOOOO....","...OWWWWWWO...","..OWWWWWWWWO..",".OWWWWWWWWWWO.",".OWWKKWWKKWWO.",".OWWKKWWKKWWOW",".OWWWWWWWWWWOW",".OWWWPMMPWWWOW",".OWWWWMMWWWWOW","WOWWWWWWWWWWO.",".OWWWWWWWWWWO.",".OWWOWWWWOWWO.",".OO.OO..OO.OO."],"cheer": ["....OOOOOO....","...OWWWWWWO...","..OWWWWWWWWO..",".OWWWWWWWWWWO.",".OWWKKWWKKWWO.","WOWWKKWWKKWWOW","WOWWWWWWWWWWOW","WOWWWPMMPWWWOW","WOWWWWMMWWWWOW",".OWWWWWWWWWWO.",".OWWWWWWWWWWO.",".OWWOWWWWOWWO.",".OO.OO..OO.OO."],"cheer2": ["....OOOOOO....","...OWWWWWWO...","..OWWWWWWWWO..",".OWWWWWWWWWWO.",".OWWKKWWKKWWO.","WOWWKKWWKKWWOW","WOWWWWWWWWWWOW","WOWWWPMMPWWWOW","WOWWWWMMWWWWOW",".OWWWWWWWWWWO.",".OWWWWWWWWWWO.",".OWWOWWWWOWWO.",".OO.OO..OO.OO."]},"mini": ["..WWWW..",".WWWWWW.",".WKWWKW.",".WWWWWW.",".WWMMWW.",".WWWWWW.",".WWWWWW.",".W.WW.W."]},"rana": {"label": "Rana","colors": {"S": [255,240,150],"O": [30,90,40],"G": [90,190,80],"L": [200,235,150],"K": [15,20,15],"W": [250,250,240],"M": [40,100,45]},"poses": {"normal": ["..OOO....OOO..",".OWWWO..OWWWO.",".OWKKO..OKKWO.",".OGWWGOOGWWGO.",".OGGGGGGGGGGO.","OGGGGGGGGGGGGO","OGMGGGGGGGGMGO",".OGMMMMMMMMGO.","..OGGGGGGGGO..",".GOGLLLLLLGOG.",".O.OLLLLLLO.O.","..OOGGGGGGOO..",".OOO......OOO."],"blink": ["..OOO....OOO..",".OWWWO..OWWWO.",".OWGGO..OGGWO.",".OGWWGOOGWWGO.",".OGGGGGGGGGGO.","OGGGGGGGGGGGGO","OGMGGGGGGGGMGO",".OGMMMMMMMMGO.","..OGGGGGGGGO..",".GOGLLLLLLGOG.",".O.OLLLLLLO.O.","..OOGGGGGGOO..",".OOO......OOO."],"wave": ["..OOO....OOO..",".OWWWO..OWWWO.",".OWKKO..OKKWO.",".OGWWGOOGWWGO.",".OGGGGGGGGGGO.","OGGGGGGGGGGGGG","OGMGGGGGGGGMGG",".OGMMMMMMMMGOG","..OGGGGGGGGO.G",".GOGLLLLLLGO..",".O.OLLLLLLO...","..OOGGGGGGOO..",".OOO......OOO."],"cheer": ["..OOO....OOO..",".OWWWO..OWWWO.",".OWKKO..OKKWO.",".OGWWGOOGWWGO.",".OGGGGGGGGGGO.","GGGGGGGGGGGGGG","GGMGGGGGGGGMGG","GOGMMMMMMMMGOG","G.OGGGGGGGGO.G","..OGLLLLLLGO..","...OLLLLLLO...","..OOGGGGGGOO..",".OOO......OOO."],"cheer2": ["..OOO....OOO..",".OWWWO..OWWWO.",".OWKKO..OKKWO.",".OGWWGOOGWWGO.",".OGGGGGGGGGGO.","GGGGGGGGGGGGGG","GGMGGGGGGGGMGG","GOGMMMMMMMMGOG","G.OGGGGGGGGO.G","..OGLLLLLLGO..","...OLLLLLLO...","..OOGGGGGGOO..",".OOO......OOO."]},"mini": [".WW..WW.",".WK..KW.",".GGGGGG.","GGGGGGGG","GMMMMMMG",".GLLLLG.",".GLLLLG.","GG....GG"]},"pinguino": {"label": "Pingüino","colors": {"S": [255,240,150],"O": [20,24,40],"K": [50,58,90],"W": [245,245,250],"Y": [255,170,40],"E": [8,10,18]},"poses": {"normal": ["....OOOOOO....","...OKKKKKKO...","..OKKKKKKKKO..","..OKWWKKWWKO..","..OKWEKKWEKO..",".OKKKKYYKKKKO.",".OKWWWYYWWWKO.",".KOWWWWWWWWOK.",".KOWWWWWWWWOK.",".KOWWWWWWWWOK.","..OKWWWWWWKO..","...OOOOOOOO...","...YYY..YYY..."],"blink": ["....OOOOOO....","...OKKKKKKO...","..OKKKKKKKKO..","..OKKKKKKKKO..","..OKKKKKKKKO..",".OKKKKYYKKKKO.",".OKWWWYYWWWKO.",".KOWWWWWWWWOK.",".KOWWWWWWWWOK.",".KOWWWWWWWWOK.","..OKWWWWWWKO..","...OOOOOOOO...","...YYY..YYY..."],"wave": ["....OOOOOO....","...OKKKKKKO...","..OKKKKKKKKO..","..OKWWKKWWKOKK","..OKWEKKWEKO.K",".OKKKKYYKKKKOK",".OKWWWYYWWWKOK",".KOWWWWWWWWO..",".KOWWWWWWWWO..",".KOWWWWWWWWO..","..OKWWWWWWKO..","...OOOOOOOO...","...YYY..YYY..."],"cheer": ["....OOOOOO....","...OKKKKKKO...",".SOKKKKKKKKOS.","KKOKWWKKWWKOKK","K.OKWEKKWEKO.K","KOKKKKYYKKKKOK","KOKWWWYYWWWKOK","..OWWWWWWWWO..","..OWWWWWWWWO..","..OWWWWWWWWO..","..OKWWWWWWKO..","...OOOOOOOO...","...YYY..YYY..."],"cheer2": ["....OOOOOO....","...OKKKKKKO...","..OKKKKKKKKO..","KKOKWWKKWWKOKK","K.OKWEKKWEKO.K","KOKKKKYYKKKKOK","KOKWWWYYWWWKOK","..OWWWWWWWWO..","..OWWWWWWWWO..","..OWWWWWWWWO..","..OKWWWWWWKO..","...OOOOOOOO...","...YYY..YYY..."]},"mini": ["..KKKK..",".KKKKKK.",".KWKKWK.",".KKYYKK.","KKWWWWKK","K.WWWW.K",".KWWWWK.",".YY..YY."]},"panda": {"label": "Panda","colors": {"S": [255,240,150],"O": [95,95,108],"W": [245,245,245],"K": [62,62,74],"M": [200,90,110]},"poses": {"normal": ["..KK......KK..",".KKKOOOOOOKKK.",".KKOWWWWWWOKK.","..OWWWWWWWWO..",".OWKKKWWKKKWO.",".OWKWKWWKWKWO.",".OWWKWWWWKWWO.","..OWWWKKWWWO..","...OWWMMWWO...",".KKOWWWWWWOKK.",".KK.OWWWWO.KK.","...OWWWWWWO...","...KKK..KKK..."],"blink": ["..KK......KK..",".KKKOOOOOOKKK.",".KKOWWWWWWOKK.","..OWWWWWWWWO..",".OWKKKWWKKKWO.",".OWKKKWWKKKWO.",".OWWKWWWWKWWO.","..OWWWKKWWWO..","...OWWMMWWO...",".KKOWWWWWWOKK.",".KK.OWWWWO.KK.","...OWWWWWWO...","...KKK..KKK..."],"wave": ["..KK......KK..",".KKKOOOOOOKKK.",".KKOWWWWWWOKK.","..OWWWWWWWWO..",".OWKKKWWKKKWO.",".OWKWKWWKWKWOK",".OWWKWWWWKWWOK","..OWWWKKWWWO.K","...OWWMMWWO..K",".KKOWWWWWWO...",".KK.OWWWWO....","...OWWWWWWO...","...KKK..KKK..."],"cheer": ["..KK......KK..",".KKKOOOOOOKKK.",".KKOWWWWWWOKK.","..OWWWWWWWWO..",".OWKKKWWKKKWO.","KOWKWKWWKWKWOK","KOWWKWWWWKWWOK","K.OWWWKKWWWO.K","K..OWWMMWWO..K","...OWWWWWWO...","....OWWWWO....","...OWWWWWWO...","...KKK..KKK..."],"cheer2": ["..KK......KK..",".KKKOOOOOOKKK.",".KKOWWWWWWOKK.","..OWWWWWWWWO..",".OWKKKWWKKKWO.","KOWKWKWWKWKWOK","KOWWKWWWWKWWOK","K.OWWWKKWWWO.K","K..OWWMMWWO..K","...OWWWWWWO...","....OWWWWO....","...OWWWWWWO...","...KKK..KKK..."]},"mini": ["KK....KK","KWWWWWWK",".WWWWWW.",".WKWWKW.",".WWMMWW.","KWWWWWWK",".WWWWWW.",".KK..KK."]},"buho": {"label": "Búho","colors": {"S": [255,240,150],"O": [70,45,25],"B": [160,110,60],"C": [215,180,130],"W": [250,245,225],"K": [20,15,10],"Y": [255,180,50]},"poses": {"normal": ["..O........O..","..OO......OO..","..OBOOOOOOBO..",".OBBBBBBBBBBO.",".OWWWBBBBWWWO.",".OWKWBBBBWKWO.",".OWWWBYYBWWWO.",".OBBBBYYBBBBO.",".OBCBCBBCBCBO.","BOBBCBCCBCBBOB","BO.BCBCCBCB.OB","..OBBBBBBBBO..","...YY....YY..."],"blink": ["..O........O..","..OO......OO..","..OBOOOOOOBO..",".OBBBBBBBBBBO.",".OWWWBBBBWWWO.",".OWBWBBBBWBWO.",".OWWWBYYBWWWO.",".OBBBBYYBBBBO.",".OBCBCBBCBCBO.","BOBBCBCCBCBBOB","BO.BCBCCBCB.OB","..OBBBBBBBBO..","...YY....YY..."],"wave": ["..O........O..","..OO......OO..","..OBOOOOOOBO..",".OBBBBBBBBBBO.",".OWWWBBBBWWWO.",".OWKWBBBBWKWOB",".OWWWBYYBWWWOB",".OBBBBYYBBBBOB",".OBCBCBBCBCBOB","BOBBCBCCBCBBO.","BO.BCBCCBCB.O.","..OBBBBBBBBO..","...YY....YY..."],"cheer": ["..O........O..","..OO......OO..","..OBOOOOOOBO..",".OBBBBBBBBBBO.",".OWWWBBBBWWWO.","BOWKWBBBBWKWOB","BOWWWBYYBWWWOB","BOBBBBYYBBBBOB","BOBCBCBBCBCBOB",".OBBCBCCBCBBO.",".O.BCBCCBCB.O.","..OBBBBBBBBO..","...YY....YY..."],"cheer2": ["..O........O..","..OO......OO..","..OBOOOOOOBO..",".OBBBBBBBBBBO.",".OWWWBBBBWWWO.","BOWKWBBBBWKWOB","BOWWWBYYBWWWOB","BOBBBBYYBBBBOB","BOBCBCBBCBCBOB",".OBBCBCCBCBBO.",".O.BCBCCBCB.O.","..OBBBBBBBBO..","...YY....YY..."]},"mini": [".O....O.","OBO..OBO",".BBBBBB.",".WKWWKW.",".BBYYBB.",".BCBBCB.",".BCCCCB.","..Y..Y.."]},"slime": {"label": "Slime","colors": {"S": [255,240,150],"O": [20,120,140],"B": [60,210,220],"L": [150,245,250],"W": [255,255,255],"K": [10,40,50],"M": [20,100,120]},"poses": {"normal": ["..............","..............","......OO......",".....OLLO.....","....OLLWLO....","...OBLLLLBO...","..OBBBBBBBBO..",".OBBKWBBKWBBO.",".OBBKKBBKKBBO.","OBBBBBMMBBBBBO","OBBBBBBBBBBBBO","OBBBBBBBBBBBBO",".OOOOOOOOOOOO."],"blink": ["..............","..............","......OO......",".....OLLO.....","....OLLWLO....","...OBLLLLBO...","..OBBBBBBBBO..",".OBBBBBBBBBBO.",".OBBBBBBBBBBO.","OBBBBBMMBBBBBO","OBBBBBBBBBBBBO","OBBBBBBBBBBBBO",".OOOOOOOOOOOO."],"wave": ["..............","..............","......OO......",".....OLLO.....","....OLLWLO....","...OBLLLLBO.BB","..OBBBBBBBBO.B",".OBBKWBBKWBBOB",".OBBKKBBKKBBOB","OBBBBBMMBBBBBO","OBBBBBBBBBBBBO","OBBBBBBBBBBBBO",".OOOOOOOOOOOO."],"cheer": ["..............","..............","......OO......",".....OLLO.....",".S..OLLWLO..S.","BB.OBLLLLBO.BB","B.OBBBBBBBBO.B","BOBBKWBBKWBBOB","BOBBKKBBKKBBOB","OBBBBBMMBBBBBO","OBBBBBBBBBBBBO","OBBBBBBBBBBBBO",".OOOOOOOOOOOO."],"cheer2": ["..............","..............","......OO......",".....OLLO.....","....OLLWLO....","BB.OBLLLLBO.BB","B.OBBBBBBBBO.B","BOBBKWBBKWBBOB","BOBBKKBBKKBBOB","OBBBBBMMBBBBBO","OBBBBBBBBBBBBO","OBBBBBBBBBBBBO",".OOOOOOOOOOOO."]},"mini": ["...LL...","..LLLL..",".BBLLBB.",".BBBBBB.","BKWBBWKB","BBBBBBBB","BBBBBBBB","OOOOOOOO"]}}/*END*/;

const settings = settingsFor(readConfig());
let who = settings.character;
if (who === 'auto') {
    // FNV-1a hash of the folder name, so a project always keeps its character
    let hash = 2166136261;
    for (const ch of dirName.toLowerCase()) hash = Math.imul((hash ^ ch.charCodeAt(0)) >>> 0, 16777619) >>> 0;
    const names = Object.keys(BUDDIES);
    who = names[hash % names.length];
}
if (who !== 'mr' && !BUDDIES[who]) who = 'mr';

// ---- the calm animation everyone shares ----
// Mostly standing (blinking now and then), sometimes waving; Mr can also look
// to a side or cross his arms. While Claude works: celebrating.

let pose = 'normal', blink = rand(100) < 8;
if (working) {
    state.action = 'stand';
    state.left = 0;
    pose = frame % 2 ? 'cheer' : 'cheer2';
    blink = false;
} else {
    if (state.left <= 0) {
        const roll = rand(100);
        const extra = who === 'mr';
        if (roll < 60) { state.action = 'stand'; state.left = randIn(8, 21); }
        else if (roll < 75) { state.action = 'wave'; state.left = 4; }
        else if (roll < 90 && extra) { state.action = 'look'; state.left = 4; state.dir = rand(2) ? 1 : -1; }
        else if (extra) { state.action = 'cross'; state.left = randIn(6, 11); }
        else { state.action = 'wave'; state.left = 4; }
    }
    if (state.action === 'wave') { pose = 'wave'; blink = false; }
    else if (state.action === 'cross') pose = 'cross';
    else if (state.action === 'look') pose = 'look';
    state.left -= 1;
}

function characterRows() {
    if (who !== 'mr') {
        const b = BUDDIES[who];
        const colors = tire(b.colors, ['K', 'W']);
        if (settings.size === 'mini' && b.mini) return render(b.mini, colors, 'mini');
        let p = pose;
        if (p === 'look' || p === 'cross') p = 'normal';
        if (blink) p = 'blink';
        return render(b.poses[p], colors, settings.size);
    }
    // 14x13 pixel poses. L highlight, P body, E shade, K glasses frame,
    // O pupil, W glint, M mouth, R tongue, S sparkle, B sweat
    const head = [
        '....EEEEEE....',
        '...EPLLLLPE...',
        '..KKKEPPEKKK..',
        '.KWKPKKKKWKPK.',
        '..KKKEPPEKKK..',
        '..EPMMMMMMPE..',
        '..EEPMRRMPEE..',
    ];
    const legs = ['..EPPLLLLPPE..', '..EEPPPPPPEE..', '...EEE..EEE...'];
    const cheerTop = (sparks) => [
        sparks,
        'EP.EPLLLLPE.PE',
        'P.KKKEPPEKKK.P',
        'PKWKPKKKKWKPKP',
        'P.KKKEPPEKKK.P',
        '.PEPMMMMMMPEP.',
        '..EEPMRRMPEE..',
        '..EPLLLLLLPE..',
        '..EPLLLLLLPE..',
        '..EPLLLLLLPE..',
    ];
    const mrPoses = {
        normal: [...head, '.PEPLLLLLLPEP.', '.PEPLLLLLLPEP.', '.EEPLLLLLLPEE.', ...legs],
        wave: [
            '....EEEEEE..PE',
            '...EPLLLLPE.PE',
            '..KKKEPPEKKK.P',
            '.KWKPKKKKWKPKP',
            '..KKKEPPEKKK.P',
            '..EPMMMMMMPEP.',
            '..EEPMRRMPEEE.',
            '.PEPLLLLLLPE..',
            '.PEPLLLLLLPE..',
            '.EEPLLLLLLPE..',
            ...legs,
        ],
        cross: [...head, '..EEEEEEEEEE..', '..EPLLLLLLPE..', '..EEEEEEEEEE..', ...legs],
        cheer: [...cheerTop('EPS.EEEEEE.SPE'), ...legs],
        cheer2: [...cheerTop('EP.SEEEEEES.PE'), ...legs],
    };
    // Inside of each lens on row 3
    const lensFor = { open: 'WOP', blink: 'EEE', left: 'WOP', right: 'POW', tired: 'EOP' };

    let eyes = blink ? 'blink' : 'open';
    if (pose === 'look') { eyes = state.dir < 0 ? 'left' : 'right'; pose = 'normal'; }
    if (pct >= 50 && eyes === 'open') eyes = 'tired';

    const grid = [...mrPoses[pose]];
    const lens = lensFor[eyes];
    grid[3] = grid[3].slice(0, 2) + lens + 'KKKK' + lens + grid[3].slice(12);
    if (pct >= 80 && (pose === 'normal' || pose === 'cross')) {
        grid[1] = grid[1].slice(0, 12) + 'B' + grid[1].slice(13);
    }

    const pal = {
        L: [182, 92, 255], P: [152, 60, 242], E: [98, 20, 188], K: [44, 18, 70], O: [4, 2, 8],
        W: [255, 255, 255], M: [22, 4, 42], R: [120, 40, 160], S: [237, 171, 251], B: [140, 200, 255],
    };
    if (working) {
        // the brand gradient, pulsing
        const t = (Math.sin(frame * 0.9) + 1) / 2;
        const a = [139, 123, 245], b = [192, 105, 207];
        pal.P = a.map((v, i) => Math.round(v + (b[i] - v) * t));
        pal.L = pal.P.map((v) => Math.min(255, Math.round(v * 1.18)));
        pal.E = pal.P.map((v) => Math.round(v * 0.62));
    }
    const colors = working ? pal : tire(pal, ['K', 'O', 'W', 'M', 'B']);
    if (settings.size === 'mini') {
        const mini = [
            '..EPPE..',
            '.PLLLLP.',
            'KKWKKWKK',
            '.PLLLLP.',
            '.PMMMMP.',
            '.PLLLLP.',
            '.EPPPPE.',
            '.EE..EE.',
        ];
        return render(mini, colors, 'mini');
    }
    return render(grid, colors, settings.size);
}

writeRows(characterRows(), settings.segments);

saveState();
