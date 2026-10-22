import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
const thought='44444444-4444-4444-8444-444444444444';
async function setup(){const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;grant usage on schema public,auth to authenticated;grant execute on all functions in schema auth to authenticated;insert into auth.users values('${a}'),('${b}'),('${c}');`);await db.exec(await readFile('supabase/migrations/001_workspace.sql','utf8'));return db;}
async function identity(db:PGlite,id:string,client?:string){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,...(client?{client_id:client}:{})})]);await db.exec('set role authenticated');}

test('two members share content while preserving authors, assignments and tenant boundaries',async()=>{
 const db=await setup();try{
 await db.exec(await readFile('supabase/migrations/002_shared_business.sql','utf8'));await db.exec(await readFile('supabase/migrations/004_hyphenated_tags.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/006_both_assignments.sql','utf8'));
 // Operator provisions the second seat; ordinary users cannot do this.
 await db.query('delete from public.workspace_members where user_id=$1',[b]);
 await db.query("insert into public.workspace_members(workspace_id,user_id,slot,display_name) values($1,$2,2,'Second member')",[a,b]);
 await assert.rejects(()=>db.query("insert into public.workspace_members(workspace_id,user_id,slot,display_name) values($1,$2,3,'Third member')",[a,c]));
 await identity(db,a);await db.query('select public.capture_thought($1,$2,$3)',[thought,'Review the client handoff #customer-relations','UTC']);
 await identity(db,b);
 assert.equal((await db.query<{created_by:string}>('select created_by from public.thoughts')).rows[0].created_by,a);
 assert.equal((await db.query('select * from public.workspace_members')).rows.length,2);
 const board=(await db.query<{id:string}>("insert into public.boards(id,title) values(gen_random_uuid(),'Operations') returning id")).rows[0].id;
 await db.query('select public.capture_thought($1,$2,$3)',[crypto.randomUUID(),'Shared tag #customer-relations','UTC']);
 assert.equal((await db.query('select * from public.tags')).rows.length,1);
 assert.equal((await db.query<{name:string}>('select name from public.tags')).rows[0].name,'customer-relations');
 await identity(db,a);
 const task=(await db.query<{id:string}>("insert into public.items(kind,title,source_id,assigned_to) values('task','Update checklist',$1,$2) returning id",[thought,b])).rows[0].id;
 await db.query("insert into public.items(kind,title,board_id,source_id) values('idea','Handoff idea',$1,$2)",[board,thought]);
 const event=(await db.query<{id:string}>("insert into public.items(kind,title,starts_at,ends_at,calendar_owner_id) values('event','Client review','2026-10-25T10:00:00Z','2026-10-25T11:00:00Z',$1) returning id",[b])).rows[0].id;
 const both=(await db.query<{id:string;for_both:boolean;calendar_owner_id:string|null}>("insert into public.items(kind,title,starts_at,ends_at,for_both) values('event','Together','2026-10-25T10:00:00Z','2026-10-25T11:00:00Z',true) returning *")).rows[0];
 assert.equal(both.for_both,true);assert.equal(both.calendar_owner_id,null);
 await db.query('update public.items set for_both=false,calendar_owner_id=$1 where id=$2',[a,both.id]);
 await db.query('update public.items set for_both=true,calendar_owner_id=null where id=$1',[both.id]);
 await assert.rejects(()=>db.query('update public.items set for_both=false where id=$1',[both.id]));
 await assert.rejects(()=>db.query("insert into public.items(kind,title,for_both) values('idea','Invalid',true)"));
 await assert.rejects(()=>db.query("insert into public.items(kind,title,for_both,assigned_to) values('task','Ambiguous',true,$1)",[a]));
 await identity(db,b);
 await db.query("update public.items set status='done' where id=$1",[task]);
 const changed=(await db.query<{created_by:string;assigned_to:string;updated_by:string}>('select created_by,assigned_to,updated_by from public.items where id=$1',[task])).rows[0];
 assert.deepEqual(changed,{created_by:a,assigned_to:b,updated_by:b});
 assert.equal((await db.query<{calendar_owner_id:string}>('select calendar_owner_id from public.items where id=$1',[event])).rows[0].calendar_owner_id,b);
 await assert.rejects(()=>db.query('update public.items set created_by=$1 where id=$2',[b,task]));
 await assert.rejects(()=>db.query('update public.items set workspace_id=$1 where id=$2',[c,task]));
 await assert.rejects(()=>db.query('update public.items set assigned_to=$1 where id=$2',[c,task]));
 await assert.rejects(()=>db.query('insert into public.thoughts(id,body,created_by) values(gen_random_uuid(),$1,$2)',['Spoofed author',a]));
 await assert.rejects(()=>db.query("insert into public.workspace_members(workspace_id,user_id,slot,display_name) values($1,$2,2,'Intruder')",[c,b]));
 await assert.rejects(()=>db.query('delete from public.thoughts where id=$1',[thought]));
 await identity(db,c);assert.equal((await db.query('select * from public.thoughts')).rows.length,0);
 await assert.rejects(()=>db.query("insert into public.items(kind,title,source_id) values('task','Foreign source',$1)",[thought]));
 await assert.rejects(()=>db.query("insert into public.items(kind,title,board_id) values('idea','Foreign board',$1)",[board]));
 await identity(db,a);
 const extraction=(await db.query<{id:string}>("insert into public.extractions(thought_id,suggestions,model) values($1,'[{}]','test') returning id",[thought])).rows[0].id;
 await identity(db,b);
 const edit={kind:'task',title:'Reviewed by second member',details:'',due_on:null,starts_at:null,ends_at:null,timezone:'UTC',assigned_to:null,calendar_owner_id:null,for_both:true};
 const accepted=(await db.query<{created_by:string;assigned_to:string|null;for_both:boolean;source_id:string}>('select * from public.accept_suggestions($1,$2,$3)',[extraction,[0],JSON.stringify([edit])])).rows[0];
 assert.equal(accepted.created_by,b);assert.equal(accepted.assigned_to,null);assert.equal(accepted.for_both,true);assert.equal(accepted.source_id,thought);
 await identity(db,a);await assert.rejects(()=>db.query('select * from public.accept_suggestions($1,$2,$3)',[extraction,[0],JSON.stringify([edit])]));
 await identity(db,b);await db.query("insert into public.mcp_grants(client_id) values('chatgpt-shared')");
 await identity(db,b,'chatgpt-shared');assert.equal((await db.query('select * from public.thoughts')).rows.length,2);
 await assert.rejects(()=>db.query("insert into public.items(kind,title) values('task','OAuth write')"));
 await db.query("update public.items set title='OAuth edit' where id=$1",[task]);
 assert.equal((await db.query<{title:string}>('select title from public.items where id=$1',[task])).rows[0].title,'Update checklist');
 await db.exec('reset role');await db.query('update public.workspace_members set active=false where user_id=$1',[b]);
 await identity(db,b,'chatgpt-shared');assert.equal((await db.query('select * from public.thoughts')).rows.length,0);
 await identity(db,b);assert.equal((await db.query('select * from public.items')).rows.length,0);
 await assert.rejects(()=>db.query('select public.consume_ai_attempt()'));
 await identity(db,a);assert.equal((await db.query<{created_by:string}>('select created_by from public.thoughts where id=$1',[thought])).rows[0].created_by,a);
 }finally{await db.close();}
});

test('upgrade preserves existing private records without silently sharing them',async()=>{
 const db=await setup();try{
 await identity(db,a);await db.query('select public.capture_thought($1,$2,$3)',[thought,'Existing private note','UTC']);
 await db.exec('reset role');await db.exec(await readFile('supabase/migrations/002_shared_business.sql','utf8'));await db.exec(await readFile('supabase/migrations/004_hyphenated_tags.sql','utf8'));
 await identity(db,b);assert.equal((await db.query('select * from public.thoughts')).rows.length,0);
 await identity(db,a);const row=(await db.query<{created_by:string;workspace_id:string;body:string}>('select * from public.thoughts')).rows[0];
 assert.equal(row.created_by,a);assert.equal(row.workspace_id,a);assert.equal(row.body,'Existing private note');
 }finally{await db.close();}
});
