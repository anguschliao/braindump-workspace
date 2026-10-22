import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { authenticate,checkOrigin,fail,HttpError,readJson } from '@/lib/server';
import { makeMcpServer } from '@/lib/mcp';
export const runtime='nodejs';
export async function POST(req:Request){try{
 if(process.env.MCP_ENABLED!=='true')throw new HttpError(503,'MCP is not enabled.');
 const resource=process.env.MCP_RESOURCE;
 if(!resource||!resource.startsWith('https://'))throw new HttpError(503,'MCP resource is not configured.');
 checkOrigin(req);
 const {db}=await authenticate(req,true);
 // RLS rechecks the grant on every data query, so revocation affects active tokens.
 const membership=await db.rpc('active_workspace');
 if(membership.error||!membership.data)throw new HttpError(403,'Active business workspace membership is required.');
 const allowed=await db.rpc('can_read_workspace',{who:membership.data});
 if(allowed.error||!allowed.data)throw new HttpError(403,'Grant this registered client read access in your workspace settings.');
 const body=await readJson(req);
 const server=makeMcpServer(db,resource);
 const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
 await server.connect(transport);
 try{return await transport.handleRequest(req,{parsedBody:body});}finally{await server.close();}
 }catch(e){
 if(e instanceof HttpError&&e.status===401){const origin=new URL(process.env.MCP_RESOURCE!).origin;return Response.json({error:e.message},{status:401,headers:{'WWW-Authenticate':`Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="openid"`,'Cache-Control':'no-store'}});}
 return fail(e);
 }}
// Stateless JSON request/response only; no SSE subscription or session deletion.
export async function GET(){return new Response(null,{status:405,headers:{Allow:'POST'}});}
export async function DELETE(){return new Response(null,{status:405,headers:{Allow:'POST'}});}
