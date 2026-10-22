import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { recoverySql } from '../src/lib/backup-restore';
const user = '11111111-1111-4111-8111-111111111111';
async function database() {
  const db = new PGlite();
  await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;create function auth.uid() returns uuid language sql as $$select null::uuid$$;");
  await db.query('insert into auth.users values($1)', [user]);
  await db.exec(await readFile('supabase/migrations/001_workspace.sql','utf8'));
  await db.exec(await readFile('supabase/migrations/002_shared_business.sql','utf8'));
  await db.exec(await readFile('supabase/migrations/006_both_assignments.sql','utf8'));
  return db;
}
test('export recovery preserves archived text, attribution and relations; reruns never overwrite', async () => {
  const source = await database(), target = await database();
  try {
    const body = "Angus's note\nLiteral backslash: \\ and SQL text: '); drop table public.items; --";
    const thought = '44444444-4444-4444-8444-444444444444';
    await source.query('insert into thoughts(id,created_by,workspace_id,body,archived) values($1,$2,$2,$3,true)', [thought,user,body]);
    await source.query("insert into items(created_by,workspace_id,kind,title,source_id,for_both,updated_by) values($1,$1,'task','Restore me',$2,true,$1)",[user,thought]);
    const tables: Record<string, unknown[]> = {};
    for (const table of ['workspaces','workspace_members','thoughts','boards','tags','thought_tags','items','extractions']) {
      tables[table] = (await source.query<Record<string,unknown>>('select * from '+table)).rows.map(({ search, ...row }) => row);
    }
    const backup = {format:'stillroom-workspace-export',version:1,workspace_id:user,tables};
    const sql = recoverySql(backup);
    await target.exec(sql);
    const restored = (await target.query<{body:string;archived:boolean;created_by:string}>('select * from thoughts')).rows[0];
    assert.equal(restored.body,body); assert.equal(restored.archived,true); assert.equal(restored.created_by,user);
    assert.equal((await target.query<{for_both:boolean}>('select * from items')).rows[0].for_both,true);
    const legacy=structuredClone(backup);delete (legacy.tables.items[0] as Record<string,unknown>).for_both;
    assert.doesNotThrow(()=>recoverySql(legacy));
    await target.query("update thoughts set body='Newer content'");
    await target.exec(sql);
    assert.equal((await target.query<{body:string}>('select body from thoughts')).rows[0].body,'Newer content');
    const wrong = structuredClone(backup);
    (wrong.tables.thoughts[0] as Record<string,unknown>).workspace_id='22222222-2222-4222-8222-222222222222';
    assert.throws(()=>recoverySql(wrong),/another workspace/);
    assert.throws(()=>recoverySql({...backup,version:2}),/Unsupported/);
  } finally { await source.close(); await target.close(); }
});
