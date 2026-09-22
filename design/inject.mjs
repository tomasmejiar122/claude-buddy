// Injects design/buddies.json into the BUDDIES placeholder of a status line
// script. Usage: node design/inject.mjs <target.mjs>
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(import.meta.filename);  // handles spaces in the path
const json = fs.readFileSync(path.join(here, 'buddies.json'), 'utf8').trim();
const target = process.argv[2];
let s = fs.readFileSync(target, 'utf8');
if (!/\/\*BUDDIES\*\/[\s\S]*?\/\*END\*\//.test(s)) throw new Error('no BUDDIES placeholder in ' + target);
s = s.replace(/\/\*BUDDIES\*\/[\s\S]*?\/\*END\*\//, () => '/*BUDDIES*/' + json + '/*END*/');
fs.writeFileSync(target, s);
console.log(`injected ${(json.length / 1024).toFixed(1)} KB into ${target}`);
