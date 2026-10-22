import { authenticate, checkOrigin, fail, HttpError } from '@/lib/server';
export const runtime = 'nodejs';

// Read under the caller's RLS permissions, never a service-role key.
// This portable export is not an atomic database snapshot.
export async function GET(req: Request) {
  try {
    checkOrigin(req);
    const { db, clientId } = await authenticate(req);
    if (clientId) throw new HttpError(403, 'Export requires a workspace sign-in.');
    const membership = await db.rpc('active_workspace');
    if (membership.error) throw membership.error;
    if (!membership.data) throw new HttpError(403, 'Active workspace membership required.');
    const workspaceId = membership.data;
    const tables = ['workspaces', 'workspace_members', 'thoughts', 'boards', 'items', 'tags', 'thought_tags', 'extractions'];
    const data: Record<string, unknown[]> = {};
    for (const table of tables) {
      data[table] = [];
      let offset = 0;
      while (true) {
        let query = db.from(table).select('*').eq(table === 'workspaces' ? 'id' : 'workspace_id', workspaceId);
        if (table === 'thought_tags') query = query.order('thought_id').order('tag_id');
        else query = query.order(table === 'workspace_members' ? 'user_id' : 'id');
        const result = await query.range(offset, offset + 499);
        if (result.error) throw result.error;
        const rows = result.data ?? [];
        data[table].push(...rows.map(row => {
          const { search: _search, ...content } = row;
          return content;
        }));
        offset += rows.length;
        if (!rows.length) break;
        if (offset > 100000) throw new HttpError(413, 'Workspace is too large for a portable export. Use a database backup.');
      }
    }
    return Response.json({
      format: 'stillroom-workspace-export', version: 1,
      exported_at: new Date().toISOString(), workspace_id: workspaceId,
      note: 'Portable content export, not an atomic database snapshot. Pause edits while exporting. Auth accounts, passwords, sessions, OAuth grants and rate limits are excluded.',
      tables: data,
    }, { headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': 'attachment; filename="sotaria-workspace-backup.json"',
    } });
  } catch (e) { return fail(e); }
}

