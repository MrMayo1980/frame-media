import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {crc32,makeZip,filename,fetchFile} from '../archive.js';
import {safeURL} from '../web-client.js';
test('ZIP opens with standard Python reader, Unicode names and binary CRCs intact',async()=>{assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);const dir=mkdtempSync(join(tmpdir(),'frame-test-'));try{const zip=makeZip([{name:'001_Луна.jpg',data:new Uint8Array([0,255,13,10,128])},{name:'sources.json',data:'{"author":"Иван"}'}]);writeFileSync(join(dir,'test.zip'),Buffer.from(await zip.arrayBuffer()));execFileSync('python3',['-c',"import zipfile,sys,json; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert z.read('001_Луна.jpg')==bytes([0,255,13,10,128]); assert json.loads(z.read('sources.json'))['author']=='Иван'",join(dir,'test.zip')])}finally{rmSync(dir,{recursive:true})}});
test('filenames cannot escape folders and remain unique with identical titles',()=>{const item={title:'../../unsafe:name',url:'https://x.test/video.mp4',type:'video'};const a=filename(item,0),b=filename(item,1);assert(!/[\\/:]/.test(a));assert(a.endsWith('.mp4'));assert.notEqual(a,b)});
test('download rejects HTML error pages and oversized streamed files',async()=>{const original=globalThis.fetch;try{globalThis.fetch=async()=>new Response('<html>blocked</html>',{headers:{'content-type':'text/html'}});await assert.rejects(fetchFile('https://x.test',undefined,100),/страницу/);globalThis.fetch=async()=>new Response(new Uint8Array(20));await assert.rejects(fetchFile('https://x.test',undefined,10),/лимит/);const bytes=await fetchFile('https://x.test',undefined,30);assert.equal(bytes.length,20)}finally{globalThis.fetch=original}});
test('UI accepts HTTPS links and rejects executable or local file schemes',()=>{assert.equal(safeURL('javascript:alert(1)'), '');assert.equal(safeURL('file:///etc/passwd'),'');assert.equal(safeURL('https://example.org/a'),'https://example.org/a')});

test('proxy downloads preserve extension of original media',()=>{assert.equal(filename({title:'Cat',url:'https://api.example.org/api/asset?ticket=abc',originalURL:'https://cdn.example.org/cat.png',type:'photo'},0),'001_Cat.png')});
