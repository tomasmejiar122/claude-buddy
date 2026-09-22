// claude-buddy — https://github.com/tomasmejiar122/claude-buddy
// Claude Code status line: session info on the left (fixed) and a mascot on
// the right.
// - Mr Irrelevant, a calm 7-line pixel-art character, by default.
// - With "mode": "buddies" in ~/.claude/claude-buddy.json: a 3-line buddy
//   whose body and color come from a hash of the folder name, except in the
//   folders listed under "mrIrrelevant". The buddy walks, looks around, waves
//   and jumps while Claude is idle; while Claude works it cycles rainbow
//   colors, pumps its arms and throws sparkles.
// Both get tired as context fills up. Animated through
// statusLine.refreshInterval in settings.json; the animation state lives in a
// small per-session file in the temp folder.
// Node on purpose: it starts ~10x faster than pwsh, and this runs every second.

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
const NBSP = ' ';
const BLANK = '⠀';  // braille blank: looks empty but is not whitespace
const rand = (n) => Math.floor(Math.random() * n);
const randIn = (min, max) => min + rand(max - min);  // max exclusive

// Per-session state: animation + cached git segment
const sessionId = data.session_id || 'default';
const stateFile = path.join(os.tmpdir(), `claude-statusline-${sessionId}.json`);
let state = {};
try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { }
state = { frame: 0, git: '', gitAt: 0, cwd: '', pos: 0, action: 'stand', left: 0, dir: 1, ...state };
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

