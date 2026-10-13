/* global __dirname */
// M1a-only dependency correction; see docs/M1a_EPUB_Feasibility.md section P.
// Preserve the parser/grammar. Avoid copying the entire remaining XML at each
// attribute/text scan on Hermes. Pin both Node and Metro artifacts, fail closed
// on drift, and verify the installed correction in normal checks.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..', 'node_modules', '@rgrove', 'parse-xml');
const digest = (source) => createHash('sha256').update(source).digest('hex');
const patches = [
  { file: 'dist/lib/StringScanner.js', hash: 'bf44199c1ad79c15af74d9ead4a960fcf56d1a124ead993e2bd232ce307db8c8',
    before: `        let matchByteIndex = this.string
            .slice(this.charIndexToByteIndex())
            .search(regex);
        return matchByteIndex > 0
            ? this.consumeBytes(matchByteIndex)
            : emptyString;`, string: 'string', index: 'charIndexToByteIndex', consume: 'consumeBytes', indent: '        ', marker: "const emptyString = '';" },
  { file: 'dist/browser.js', hash: 'e69adeca44e0215c48216cee6187371a24371946cec23acd7980dfd41982e3ba',
    before: `    let matchByteIndex = this.h.slice(this.f()).search(regex);
    return matchByteIndex > 0 ? this.v(matchByteIndex) : emptyString;`, string: 'h', index: 'f', consume: 'v', indent: '    ', marker: 'var emptyString = "";' },
];
function replacement(p) {
  // All four private call-site patterns are unanchored, without lookbehind or
  // sticky flags. Absolute UTF-16 indices preserve the scanner's codepoint map.
  return [
    'let search = stowawayXmlSearches.get(regex);',
    'if (!search) {',
    '  search = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");',
    '  stowawayXmlSearches.set(regex, search);',
    '}',
    `const at = this.${p.index}();`,
    `if (at >= this.${p.string}.length) return emptyString;`,
    'search.lastIndex = at;',
    `const match = search.exec(this.${p.string});`,
    `return match && match.index > at ? this.${p.consume}(match.index - at) : emptyString;`,
  ].map((line) => p.indent + line).join('\n');
}
function correct(source, p) {
  if (digest(source) !== p.hash || !source.includes(p.before) || !source.includes(p.marker)) throw new Error('Unexpected XML dependency artifact; review required.');
  return source.replace(p.marker, p.marker + '\nconst stowawayXmlSearches = new WeakMap();').replace(p.before, replacement(p));
}
function apply(checkOnly = false) {
  if (JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version !== '5.0.0') throw new Error('Unexpected XML dependency version; review required.');
  // Validate every artifact before writing either. Re-running is idempotent.
  const changes = patches.map((p) => {
    const target = path.join(root, p.file), source = fs.readFileSync(target, 'utf8');
    const original = source.replace(p.marker + '\nconst stowawayXmlSearches = new WeakMap();', p.marker).replace(replacement(p), p.before);
    const expected = correct(original, p);
    if (source !== original && source !== expected) throw new Error('Unexpected XML dependency patch state.');
    if (checkOnly && source !== expected) throw new Error('XML performance correction missing; run npm install.');
    return { target, source, expected };
  });
  if (!checkOnly) for (const change of changes) if (change.source !== change.expected) fs.writeFileSync(change.target, change.expected);
}
if (require.main === module) { apply(process.argv.includes('--check')); console.log('Pinned EPUB XML scanner correction verified.'); }
module.exports = { apply, correct, patches, replacement };
