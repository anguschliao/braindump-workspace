import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
const thought='44444444-4444-4444-8444-444444444444';
async function setup(){const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;grant usage on schema public,auth to authenticated;grant execute on all functions in schema auth to authenticated;insert into auth.users values('${a}'),('${b}'),('${c}');`);await db.exec(await readFile('supabase/migrations/001_workspace.sql','utf8'));return db;}
async function identity(db:PGlite,id:string,client?:string){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,...(client?{client_id:client}:{})})]);await db.exec('set role authenticated');}


test('AI reservations deduplicate both members and enforce one shared monthly cap without daily limits',async()=>{
 const db=await setup();try{
 await db.exec(await readFile('supabase/migrations/002_shared_business.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/003_ai_budget.sql','utf8'));
 await db.query('delete from workspace_members where user_id=$1',[b]);
 await db.query("insert into workspace_members(workspace_id,user_id,slot,display_name) values($1,$2,2,'Second')",[a,b]);
 await identity(db,a);
 await db.query('select capture_thought($1,$2,$3)',[thought,'Call the supplier','UTC']);
 assert.equal((await db.query<{s:string}>('select reserve_ai_thought($1) s',[thought])).rows[0].s,'reserved');
 await identity(db,b);
 assert.equal((await db.query<{s:string}>('select reserve_ai_thought($1) s',[thought])).rows[0].s,'existing');
 for(let i=0;i<11;i++){
 const id=crypto.randomUUID();
 await db.query('select capture_thought($1,$2,$3)',[id,'Another action','UTC']);
 assert.equal((await db.query<{s:string}>('select reserve_ai_thought($1) s',[id])).rows[0].s,'reserved');
 }
 await assert.rejects(()=>db.exec('update ai_monthly_budget set reserved_microdollars=0'));
 await assert.rejects(()=>db.exec('delete from ai_attempts'));
 await identity(db,c);
 await assert.rejects(()=>db.query('select reserve_ai_thought($1)',[thought]));
 await identity(db,b,'oauth-client');
 await assert.rejects(()=>db.query('select reserve_ai_thought($1)',[thought]));
 await db.exec('reset role');
 await db.exec('update ai_monthly_budget set reserved_microdollars=4999999');
 await identity(db,a);
 const last=crypto.randomUUID();
 await db.query('select capture_thought($1,$2,$3)',[last,'Budget exhausted but capture still works','UTC']);
 assert.equal((await db.query<{s:string}>('select reserve_ai_thought($1) s',[last])).rows[0].s,'budget');
 await db.exec('reset role');
 assert.equal((await db.query<{n:string}>('select reserved_microdollars::text n from ai_monthly_budget')).rows[0].n,'4999999');
 assert.equal((await db.query('select * from thoughts where id=$1',[last])).rows.length,1);
 }finally{await db.close();}
});
