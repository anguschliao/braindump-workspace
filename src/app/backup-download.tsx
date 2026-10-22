'use client';
import { useState } from 'react';
import { supabase } from '@/lib/browser';

export function BackupDownload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function download() {
    setBusy(true); setError(''); setDone(false);
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token) throw new Error('Sign in again before exporting.');
      const response = await fetch('/api/backup', { headers: { Authorization: 'Bearer ' + token } });
      if (!response.ok) throw new Error((await response.json()).error ?? 'Export failed.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = 'sotaria-workspace-' + new Date().toISOString().slice(0,10) + '.json';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Export failed.'); }
    finally { setBusy(false); }
  }
  return <section className="panel"><h2>Workspace backup</h2>
    <p>Download both members’ thoughts, boards, tasks, calendar, tags, and suggestions, including archived content and authorship.</p>
    <p>Pause editing on both devices during export. Keep the downloaded file somewhere private. This is a manual content export; account credentials and automatic backups are not included.</p>
    <button className="primary" disabled={busy} onClick={download}>{busy ? 'Preparing download…' : 'Download workspace data'}</button>
    {error && <p role="alert">{error}</p>}
    {done && <p role="status">Download requested. Check that the file was saved in your Downloads folder.</p>}
  </section>;
}