// Info block on the left (fixed width so the mascot never shifts) and the
// mascot rows on the right from column $pos. infoTop is the mascot row where
// the 3 info lines start.
const visible = (s) => s.replace(/\x1b\[[0-9;]*m/g, '').length;
function writeRows(mascotRows, pos, infoTop) {
    const info1 = [`${cyan}${modelName}${reset}`, `${blue}${dirName}${reset}`];
    if (gitStr) info1.push(gitStr);
    const mood = working ? 'trabajando' + '.'.repeat(1 + frame % 3)
        : pct >= 80 ? 'agotado, toca /compact'
        : pct >= 50 ? 'algo cansado' : BLANK;
    const info = [info1.join(` ${dim}|${reset} `), ctxStr, `${dim}${mood}${reset}`];
    const width = Math.max(30, ...info.map(visible));
    // Claude Code trims leading whitespace (NBSP included), which would glue
    // rows without info text to the left edge; they start with BLANK instead.
    const out = mascotRows.map((row, i) => {
        const j = i - infoTop;
        const text = j >= 0 && j < info.length ? info[j] : BLANK;
        return `${reset}${text}${NBSP.repeat(width - visible(text) + 2 + pos)}${row}${reset}`;
    });
    process.stdout.write(out.join('\n') + '\n');
}

function saveState() {
    try { fs.writeFileSync(stateFile, JSON.stringify(state)); } catch { }
}

// Mr Irrelevant everywhere by default. With "mode": "buddies" in
// ~/.claude/claude-buddy.json, only the folders under "mrIrrelevant" get him
// (each entry covers everything inside it; wildcards work).
function useMr() {
    let cfg;
    try { cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', 'claude-buddy.json'), 'utf8')); } catch { return true; }
    if (cfg.mode !== 'buddies') return true;
    const norm = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    const here = norm(cwd);
    return [].concat(cfg.mrIrrelevant || []).some((p) => {
        if (!p) return false;
        p = norm(p);
        if (here === p || here.startsWith(p + '/')) return true;
        if (!p.includes('*')) return false;
        const re = new RegExp('^' + p.replace(/[.+^${}()|[\]]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
        return re.test(here);
    });
}

const rgb = (c) => `${c[0]};${c[1]};${c[2]}`;

if (useMr()) {
    // 14x13 pixel poses; each terminal row shows two pixel rows with '▀'.
    // L highlight, P body, E shade, K glasses frame, O pupil, W glint,
    // M mouth, R tongue, S sparkle, B sweat
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
    const poses = {
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
    const eyesMap = { open: 'WOP', blink: 'EEE', left: 'WOP', right: 'POW', tired: 'EOP' };

    // Calm on purpose: Mr stays in place and holds each pose for a while.
    // Mostly standing (blinking now and then); sometimes he waves, looks to a
    // side or crosses his arms.
    let pose = 'normal', eyes = rand(100) < 8 ? 'blink' : 'open';
    if (working) {
        state.action = 'stand'; state.left = 0;
        pose = frame % 2 ? 'cheer' : 'cheer2';
    } else {
        if (state.left <= 0) {
            const roll = rand(100);
            if (roll < 60) { state.action = 'stand'; state.left = randIn(8, 21); }
            else if (roll < 75) { state.action = 'wave'; state.left = 4; }
            else if (roll < 90) { state.action = 'look'; state.left = 4; state.dir = rand(2) ? 1 : -1; }
            else { state.action = 'cross'; state.left = randIn(6, 11); }
        }
        if (state.action === 'wave') pose = 'wave';
        else if (state.action === 'cross') pose = 'cross';
        else if (state.action === 'look') eyes = state.dir < 0 ? 'left' : 'right';
        state.left -= 1;
    }
    if (pct >= 50 && eyes === 'open') eyes = 'tired';

    const grid = [...poses[pose]];
    const lens = eyesMap[eyes];
    grid[3] = grid[3].slice(0, 2) + lens + 'KKKK' + lens + grid[3].slice(12);
    if (pct >= 80 && (pose === 'normal' || pose === 'cross')) {
        grid[1] = grid[1].slice(0, 12) + 'B' + grid[1].slice(13);
    }

    // Colors: Mr's purple; brand gradient pulsing while working; darker as
    // the context fills up
    const pal = {
        L: [182, 92, 255], P: [152, 60, 242], E: [98, 20, 188], K: [44, 18, 70], O: [4, 2, 8],
        W: [255, 255, 255], M: [22, 4, 42], R: [120, 40, 160], S: [237, 171, 251], B: [140, 200, 255],
    };
    if (working) {
        const t = (Math.sin(frame * 0.9) + 1) / 2;
        const a = [139, 123, 245], b = [192, 105, 207];
        pal.P = a.map((v, i) => Math.round(v + (b[i] - v) * t));
        pal.L = pal.P.map((v) => Math.min(255, Math.round(v * 1.18)));
        pal.E = pal.P.map((v) => Math.round(v * 0.62));
    } else {
        const k = 1 - Math.min(1, Math.max(0, (pct - 50) / 40)) * 0.45;
        for (const c of ['L', 'P', 'E']) pal[c] = pal[c].map((v) => Math.round(v * k));
    }

    // A blank pixel row on top makes 14 rows = 7 terminal rows; each shows
    // two pixel rows with '▀' (fg = top pixel, bg = bottom pixel)
    const canvas = ['.'.repeat(14), ...grid];
    const rows = [];
    for (let l = 0; l < 7; l++) {
        const top = canvas[2 * l], bot = canvas[2 * l + 1];
        let s = '';
        for (let c = 0; c < 14; c++) {
            const t = top[c], b = bot[c];
            if (t === '.' && b === '.') s += `${reset} `;
            else if (b === '.') s += `${reset}${ESC}[38;2;${rgb(pal[t])}m▀`;
            else if (t === '.') s += `${reset}${ESC}[38;2;${rgb(pal[b])}m▄`;
            else s += `${ESC}[38;2;${rgb(pal[t])};48;2;${rgb(pal[b])}m▀`;
        }
        rows.push(s);
    }
    state.pos = 0;
    writeRows(rows, 0, 2);
    saveState();
    process.exit(0);
}

// ---- 3-line buddy ----

// Project identity: FNV-1a hash of the folder name -> body + color
let hash = 2166136261;
for (const ch of dirName.toLowerCase()) hash = Math.imul((hash ^ ch.charCodeAt(0)) >>> 0, 16777619) >>> 0;

// Every body is 7 columns wide; feet = stand, left foot up, right foot up
const bodies = [
    { top: '╭─────╮', l: '│', r: '│', feet: ['╰┬───┬╯', '╰┴───┬╯', '╰┬───┴╯'] },  // blob
    { top: '┌──┴──┐', l: '│', r: '│', feet: ['└┬───┬┘', '└┴───┬┘', '└┬───┴┘'] },  // robot
    { top: '╭^───^╮', l: '│', r: '│', feet: ['╰┬───┬╯', '╰┴───┬╯', '╰┬───┴╯'] },  // cat
    { top: '(o)─(o)', l: '│', r: '│', feet: ['╰┬───┬╯', '╰┴───┬╯', '╰┬───┴╯'] },  // bear
    { top: ".-~~~-.", l: '(', r: ')', feet: ["'-┬─┬-'", "'-┴─┬-'", "'-┬─┴-'"] },  // cloud
    { top: '╭─────╮', l: '│', r: '│', feet: ['╰v^v^v╯', '╰^v^v^╯', '╰v^v^v╯'] },  // ghost
];
// Base colors (RGB): sky, pink, purple, green, orange, blue, gold, coral
const palette = [
    [0, 215, 255], [255, 135, 255], [175, 135, 255], [135, 215, 135],
    [255, 175, 95], [95, 175, 255], [255, 215, 135], [255, 95, 135],
];
const body = bodies[hash % bodies.length];
const baseRgb = palette[Math.floor(hash / bodies.length) % palette.length];

function hueRgb(hue) {
    // Pastel rainbow: HSV with s=0.55, v=1
    const h = (hue % 360) / 60, s = 0.55;
    const x = 1 - s * (1 - Math.abs((h % 2) - 1)), m = 1 - s;
    const c = [[1, x, m], [x, 1, m], [m, 1, x], [m, x, 1], [x, m, 1], [1, m, x]][Math.floor(h)];
    return c.map((v) => Math.round(v * 255));
}

// Color: rainbow while Claude works; otherwise the project color, fading
// toward red as the context fills past 50%
let color;
if (working) {
    color = hueRgb(frame * 40);
} else {
    const k = Math.min(1, Math.max(0, (pct - 50) / 40)) * 0.85;
    color = baseRgb.map((v, i) => Math.round(v + ([255, 70, 70][i] - v) * k));
}
const bodyColor = `${ESC}[38;2;${rgb(color)}m`;
const spark = (c) => `${ESC}[38;2;255;240;150m${c}${bodyColor}`;

// Animation: a small state machine advanced once per render. While idle the
// mascot mostly stands facing front, and now and then walks a few steps,
// looks around, waves or jumps. While working it stays put, pumps its arms,
// reads and throws sparkles.
const span = 24 - 9;  // 24-column lane; 9 = body (7) + one arm column each side
let pos = Math.min(Math.max(state.pos, 0), span);
let look = 0, feet = body.feet[0], happy = false, blink = rand(100) < 12;
let armL = ' ', armR = ' ', topL = ' ', topR = ' ', botL = ' ', botR = ' ';

if (working) {
    state.action = 'stand'; state.left = 0;
    armL = frame % 2 ? '\\' : '/';
    armR = frame % 2 ? '/' : '\\';
    look = frame % 2 ? -1 : 1;
    blink = false;
    switch (frame % 4) {
        case 0: topL = spark('*'); botR = spark('+'); break;
        case 1: topR = spark('+'); botL = spark('·'); break;
        case 2: topR = spark('*'); botL = spark('+'); break;
        case 3: topL = spark('+'); botR = spark('·'); break;
    }
} else {
    if (state.left <= 0) {
        const roll = rand(100);
        if (roll < 45) { state.action = 'stand'; state.left = randIn(5, 11); }
        else if (roll < 70) { state.action = 'walk'; state.left = randIn(3, 9); state.dir = rand(2) ? 1 : -1; }
        else if (roll < 85) { state.action = 'look'; state.left = 4; }
        else if (roll < 95) { state.action = 'wave'; state.left = 4; }
        else { state.action = 'jump'; state.left = 4; }
    }
    const left = state.left;
    switch (state.action) {
        case 'walk': {
            let dir = state.dir;
            if (pos + dir < 0 || pos + dir > span) { dir = -dir; state.dir = dir; }
            pos += dir; look = dir; blink = false;
            feet = body.feet[1 + (frame % 2)];
            break;
        }
        case 'look': look = left > 2 ? -1 : 1; blink = false; break;
        case 'wave': happy = true; if (left % 2) topR = '/'; else armR = '/'; break;
        case 'jump':
            happy = true;
            if (left % 2) { topL = '\\'; topR = '/'; feet = body.feet[0].replaceAll('┬', '┴'); }
            break;
    }
    state.left = left - 1;
}
state.pos = pos;

// Eyes: mood from context; happy when waving or jumping; occasional blink
let eye = pct >= 50 && pct < 80 ? '▬' : '▮';
if (blink) eye = '─';
if (happy) eye = '^';
const face = look < 0 ? `${eye} ${eye}  ` : look > 0 ? `  ${eye} ${eye}` : ` ${eye} ${eye} `;
if (pct >= 80 && topR === ' ') topR = `${ESC}[38;5;117m'${bodyColor}`;

const mascot = [
    `${topL}${body.top}${topR}`,
    `${armL}${body.l}${face}${body.r}${armR}`,
    `${botL}${feet}${botR}`,
].map((s) => `${bodyColor}${s}${reset}`);
writeRows(mascot, pos, 0);
saveState();
