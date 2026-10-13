/* global __dirname */
// Independent synthetic parser experiment. No app runtime mutation. Optional
// --hermes <exe> runs an explicitly supplied CLI, never downloads/installs it.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const ts = require('typescript');
const { patches, correct, replacement, apply } = require('./epub-patch-parser.cjs');
const root = path.resolve(__dirname, '..');
apply(true);
const patch = patches[1], installed = fs.readFileSync(path.join(root, 'node_modules/@rgrove/parse-xml', patch.file), 'utf8');
const original = installed.replace(patch.marker + '\nconst stowawayXmlSearches = new WeakMap();', patch.marker).replace(replacement(patch), patch.before);
if (correct(original, patch) !== installed) throw new Error('Unexpected benchmark artifacts.');
const withoutExports = (source) => source.replace(/export \{[\s\S]*?\};\s*$/, '');
const body = String.raw`
var searches=0,suffixUnits=0,originalScan=StringScanner.prototype.x,originalSlice=String.prototype.slice;
StringScanner.prototype.x=function(regex){searches++;return originalScan.call(this,regex);};
String.prototype.slice=function(start,end){if(end===undefined)suffixUnits+=Math.max(0,this.length-(start||0));return originalSlice.call(this,start,end);};
function sample(n,attrs,depth,text,rootAttrs,empty){var attr='';for(var a=0;a<attrs;a++)attr+=' xmlns:a'+a+'="urn:'+a+'" a'+a+':k="value"';return '<r'+(rootAttrs?attr:'')+'>'+'<div>'.repeat(depth)+('<p'+(!rootAttrs?attr:'')+(empty?'/>':'>prose</p>')).repeat(n)+'z'.repeat(text)+'</div>'.repeat(depth)+'</r>';}
var inputs=[['siblings-1000',1000,1,0,0,false,false],['siblings-3000',3000,1,0,0,false,false],['siblings-9000',9000,1,0,0,false,false],['no-attributes',9000,0,0,0,false,false],['attributes-8',2000,8,0,0,false,false],['root-bindings',9000,1,0,0,true,false],['depth-10',3000,1,10,0,false,false],['depth-40',3000,1,40,0,false,false],['text-100k',0,0,0,100000,false,false],['text-981k',0,0,0,981000,false,false],['siblings-before-tail',3000,0,0,500000,false,false],['empty-nodes',9000,0,0,0,false,true]];
var rows=[];
for(var c of inputs){var source=sample(c[1],c[2],c[3],c[4],c[5],c[6]);searches=0;suffixUnits=0;var start=Date.now(),doc=parseXml(source,{preserveComments:true,preserveXmlDeclaration:true});var elapsed=Date.now()-start;var count=0;function visit(n){count++;if(n.children)for(var child of n.children)visit(child);}visit(doc);rows.push({id:c[0],units:source.length,nodes:count,ms:elapsed,searches:searches,suffixUnits:suffixUnits,correct:doc.root.text===(c[6]?'':'prose'.repeat(c[1]))+'z'.repeat(c[4])});}
// Full-tree/offset differential cases also exercise references, supplementary
// codepoints, quoted delimiters, malformed tokens and end-of-input searches.
var edgeInputs=['<r/>','<r></r>','<r>🌊 &amp; &#x1f30a; &#13; X</r>','<r a="🌊 &quot; &lt; &#13;" b=\'a"b\'>😀<p/>Z</r>','<?xml version="1.0"?><r><!--x--><![CDATA[x<&]]><?p abc?></r>','<r><!-- --></r>','<r><![CDATA[]]></r>','<r>','<r>text','<r a="','<r a="x','<r>&bad;</r>','<r>&#0;</r>','<r>]]></r>','<r a="1" a="2"/>','<r></r>x','<r>\u0000</r>','<r>\ud800</r>','<r a="x<y"/>','<!DOCTYPE r [<!ENTITY x "z">]><r/>'];
var edges=edgeInputs.map(function(s){try{return {accepted:true,tree:parseXml(s,{preserveComments:true,preserveXmlDeclaration:true,includeOffsets:true}).toJSON()};}catch(e){return {accepted:false};}});
RESULT={mode:MODE,rows:rows,edges:edges};
`;
function program(source, mode) { return 'var MODE=' + JSON.stringify(mode) + ';var RESULT;\n' + withoutExports(source) + '\n' + body; }
function run(source, mode, executable) {
  const code = program(source, mode);
  if (!executable) { const sandbox = {}; vm.runInNewContext(code, sandbox); return sandbox.RESULT; }
  const destination = path.join(root, 'dist/m1a-reports'); fs.mkdirSync(destination, {recursive:true});
  const file = path.join(destination, 'parser-benchmark-' + mode + '.js');
  fs.writeFileSync(file, ts.transpileModule(code + '\nprint(JSON.stringify(RESULT));', { compilerOptions: {target:ts.ScriptTarget.ES5,downlevelIteration:true} }).outputText);
  const result = spawnSync(executable, ['-O', file], {encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  if (result.error || result.status !== 0) throw new Error('Hermes CLI benchmark failed: ' + result.stderr);
  return JSON.parse(result.stdout);
}
const at = process.argv.indexOf('--hermes'), executable = at < 0 ? null : process.argv[at + 1];
if (at >= 0 && !executable) throw new Error('Supply an explicit Hermes CLI path.');
const before = run(original,'original',executable), after = run(installed,'corrected',executable);
if (JSON.stringify(before.edges)!==JSON.stringify(after.edges) || [...before.rows,...after.rows].some((r)=>!r.correct) ||
  before.rows.some((r,i)=>r.searches!==after.rows[i].searches || r.nodes!==after.rows[i].nodes)) throw new Error('Parser differential failed.');
const report = { runtime:executable?'Explicit standalone Hermes CLI (not iPhone acceptance)':`Node ${process.version}`, originalSha256:patch.hash,
  correctedSha256:createHash('sha256').update(installed).digest('hex'), differentialCases:before.edges.length, before:before.rows, after:after.rows };
const dir=path.join(root,'dist/m1a-reports');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,executable?'parser-hermes-cli.json':'parser-node.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
