import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Stillroom · Your shared business workspace',description:'Shared thoughts, boards, tasks and calendars for a two-person business.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
