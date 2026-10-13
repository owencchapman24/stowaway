import { XmlComment, XmlProcessingInstruction } from '@rgrove/parse-xml';
import { strictXml } from '../src/epub-spike/xml';
import { context, LIMITS } from '../src/epub-spike/limits';
import { utf8 } from '../src/epub-spike/bytes';
import { epubEntries, makeZip } from '../src/epub-spike/fixtures';
import { processEpub } from '../src/epub-spike/package';

test('literal CR/CRLF normalize in text, attributes, comments, CDATA and PI; numeric CR references do not',async()=>{
  const root=await strictXml(utf8('<r a="a\rb\r\nc\nd&#13;e&#xD;f">T\rU\r\nV\nW&#13;X&#xD;Y<!--C\rD\r\nE--><![CDATA[F\rG\r\nH&#13;]]><?probe P\rQ\r\nR?></r>'),context());
  expect(root.attributes.a).toBe('a b c d\re\rf');
  expect(root.text).toBe('T\nU\nV\nW\rX\rYF\nG\nH&#13;');
  expect(root.children.find((c)=>c instanceof XmlComment)).toMatchObject({content:'C\nD\nE'});
  expect(root.children.find((c)=>c instanceof XmlProcessingInstruction)).toMatchObject({content:'P\nQ\nR'});
});
test.each([4091,4092,4093,8190])('CRLF and surrogate pairs remain correct near normalization chunk %i',async(padding)=>{
  const text='x'.repeat(padding)+'\r\n🌊\rZ';
  expect((await strictXml(utf8('<r>'+text+'</r>'),context())).text).toBe('x'.repeat(padding)+'\n🌊\nZ');
});
test('source string cap applies before normalization could shrink CRLF input',async()=>{
  await expect(strictXml(utf8('<r>'+'\r\n'.repeat(LIMITS.string/2)+'</r>'),context())).rejects.toMatchObject({code:'budget'});
});
test.each([
  [0,'1.0','UTF-8',true],[1,'1.0','UTF-8',true],[2,'1.0','UTF-8',false],[3,'1.0','UTF-8',false],
  [1,'1.0','UTF-16',false],[2,'1.0','UTF-16',false],[1,'1.1','UTF-8',false],[2,'1.1','UTF-8',false],
] as const)('complete packages: %i BOMs / XML %s / %s',async(boms,version,encoding,accepted)=>{
  // Exercise both package-control XML and chapter XML, not only a helper.
  for(const name of ['META-INF/container.xml','Book/package.opf','Book/Text/main.xhtml']) {
    const bytes=makeZip(epubEntries().map((e)=>e.name===name?{...e,text:'\ufeff'.repeat(boms)+`<?xml version="${version}" encoding="${encoding}"?>`+e.text!}:e));
    const result=processEpub({size:bytes.length,async read(at,n){return bytes.slice(at,at+n);},close(){}},context());
    if(accepted)expect((await result).chapters).toHaveLength(3);else await expect(result).rejects.toMatchObject({code:'xml'});
  }
});
test.each(['<?xml version="1.0" encoding="UTF-8" broken?>','<?xml version="1.0" version="1.1"?>','<?xml encoding="UTF-8"?>'])('malformed declarations stay rejected: %s',async(declaration)=>{
  await expect(strictXml(utf8('\ufeff'+declaration+'<r/>'),context())).rejects.toMatchObject({code:'xml'});
});
