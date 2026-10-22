begin;
-- Operator-managed clients: never writable or readable by application sessions.
create table public.mcp_oauth_clients(
 client_id text primary key,
 resource text not null check(resource like 'https://%'),
 active boolean not null default true
);
alter table public.mcp_oauth_clients enable row level security;
revoke all on public.mcp_oauth_clients from public,anon,authenticated;
create function public.mcp_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare claims jsonb:=event->'claims'; cid text; target text;
begin
 cid:=coalesce(nullif(claims->>'client_id',''),nullif(event->>'client_id',''));
 if cid is null then return event; end if;
 select resource into target from public.mcp_oauth_clients where client_id=cid and active;
 if target is not null then
  if not exists(select 1 from public.workspace_members where user_id=(claims->>'sub')::uuid and active)
   or not exists(select 1 from public.mcp_grants where owner_id=(claims->>'sub')::uuid and client_id=cid)
  then raise exception 'Workspace authorization is required'; end if;
  claims:=jsonb_set(claims,'{aud}',jsonb_build_array('authenticated',target));
  claims:=jsonb_set(claims,'{client_id}',to_jsonb(cid));
  event:=jsonb_set(event,'{claims}',claims);
 end if;
 return event;
end $$;
revoke all on function public.mcp_access_token_hook(jsonb) from public,anon,authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.mcp_access_token_hook(jsonb) to supabase_auth_admin;
commit;
