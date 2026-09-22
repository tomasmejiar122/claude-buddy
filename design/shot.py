"""Render the status line as an image, to see what it really looks like.

    python design/shot.py out.png '{"character":"mr","size":"mini"}' [more configs...]

Each config is the per-folder entry (character, size, show, color, segments).
It runs claude-buddy.mjs for real with that config and draws the ANSI output.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
SCRIPT = HERE.parent / "claude-buddy.mjs"
CW, CH = 9, 18  # terminal cell size in the drawing
BG = (18, 16, 26)


def run(config, payload_extra=None):
    home = Path(tempfile.mkdtemp())
    (home / ".claude").mkdir()
    folder = home / "proyecto"
    folder.mkdir()
    (home / ".claude" / "claude-buddy.json").write_text(
        json.dumps({"projects": {str(folder).replace("\\", "/").lower(): config}}), encoding="utf8")
    transcript = home / "t.jsonl"
    transcript.write_text("x", encoding="utf8")
    payload = {
        "session_id": "shot",
        "model": {"display_name": "Opus 5"},
        "workspace": {"current_dir": str(folder)},
        "context_window": {"used_percentage": 42},
        "transcript_path": str(transcript),
        "cost": {"total_lines_added": 120, "total_lines_removed": 35},
    }
    payload.update(payload_extra or {})
    # Claude Code sets COLUMNS to the terminal width; imitate a wide window
    env = {**os.environ, "USERPROFILE": str(home), "HOME": str(home),
           "COLUMNS": os.environ.get("SHOT_COLUMNS", "100")}
    out = subprocess.run(["node", str(SCRIPT)], input=json.dumps(payload), env=env,
                         capture_output=True, text=True, encoding="utf8")
    return out.stdout.splitlines()


def draw(lines, img, ox, oy):
    d = ImageDraw.Draw(img)
    for y, line in enumerate(lines):
        fg, bg, x = (200, 200, 200), None, 0
        for tok in re.split(r"(\x1b\[[0-9;]*m)", line):
            m = re.fullmatch(r"\x1b\[([0-9;]*)m", tok)
            if m:
                p = [int(v) for v in m.group(1).split(";") if v]
                i = 0
                while i < len(p):
                    if p[i] == 0: fg, bg = (200, 200, 200), None
                    elif p[i] == 49: bg = None
                    elif p[i] == 38 and p[i + 1] == 2: fg = tuple(p[i + 2:i + 5]); i += 4
                    elif p[i] == 48 and p[i + 1] == 2: bg = tuple(p[i + 2:i + 5]); i += 4
                    elif p[i] in (38, 48) and p[i + 1] == 5: i += 2
                    i += 1
                continue
            for ch in tok:
                x0, y0 = ox + x * CW, oy + y * CH
                if bg:
                    d.rectangle([x0, y0, x0 + CW - 1, y0 + CH - 1], fill=bg)
                if ch == "█":
                    d.rectangle([x0, y0, x0 + CW - 1, y0 + CH - 1], fill=fg)
                elif ch == "▀":
                    d.rectangle([x0, y0, x0 + CW - 1, y0 + CH // 2 - 1], fill=fg)
                elif ch == "▄":
                    d.rectangle([x0, y0 + CH // 2, x0 + CW - 1, y0 + CH - 1], fill=fg)
                elif ch not in " \xa0⠀":
                    d.text((x0, y0 + 2), ch, fill=fg)
                x += 1


def main():
    out_path, configs = sys.argv[1], [json.loads(a) for a in sys.argv[2:]]
    shots = [run(c) for c in configs]
    width = max(max((len(re.sub(r"\x1b\[[0-9;]*m", "", l)) for l in s), default=0) for s in shots)
    height = sum(len(s) for s in shots) + len(shots)
    img = Image.new("RGB", (width * CW + 20, height * CH + 20), BG)
    y = 10
    for s in shots:
        draw(s, img, 10, y)
        y += (len(s) + 1) * CH
    img.save(out_path)
    print(f"{len(shots)} configuraciones -> {out_path}")


if __name__ == "__main__":
    main()
