import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { makeMcpServer } from '../src/lib/mcp';
test('MCP stateless transport advertises only read tools and validates input',async()=>{
 const resource='https://workspace.example/api/mcp';
 const db={} as SupabaseClient;
 async function rpc(method:string,params:unknown){
 const server=makeMcpServer(db,resource),transport=new WebStandardStreamableHTTPServerTransport({enableJsonResponse:true});
 await server.connect(transport);
 try{const result=await transport.handleRequest(new Request(resource,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));return await result.json();}finally{await server.close();}
 }
 const initialized=await rpc('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'test',version:'1'}});
 assert.equal(initialized.result.serverInfo.name,'stillroom');
 const listed=await rpc('tools/list',{});
 assert.deepEqual(listed.result.tools.map((t:{name:string})=>t.name),['search','fetch']);
 assert.ok(listed.result.tools.every((t:{annotations:{readOnlyHint:boolean}})=>t.annotations.readOnlyHint));
 const invalid=await rpc('tools/call',{name:'fetch',arguments:{id:'https://evil.example'}});
 assert.equal(invalid.result.isError,true);
 const write=await rpc('tools/call',{name:'delete_all',arguments:{}});
 assert.equal(write.result.isError,true);
});
