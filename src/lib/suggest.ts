import type { SupabaseClient } from '@supabase/supabase-js';
import { aiEnabled, extract, AI_MODEL } from './extract';
export async function suggestThought(db:SupabaseClient, id:string) {
 if(!aiEnabled())return {status:'disabled',extraction:null};
 const existing=await db.from('extractions').select('*').eq('thought_id',id).order('created_at',{ascending:false}).limit(1);
 if(existing.error)throw existing.error;
 if(existing.data?.length)return {status:'completed',extraction:existing.data[0]};
 const thought=await db.from('thoughts').select('*').eq('id',id).eq('archived',false).single();
 if(thought.error)throw thought.error;
 const reservation=await db.rpc('reserve_ai_thought',{p_id:id});
 if(reservation.error)throw reservation.error;
 if(reservation.data!=='reserved')return {status:reservation.data==='budget'?'budget':'already_attempted',extraction:null};
 try {
   const suggestions=await extract(thought.data.body,thought.data.timezone,thought.data.created_at);
   const saved=await db.from('extractions').insert({thought_id:id,suggestions,model:AI_MODEL}).select().single();
   if(saved.error)throw saved.error;
   return {status:'completed',extraction:saved.data};
 } catch { return {status:'unavailable',extraction:null}; }
}
