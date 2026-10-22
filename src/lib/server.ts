import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export function config(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key) throw new HttpError(503,'Connect Supabase to use the synced workspace.');
 return {url,key};
}
let jwks:ReturnType<typeof createRemoteJWKSet>|undefined;
export async function authenticate(req:Request,mcp=false){
 const {url,key}=config();
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
 if(!token) throw new HttpError(401,'Sign in to continue.');
 let claims;
 try {
 jwks??=createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
 claims=(await jwtVerify(token,jwks,{issuer:`${url}/auth/v1`,audience:mcp?process.env.MCP_RESOURCE:'authenticated',algorithms:['ES256','RS256']})).payload;
 if(!claims.exp || !claims.sub || claims.role!=='authenticated') throw new Error();
 }catch{throw new HttpError(401,'Session is invalid or expired.');}
 if(mcp && !claims.client_id) throw new HttpError(401,'An OAuth client token is required.');
 const db=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 return {db,userId:claims.sub,clientId:claims.client_id};
}
export function checkOrigin(req:Request){
 const origin=req.headers.get('origin');
 if(origin && origin!==process.env.APP_ORIGIN) throw new HttpError(403,'Origin is not allowed.');
}
export async function readJson(req:Request){
 if(!req.headers.get('content-type')?.includes('application/json')) throw new HttpError(415,'JSON is required.');
 const reader=req.body?.getReader();if(!reader) throw new HttpError(400,'Body required.');
 let bytes=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>32768){await reader.cancel();throw new HttpError(413,'Request is too large.');}chunks.push(value);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HttpError(400,'Invalid JSON.');}
}
export function reply(data:unknown,status=200){return Response.json({data},{status,headers:{'Cache-Control':'no-store'}});}
export function fail(e:unknown){return Response.json({error:e instanceof HttpError?e.message:'The request could not be completed. Please retry.'},{status:e instanceof HttpError?e.status:503,headers:{'Cache-Control':'no-store'}});}
