// Trim a raw OpenRouter listing ({"data":[...]}) to the named Models, keeping
// each Model object's bytes exactly as the API returned them.
//
//   curl -sS --max-time 15 'https://openrouter.ai/api/v1/models?output_modalities=all' -o raw.json
//   node tools/trim-fixture.mjs raw.json test/fixtures/catalogue.json id1 id2 ...
import { readFileSync, writeFileSync } from 'node:fs';

const [rawPath, outPath, ...ids] = process.argv.slice(2);
const text = readFileSync(rawPath, 'utf8');
const start = text.indexOf('[', text.indexOf('"data"'));

// Walk the top-level array, slicing out each element's exact source text.
const spans = [];
let depth = 0, inStr = false, esc = false, objStart = -1;
for (let i = start + 1; i < text.length; i++) {
  const c = text[i];
  if (inStr) {
    if (esc) esc = false;
    else if (c === '\\') esc = true;
    else if (c === '"') inStr = false;
    continue;
  }
  if (c === '"') { inStr = true; continue; }
  if (c === '{' || c === '[') { if (depth === 0) objStart = i; depth++; }
  else if (c === '}' || c === ']') {
    if (depth === 0) break;
    depth--;
    if (depth === 0) spans.push(text.slice(objStart, i + 1));
  }
}

if (spans.length !== JSON.parse(text).data.length) throw new Error('element count mismatch');
const byId = new Map(spans.map(s => [JSON.parse(s).id, s]));
const missing = ids.filter(id => !byId.has(id));
if (missing.length) throw new Error('not in listing: ' + missing.join(', '));

const picked = spans.filter(s => ids.includes(JSON.parse(s).id));
writeFileSync(outPath, '{"data":[\n' + picked.join(',\n') + '\n]}\n');
console.log(`${picked.length} of ${spans.length} models written to ${outPath}`);
