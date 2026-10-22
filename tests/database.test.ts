import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',thought='33333333-3333-4333-8333-333333333333';
test('real PostgreSQL RLS, reference integrity, read-only OAuth and atomic acceptance',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;grant usage on schema public,auth to authenticated;grant execute on all functions in schema auth to authenticated;insert into auth.users values('${a}'),('${b}');`);
 await db.exec(await readFile('supabase/migrations/001_workspace.sql','utf8'));
 async function identity(id:string,client?:string){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,...(client?{client_id:client}:{})})]);await db.exec('set role authenticated');}
 await identity(a);
 await db.query('select public.capture_thought($1,$2,$3)',[thought,'Call Alex #Home #home','America/Edmonton']);
 await db.query('select public.capture_thought($1,$2,$3)',[thought,'Call Alex #Home #home','America/Edmonton']);
 assert.equal((await db.query('select * from public.thoughts')).rows.length,1);
 assert.equal((await db.query('select * from public.thought_tags')).rows.length,1);
 await assert.rejects(()=>db.query('select public.capture_thought($1,$2,$3)',[thought,'different','UTC']));
 await identity(b);
 assert.equal((await db.query('select * from public.thoughts')).rows.length,0);
 await assert.rejects(()=>db.query("insert into public.items(kind,title,source_id) values('task','stolen',$1)",[thought]));
 await assert.rejects(()=>db.query('insert into public.thoughts(id,owner_id,body) values(gen_random_uuid(),$1,$2)',[a,'spoof']));
 await identity(a,'chatgpt-test');
 assert.equal((await db.query('select * from public.thoughts')).rows.length,0);
 await assert.rejects(()=>db.query("insert into public.mcp_grants(owner_id,client_id) values($1,'chatgpt-test')",[a]));
 await identity(a);await db.query("insert into public.mcp_grants(owner_id,client_id) values($1,'chatgpt-test')",[a]);
 await identity(a,'chatgpt-test');assert.equal((await db.query('select * from public.thoughts')).rows.length,1);
 await assert.rejects(()=>db.query("insert into public.thoughts(id,body) values(gen_random_uuid(),'write')"));
 await assert.rejects(()=>db.query('select public.consume_ai_attempt()'));
 await db.query("update public.thoughts set body='changed'");assert.equal((await db.query<{body:string}>('select body from public.thoughts')).rows[0].body,'Call Alex #Home #home');
 await identity(a);await db.query("delete from public.mcp_grants where client_id='chatgpt-test'");
 await identity(a,'chatgpt-test');assert.equal((await db.query('select * from public.thoughts')).rows.length,0);
 await identity(a);
 for(let i=0;i<10;i++)assert.equal((await db.query<{ok:boolean}>('select public.consume_ai_attempt() as ok')).rows[0].ok,true);
 assert.equal((await db.query<{ok:boolean}>('select public.consume_ai_attempt() as ok')).rows[0].ok,false);
 await assert.rejects(()=>db.query('delete from public.usage_buckets'));
 const ex=(await db.query<{id:string}>("insert into public.extractions(thought_id,suggestions,model) values($1,'[{},{}]','test') returning id",[thought])).rows[0].id;
 const edit={kind:'task',title:'Call Alex',details:'',due_on:null,starts_at:null,ends_at:null,timezone:'UTC'};
 await assert.rejects(()=>db.query('select * from public.accept_suggestions($1,$2,$3)',[ex,[0,0],JSON.stringify([edit,edit])]));
 assert.equal((await db.query('select * from public.items')).rows.length,0);
 await db.query('select * from public.accept_suggestions($1,$2,$3)',[ex,[0],JSON.stringify([edit])]);
 await assert.rejects(()=>db.query('select * from public.accept_suggestions($1,$2,$3)',[ex,[0],JSON.stringify([edit])]));
 assert.equal((await db.query('select * from public.items')).rows.length,1);
 }finally{await db.close();}
});
