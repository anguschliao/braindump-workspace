import { z } from 'zod';
import { authenticate,checkOrigin,readJson,reply,fail,HttpError } from '@/lib/server';
import { operation,validItem } from '@/lib/schema';
import { extract } from '@/lib/extract';
export const runtime='nodejs';
export async function GET(req:Request){try{
 checkOrigin(req);const {db}=await authenticate(req);const params=new URL(req.url).searchParams;
 const kind=z.enum(['thoughts','items','boards','extractions','grants','members']).parse(params.get('kind')??'thoughts');
 const q=z.string().max(200).parse(params.get('q')??'');const offset=z.coerce.number().int().min(0).max(100000).parse(params.get('offset')??0);
 const tag=kind==='thoughts'&&/^#[\p{L}\p{N}_]{1,64}$/u.test(q)?q.slice(1).toLowerCase():null;
 let query=db.from(kind==='grants'?'mcp_grants':kind==='members'?'workspace_members':kind).select(tag?'*,thought_tags!inner(tags!inner(name))':'*').order('created_at',{ascending:false}).range(offset,offset+99);
 if(kind==='thoughts') query=query.eq('archived',false);
 if(kind==='items') query=query.neq('status','archived');
 if(tag) query=query.eq('thought_tags.tags.name',tag);
 else if(q && (kind==='thoughts'||kind==='items')) query=query.textSearch('search',q,{type:'websearch',config:'english'});
 const {data,error}=await query;if(error)throw error;return reply(data);
 }catch(e){return fail(e instanceof z.ZodError?new HttpError(400,'Invalid query.'):e);}}
export async function POST(req:Request){try{
 checkOrigin(req);const {db,clientId}=await authenticate(req);if(clientId)throw new HttpError(403,'OAuth clients are read-only.');
 const membership=await db.rpc('active_workspace');if(membership.error)throw membership.error;if(!membership.data)throw new HttpError(403,'Your account has not been added to this business workspace.');
 const v=operation.parse(await readJson(req));let result;
 switch(v.op){
 case 'capture':result=await db.rpc('capture_thought',{p_id:v.id,p_body:v.body,p_timezone:v.timezone});break;
 case 'board':result=await db.from('boards').insert({id:v.id,title:v.title}).select().single();break;
 case 'item':case 'edit_item':{if(!validItem(v)||(v.board_id&&v.kind!=='idea')||(v.assigned_to&&v.kind!=='task')||(v.calendar_owner_id&&v.kind!=='event'))throw new HttpError(400,'Check the item dates, member, and board.');const {op,id,...row}=v;result=op==='item'?await db.from('items').insert({id,...row}).select().single():await db.from('items').update(row).eq('id',id).select().single();break;}
 case 'update_item':result=await db.from('items').update({status:v.status}).eq('id',v.id).select().single();break;
 case 'archive_thought':result=await db.from('thoughts').update({archived:true}).eq('id',v.id).select().single();break;
 case 'extract':{
 if(process.env.AI_ENABLED!=='true'||!process.env.OPENAI_API_KEY||!process.env.OPENAI_MODEL)throw new HttpError(503,'AI is disabled. Manual organization is available.');
 const {data:thought,error}=await db.from('thoughts').select('*').eq('id',v.thought_id).eq('archived',false).single();if(error||!thought)throw new HttpError(404,'Thought not found.');
 const quota=await db.rpc('consume_ai_attempt');if(quota.error)throw quota.error;if(!quota.data)throw new HttpError(429,'Daily AI limit reached. Try again tomorrow.');
 const suggestions=await extract(thought.body,thought.timezone,thought.created_at);
 result=await db.from('extractions').insert({thought_id:thought.id,suggestions,model:process.env.OPENAI_MODEL}).select().single();break;}
 case 'accept':if(v.indexes.length!==v.edits.length||new Set(v.indexes).size!==v.indexes.length)throw new HttpError(400,'Invalid selection.');result=await db.rpc('accept_suggestions',{p_id:v.extraction_id,p_indexes:v.indexes,p_edits:v.edits});break;
 case 'grant':result=await db.from('mcp_grants').insert({client_id:v.client_id}).select().single();break;
 case 'revoke':result=await db.from('mcp_grants').delete().eq('client_id',v.client_id);break;
 }
 if(result.error){if(result.error.code==='PGRST116')throw new HttpError(404,'Record not found.');if(['23505','23514','23503','P0001'].includes(result.error.code??''))throw new HttpError(409,'Could not save: duplicate action, invalid dates, or unavailable reference.');throw result.error;}
 return reply(result.data);
 }catch(e){return fail(e instanceof z.ZodError?new HttpError(400,e.issues[0]?.message??'Invalid input.'):e);}}
