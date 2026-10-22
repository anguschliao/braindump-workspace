'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/browser';
export default function ResetPassword() {
  const [ready,setReady]=useState(false),[session,setSession]=useState(false);
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  useEffect(()=>{
    if(!supabase){setReady(true);return;}
    const fragment=new URLSearchParams(window.location.hash.slice(1));
    if(fragment.has('error'))setError('This recovery link is invalid or expired. Request a new link below.');
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,current)=>{setSession(!!current);setReady(true);});
    return ()=>subscription.unsubscribe();
  },[]);
  async function submit(event:React.FormEvent){
    event.preventDefault();if(!supabase)return;
    setBusy(true);setError('');setMessage('');
    try{
      if(session){
        if(password!==confirm)throw new Error('The passwords do not match.');
        const result=await supabase.auth.updateUser({password});if(result.error)throw result.error;
        setPassword('');setConfirm('');
        const signedOut=await supabase.auth.signOut();
        setMessage(signedOut.error?'Password updated. Return to your workspace.':'Password updated. Return to sign in with your new password.');
      }else{
        const result=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/reset-password'});
        if(result.error)throw result.error;
        setMessage('If this email is registered, a recovery link will arrive shortly. Check your spam folder too.');
      }
    }catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}
  }
  return <main><section className="auth-card">
    <h1>{session?'Choose a new password.':'Reset your password.'}</h1>
    <p>{session?'Use at least 12 characters and a password you do not use elsewhere.':'Enter your workspace email to request a recovery link.'}</p>
    {error&&<p role="alert" className="message error">{error}</p>}
    {message&&<p role="status" className="message success">{message}</p>}
    {!ready?<p>Checking your recovery link…</p>:!supabase?<p>Password recovery requires a connected workspace.</p>:
      <form onSubmit={submit}>{session?<>
        <label>New password<input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <label>Confirm password<input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
      </>:<label>Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>}
      <button disabled={busy} className="primary">{busy?'Please wait…':session?'Save new password':'Send recovery link'}</button></form>}
    <p><a href="/">Return to workspace</a></p>
  </section></main>;
}
