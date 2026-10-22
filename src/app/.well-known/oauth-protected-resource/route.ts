export async function GET(){
 const resource=process.env.MCP_RESOURCE,url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(process.env.MCP_ENABLED!=='true'||!resource?.startsWith('https://')||!url)return Response.json({error:'MCP is not configured.'},{status:503});
 return Response.json({resource,authorization_servers:[`${url}/auth/v1`],scopes_supported:['openid'],bearer_methods_supported:['header']},{headers:{'Cache-Control':'no-store'}});
}
