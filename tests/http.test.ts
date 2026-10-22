import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkOrigin,readJson,HttpError } from '../src/lib/server';
test('API rejects cross-origin mutations, wrong content types and oversized bodies',async()=>{
 process.env.APP_ORIGIN='https://workspace.example';
 assert.throws(()=>checkOrigin(new Request('https://workspace.example/api/workspace',{headers:{origin:'https://attacker.example'}})),(e:unknown)=>e instanceof HttpError&&e.status===403);
 assert.doesNotThrow(()=>checkOrigin(new Request('https://workspace.example/api/workspace',{headers:{origin:'https://workspace.example'}})));
 await assert.rejects(()=>readJson(new Request('https://workspace.example',{method:'POST',body:'{}'})),(e:unknown)=>e instanceof HttpError&&e.status===415);
 await assert.rejects(()=>readJson(new Request('https://workspace.example',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({body:'a'.repeat(33000)})})),(e:unknown)=>e instanceof HttpError&&e.status===413);
 await assert.rejects(()=>readJson(new Request('https://workspace.example',{method:'POST',headers:{'content-type':'application/json'},body:'{'})),(e:unknown)=>e instanceof HttpError&&e.status===400);
});
