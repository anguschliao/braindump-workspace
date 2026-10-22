import { z } from 'zod';
export const timezone = z.string().max(100).refine(v => { try { new Intl.DateTimeFormat('en',{timeZone:v}); return true; } catch { return false; } }, 'Use a valid IANA timezone');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v,'Invalid date');
export const suggestionShape = z.object({kind:z.enum(['idea','task','event']),title:z.string().trim().min(1).max(160),details:z.string().max(4000),due_on:date.nullable(),starts_at:z.string().datetime({offset:true}).nullable(),ends_at:z.string().datetime({offset:true}).nullable(),timezone});
export type Suggestion = z.infer<typeof suggestionShape>;
export const validItem = (v:Suggestion) => (v.kind==='task'||v.due_on===null) && (v.kind==='event' ? !!v.starts_at && !!v.ends_at && Date.parse(v.ends_at)>Date.parse(v.starts_at) : v.starts_at===null && v.ends_at===null);
export const suggestion = suggestionShape.refine(validItem,'Events need a start and later end; only tasks have due dates');
const uuid = z.string().uuid();
const memberFields={for_both:z.boolean().default(false),assigned_to:uuid.nullable().default(null),calendar_owner_id:uuid.nullable().default(null)};
export const reviewedSuggestion=suggestionShape.extend(memberFields).refine(validItem,'Check event times and task dates');
export const operation = z.discriminatedUnion('op',[
 z.object({op:z.literal('capture'),id:uuid,body:z.string().trim().min(1).max(8000),timezone}),
 z.object({op:z.literal('board'),id:uuid,title:z.string().trim().min(1).max(160)}),
 suggestionShape.extend({op:z.literal('item'),id:uuid,source_id:uuid.nullable(),board_id:uuid.nullable(),...memberFields}),
 suggestionShape.extend({op:z.literal('edit_item'),id:uuid,source_id:uuid.nullable(),board_id:uuid.nullable(),...memberFields}),
 z.object({op:z.literal('update_item'),id:uuid,status:z.enum(['open','done','archived'])}),
 z.object({op:z.literal('archive_thought'),id:uuid}),
 z.object({op:z.literal('extract'),thought_id:uuid}),
 z.object({op:z.literal('accept'),extraction_id:uuid,indexes:z.array(z.number().int().min(0).max(19)).min(1).max(20),edits:z.array(reviewedSuggestion).min(1).max(20)}),
 z.object({op:z.literal('grant'),client_id:z.string().min(1).max(256)}),
 z.object({op:z.literal('revoke'),client_id:z.string().min(1).max(256)})
]);
export type Operation = z.infer<typeof operation>;
export type Member = {user_id:string;workspace_id:string;display_name:string;active:boolean;slot:number};
export type Attribution = {workspace_id:string;created_by:string};
export type Thought = Attribution & {id:string;body:string;timezone:string;created_at:string;archived:boolean};
export type Item = Attribution & Suggestion & {id:string;source_id:string|null;board_id:string|null;assigned_to:string|null;calendar_owner_id:string|null;for_both?:boolean;updated_by:string;status:'open'|'done'|'archived';created_at:string};
export type Board = Attribution & {id:string;title:string;created_at:string};
export type Extraction = Attribution & {id:string;thought_id:string;suggestions:Suggestion[];accepted_ids:Record<string,string>;created_at:string};
export const hashtags = (body:string) => [...new Set(Array.from(body.matchAll(/#([\p{L}\p{N}_-]{1,64})/gu),m=>m[1].toLowerCase()))];
