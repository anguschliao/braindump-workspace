'use client';
import { useEffect,useState } from 'react';
import { supabase } from '@/lib/browser';
type Details={authorization_id:string;redirect_uri:string;client:{id:string;name:string};scope:string};
export default function Consent({clientId,callback}:{clientId:string;callback:string}){
 const [details,setDetails]=useState<Details|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[signedIn,setSignedIn]=useState(false);
 function redirect(url:string){const target=new URL(url),expected=new URL(callback);if(target.origin!==expected.origin||target.pathname!==expected.pathname||target.username||target.password||target.hash)throw new Error('The authorization callback is not allowed.');window.location.assign(target.href);}
 async function load(){
  if(!supabase||!clientId||!callback){setError('ChatGPT connection setup is not complete yet.');return;}
  setBusy(true);setError('');
  try{
   const {data,error:authError}=await supabase.auth.getUser();if(authError||!data.user){setSignedIn(false);return;}setSignedIn(true);
   const authorizationId=new URLSearchParams(window.location.search).get('authorization_id');
   if(!authorizationId||!/^[a-zA-Z0-9_-]{1,256}$/.test(authorizationId))throw new Error('Start this connection from ChatGPT.');
   const result=await supabase.auth.oauth.getAuthorizationDetails(authorizationId);if(result.error)throw new Error('This authorization request is invalid or expired. Start again from ChatGPT.');
   if(!('authorization_id' in result.data)){redirect(result.data.redirect_url);return;}
   const request=result.data;
   if(request.client.id!==clientId||request.redirect_uri!==callback)throw new Error('This application is not the registered ChatGPT connection.');
   if(request.scope.split(' ').some(s=>!['openid','email','profile','offline_access'].includes(s)))throw new Error('Unexpected permissions requested.');
   const member=await supabase.rpc('active_workspace');if(member.error||!member.data)throw new Error('Only active Sotaria workspace members can connect.');
   setDetails(request);
  }catch(e){setError(e instanceof Error?e.message:'Unable to load authorization.');}finally{setBusy(false);}
 }
 useEffect(()=>{void load();},[]);
 async function decide(approve:boolean){
  if(!supabase||!details)return;setBusy(true);setError('');
  try{
   if(approve){
    const grant=await supabase.from('mcp_grants').select('client_id').eq('client_id',clientId);if(grant.error)throw new Error('Unable to check workspace permission.');
    if(!grant.data.length){const added=await supabase.from('mcp_grants').insert({client_id:clientId});if(added.error)throw new Error('Unable to grant workspace read access.');}
   }
   const result=approve?await supabase.auth.oauth.approveAuthorization(details.authorization_id,{skipBrowserRedirect:true}):await supabase.auth.oauth.denyAuthorization(details.authorization_id,{skipBrowserRedirect:true});
   if(result.error)throw new Error('Authorization could not complete. Try connecting again from ChatGPT.');
   redirect(result.data.redirect_url);
  }catch(e){setError(e instanceof Error?e.message:'Authorization failed.');}finally{setBusy(false);}
 }
 return <main><section className="auth-card"><p className="eyebrow">SOTARIA WORKSPACE</p><h1>Connect to ChatGPT</h1><p>Allow ChatGPT to search and read your shared thoughts, ideas, tasks, and calendar entries, including contributions from both Angus and Churmy.</p><p>ChatGPT cannot create, edit, or delete entries through this connection. You can revoke workspace access in Settings &amp; connections.</p>{error&&<p role="alert" className="error-text">{error}</p>}{!signedIn&&<><p>Sign in to Sotaria Workspace in another tab, then return here.</p><a href="/" target="_blank" rel="noopener noreferrer">Open workspace sign-in</a><button disabled={busy} onClick={load}>I’m signed in</button></>}{details&&<><p>Application: {details.client.name}</p><p>Requested sign-in permissions: {details.scope}</p><div className="actions"><button disabled={busy} className="primary" onClick={()=>decide(true)}>Allow read-only access</button><button disabled={busy} onClick={()=>decide(false)}>Deny</button></div></>}{busy&&<p role="status">Please wait…</p>}</section></main>;
}
