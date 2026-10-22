const columns: Record<string, string[]> = {
  workspaces: ['id', 'name', 'created_at'],
  workspace_members: ['workspace_id', 'user_id', 'slot', 'display_name', 'active', 'created_at'],
  thoughts: ['id', 'created_by', 'body', 'timezone', 'archived', 'created_at', 'workspace_id'],
  boards: ['id', 'created_by', 'title', 'created_at', 'workspace_id'],
  tags: ['id', 'created_by', 'name', 'workspace_id'],
  thought_tags: ['created_by', 'thought_id', 'tag_id', 'workspace_id'],
  items: ['id', 'created_by', 'kind', 'title', 'details', 'status', 'source_id', 'board_id', 'due_on', 'starts_at', 'ends_at', 'timezone', 'created_at', 'workspace_id', 'assigned_to', 'calendar_owner_id', 'updated_by', 'updated_at'],
  extractions: ['id', 'created_by', 'thought_id', 'suggestions', 'accepted_ids', 'model', 'created_at', 'workspace_id'],
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid export object.');
  return value as Record<string, unknown>;
}

// Operator-only SQL for inserting missing rows. Never execute this through a browser/API.
export function recoverySql(input: unknown): string {
  const backup = object(input);
  if (backup.format !== 'stillroom-workspace-export' || backup.version !== 1 ||
      typeof backup.workspace_id !== 'string' || !uuid.test(backup.workspace_id))
    throw new Error('Unsupported export format.');
  const tables = object(backup.tables);
  if (Object.keys(tables).some(name => !(name in columns))) throw new Error('Unexpected table in export.');
  const statements = [
    '-- Review before running as a database operator. Contains private business data.',
    '-- Inserts missing records only. Existing records are never overwritten.',
    '-- Requires migrations 001 and 002 and the same auth user IDs.',
    'begin;',
    "set local standard_conforming_strings = on;",
  ];
  for (const [table, fields] of Object.entries(columns)) {
    const rows = tables[table];
    if (!Array.isArray(rows)) throw new Error('Missing export table: ' + table);
    for (const value of rows) {
      const row = object(value);
      if ((table === 'workspaces' ? row.id : row.workspace_id) !== backup.workspace_id)
        throw new Error('Export contains another workspace.');
      if (Object.keys(row).some(key => !fields.includes(key)) || fields.some(key => !(key in row)))
        throw new Error('Unexpected or missing fields in ' + table);
    }
    if (!rows.length) continue;
    const literal = JSON.stringify(rows).replace(/'/g, "''");
    const target = table === 'workspace_members' ? 'workspace_id,user_id' :
      table === 'thought_tags' ? 'workspace_id,thought_id,tag_id' : 'id';
    statements.push(
      'insert into public.' + table + ' (' + fields.join(',') + ')',
      'select ' + fields.join(',') + " from jsonb_populate_recordset(null::public." + table + ", '" + literal + "'::jsonb)",
      'on conflict (' + target + ') do nothing;'
    );
  }
  if ((tables.workspaces as unknown[]).length !== 1) throw new Error('Expected one workspace.');
  statements.push('commit;');
  return statements.join(String.fromCharCode(10)) + String.fromCharCode(10);
}

