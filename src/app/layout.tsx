import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sotaria Workspace',
  description: 'Shared thoughts, boards, tasks and calendars for a two-person business.',
  applicationName: 'Sotaria Workspace',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
};
export const viewport: Viewport = { themeColor: '#365e47' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
