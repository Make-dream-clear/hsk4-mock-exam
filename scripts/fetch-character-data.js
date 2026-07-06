#!/usr/bin/env node
'use strict';

// Extends data/character-data.json to cover every HSK 4 page character
// (150 writing + 291 recognition) plus the decomposition components / radicals
// they reference, and generates data/character-strokes.json (stroke SVG paths +
// per-stroke start points) for the 441 page characters.
//
// Data source: Make Me a Hanzi (https://github.com/skishore/makemeahanzi),
// released under the Arphic Public License. Run: node scripts/fetch-character-data.js
//
// Deterministic: entries are sorted by key before writing, so re-running with
// the same upstream data produces byte-identical output.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA = path.join(__dirname, '..', 'data');
const DICT_URL = 'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt';
const GRAPHICS_URL = 'https://raw.githubusercontent.com/skishore/makemeahanzi/master/graphics.txt';

function readJSON(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
}

function fetchLines(url) {
  console.log(`[fetch] ${url}`);
  const buf = execSync(`curl -sL --max-time 180 ${JSON.stringify(url)}`, { maxBuffer: 128 * 1024 * 1024 });
  return buf.toString('utf8').split('\n').filter(Boolean);
}

// ---- Page characters we must cover ----
const writing = readJSON('hsk4-characters.json');
const rendu = readJSON('hsk4-rendu-characters.json');
const pageChars = new Set([...writing, ...rendu].map(c => c.char));
console.log(`[chars] ${pageChars.size} page characters (150 writing + ${rendu.length} recognition)`);

// ---- Parse upstream dictionary into a char -> entry map ----
const dictLines = fetchLines(DICT_URL);
const upstream = {};
for (const line of dictLines) {
  let e;
  try { e = JSON.parse(line); } catch (_) { continue; }
  if (e && e.character) upstream[e.character] = e;
}
console.log(`[dict] parsed ${Object.keys(upstream).length} upstream entries`);

// Collect decomposition-component and radical characters referenced by the
// page characters (one level of recursion is enough for our templates).
function componentsOf(entry) {
  const out = [];
  if (entry && entry.decomposition) {
    for (const ch of entry.decomposition) {
      // skip IDS operators (⿰⿱…), placeholders (？), and non-CJK
      if (ch >= '⿰' && ch <= '⿿') continue;
      if (ch === '？') continue;
      if (ch >= '一' && ch <= '鿿') out.push(ch);
    }
  }
  if (entry && entry.radical) out.push(entry.radical);
  return out;
}

const needed = new Set(pageChars);
pageChars.forEach(ch => {
  const e = upstream[ch];
  if (!e) return;
  componentsOf(e).forEach(c => needed.add(c));
});
console.log(`[chars] ${needed.size} characters needed (page chars + components + radicals)`);

// ---- Merge: start from existing character-data.json, overlay upstream ----
const existing = fs.existsSync(path.join(DATA, 'character-data.json'))
  ? readJSON('character-data.json') : {};
const merged = { ...existing };
needed.forEach(ch => {
  if (upstream[ch]) merged[ch] = upstream[ch]; // upstream wins
});

// Sort keys for deterministic output.
const sortedCharData = {};
Object.keys(merged).sort().forEach(k => { sortedCharData[k] = merged[k]; });
fs.writeFileSync(
  path.join(DATA, 'character-data.json'),
  JSON.stringify(sortedCharData, null, 0) + '\n',
  'utf8'
);
console.log(`[write] data/character-data.json — ${Object.keys(sortedCharData).length} entries`);

// ---- Coverage report against page characters ----
const missingData = [...pageChars].filter(ch => !sortedCharData[ch]);
console.log(`[coverage] character-data: ${pageChars.size - missingData.length}/${pageChars.size} page chars`
  + (missingData.length ? `, missing: ${missingData.join('')}` : ''));

// ---- Stroke graphics for the 441 page characters only ----
const graphicsLines = fetchLines(GRAPHICS_URL);
const strokes = {};
for (const line of graphicsLines) {
  let e;
  try { e = JSON.parse(line); } catch (_) { continue; }
  if (!e || !pageChars.has(e.character) || !e.strokes) continue;
  // Keep the full stroke paths; reduce medians to each stroke's first point,
  // which is all the numbered-stroke-order diagram needs.
  const starts = (e.medians || []).map(m => (m && m[0]) ? m[0] : null);
  strokes[e.character] = { strokes: e.strokes, starts };
}
const sortedStrokes = {};
Object.keys(strokes).sort().forEach(k => { sortedStrokes[k] = strokes[k]; });
fs.writeFileSync(
  path.join(DATA, 'character-strokes.json'),
  JSON.stringify(sortedStrokes, null, 0) + '\n',
  'utf8'
);
const strokeBytes = fs.statSync(path.join(DATA, 'character-strokes.json')).size;
console.log(`[write] data/character-strokes.json — ${Object.keys(sortedStrokes).length} chars, `
  + `${(strokeBytes / 1024 / 1024).toFixed(2)}MB`);
const missingStrokes = [...pageChars].filter(ch => !sortedStrokes[ch]);
console.log(`[coverage] strokes: ${pageChars.size - missingStrokes.length}/${pageChars.size} page chars`
  + (missingStrokes.length ? `, missing: ${missingStrokes.join('')}` : ''));
