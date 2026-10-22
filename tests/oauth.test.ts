import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('OAuth resource binding preserves native login and requires approved client, membership and consent',async()=>{
 const db=new PGlite();
 const user='11111111-1111-4111-8111-111111111111',client='chatgpt-test',resource='https://workspace.example/api/mcp';
 try{
 await db.exec("create role anon;create role authenticated;create role supabase_auth_admin;create table public.workspace_members(user_id uuid,active boolean);create table public.mcp_grants(owner_id uuid,client_id text);");
 await db.exec(await readFile('supabase/migrations/005_mcp_oauth.sql','utf8'));
 await db.query('insert into public.mcp_oauth_clients(client_id,resource) values($1,$2)',[client,resource]);
 const native={claims:{sub:user,aud:'authenticated',role:'authenticated'}};
 const invoke=async(event:unknown)=>(await db.query<{result:typeof native}>('select public.mcp_access_token_hook($1::jsonb) as result',[JSON.stringify(event)])).rows[0].result;
 assert.deepEqual(await invoke(native),native);
 const oauth={claims:{...native.claims,client_id:client}};
 await assert.rejects(()=>invoke(oauth));
 await db.query('insert into public.workspace_members values($1,true)',[user]);
 await assert.rejects(()=>invoke(oauth));
 await db.query('insert into public.mcp_grants values($1,$2)',[user,client]);
 assert.deepEqual((await invoke(oauth)).claims.aud,['authenticated',resource]);
 assert.equal((await invoke({claims:{...native.claims,client_id:'unknown'}})).claims.aud,'authenticated');
 await db.query('delete from public.mcp_grants where owner_id=$1',[user]);
 await assert.rejects(()=>invoke(oauth));
 await db.exec('set role authenticated');
 await assert.rejects(()=>invoke(native));
 await assert.rejects(()=>db.query('select * from public.mcp_oauth_clients'));
 }finally{await db.close();}
});
