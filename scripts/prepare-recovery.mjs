import { readFile, writeFile } from 'node:fs/promises';
import { recoverySql } from '../src/lib/backup-restore.ts';

const [source, destination] = process.argv.slice(2);
if (!source || !destination) {
  console.error('Usage: node scripts/prepare-recovery.mjs <backup.json> <new-recovery.sql>');
  process.exit(1);
}
try {
  const sql = recoverySql(JSON.parse(await readFile(source, 'utf8')));
  await writeFile(destination, sql, { flag: 'wx', mode: 0o600 });
  console.log('Recovery SQL prepared. Review it before applying. No database was changed.');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
