begin;
create table public.mcp_grants (
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 client_id text not null check(length(client_id) between 1 and 256),
 created_at timestamptz not null default now(), primary key(owner_id,client_id)
);
create function public.native_session() returns boolean language sql stable set search_path='' as $$
 select auth.uid() is not null and nullif(auth.jwt()->>'client_id','') is null
$$;
create function public.can_read_workspace(who uuid) returns boolean language sql stable security definer set search_path='' as $$
 select who=auth.uid() and (public.native_session() or exists(
 select 1 from public.mcp_grants g where g.owner_id=auth.uid() and g.client_id=auth.jwt()->>'client_id'))
$$;
create table public.thoughts (
 id uuid primary key, owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 body text not null check(length(trim(body)) between 1 and 8000), timezone text not null default 'America/Edmonton',
 archived boolean not null default false, created_at timestamptz not null default now(),
 search tsvector generated always as (to_tsvector('english',body)) stored, unique(owner_id,id)
);
create table public.tags (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 64), unique(owner_id,name), unique(owner_id,id)
);
create table public.thought_tags (
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade, thought_id uuid not null, tag_id uuid not null,
 primary key(owner_id,thought_id,tag_id),
 foreign key(owner_id,thought_id) references public.thoughts(owner_id,id) on delete cascade,
 foreign key(owner_id,tag_id) references public.tags(owner_id,id) on delete cascade
);
create table public.boards (
 id uuid primary key, owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 160), created_at timestamptz not null default now(), unique(owner_id,id)
);
create table public.items (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check(kind in ('idea','task','event')), title text not null check(length(trim(title)) between 1 and 160),
 details text not null default '' check(length(details)<=4000), status text not null default 'open' check(status in ('open','done','archived')),
 source_id uuid, board_id uuid, due_on date, starts_at timestamptz, ends_at timestamptz,
 timezone text not null default 'America/Edmonton', created_at timestamptz not null default now(),
 search tsvector generated always as (to_tsvector('english',title || ' ' || details)) stored,
 unique(owner_id,id), foreign key(owner_id,source_id) references public.thoughts(owner_id,id),
 foreign key(owner_id,board_id) references public.boards(owner_id,id),
 check(board_id is null or kind='idea'), check(due_on is null or kind='task'),
 check((kind='event' and starts_at is not null and ends_at>starts_at) or (kind<>'event' and starts_at is null and ends_at is null))
);
create table public.extractions (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 thought_id uuid not null, suggestions jsonb not null check(jsonb_typeof(suggestions)='array' and jsonb_array_length(suggestions)<=20),
 accepted_ids jsonb not null default '{}', model text not null, created_at timestamptz not null default now(),
 foreign key(owner_id,thought_id) references public.thoughts(owner_id,id)
);
create table public.usage_buckets (
 owner_id uuid not null references auth.users(id) on delete cascade, day date not null, attempts integer not null, primary key(owner_id,day)
);
create index on public.thoughts(owner_id,created_at desc);
create index on public.thoughts using gin(search);
create index on public.items(owner_id,created_at desc);
create index on public.items using gin(search);
create index on public.boards(owner_id,created_at desc);
create index on public.extractions(owner_id,created_at desc);
do $$ declare t text; begin
 foreach t in array array['thoughts','tags','thought_tags','boards','items','extractions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create policy own_read on public.%I for select to authenticated using (public.can_read_workspace(owner_id))',t);
 execute format('create policy own_insert on public.%I for insert to authenticated with check (owner_id=auth.uid() and public.native_session())',t);
 execute format('create policy own_update on public.%I for update to authenticated using (owner_id=auth.uid() and public.native_session()) with check (owner_id=auth.uid() and public.native_session())',t);
 execute format('create policy own_delete on public.%I for delete to authenticated using (owner_id=auth.uid() and public.native_session())',t);
 end loop;
end $$;
alter table public.mcp_grants enable row level security;
revoke all on public.mcp_grants from anon,authenticated;
grant select,insert,delete on public.mcp_grants to authenticated;
create policy native_grants on public.mcp_grants for all to authenticated using(owner_id=auth.uid() and public.native_session()) with check(owner_id=auth.uid() and public.native_session());
alter table public.usage_buckets enable row level security;
revoke all on public.usage_buckets from anon,authenticated;

create function public.capture_thought(p_id uuid,p_body text,p_timezone text) returns public.thoughts language plpgsql security invoker set search_path='' as $$
declare result public.thoughts; tag text; tid uuid;
begin
 if not public.native_session() then raise exception 'Native session required'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
 insert into public.thoughts(id,body,timezone) values(p_id,p_body,p_timezone) on conflict(id) do nothing;
 select * into strict result from public.thoughts where id=p_id and owner_id=auth.uid();
 if result.body<>p_body or result.timezone<>p_timezone then raise exception 'Idempotency conflict'; end if;
 for tag in select distinct lower(m[1]) from regexp_matches(p_body,'#([[:alnum:]_]{1,64})','g') m loop
 insert into public.tags(name) values(tag) on conflict(owner_id,name) do nothing;
 select id into tid from public.tags where owner_id=auth.uid() and name=tag;
 insert into public.thought_tags(thought_id,tag_id) values(p_id,tid) on conflict do nothing;
 end loop;
 return result;
end $$;

create function public.consume_ai_attempt() returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not public.native_session() then raise exception 'Native session required'; end if;
 insert into public.usage_buckets(owner_id,day,attempts) values(auth.uid(),(now() at time zone 'UTC')::date,1)
 on conflict(owner_id,day) do update set attempts=public.usage_buckets.attempts+1 where public.usage_buckets.attempts<10 returning attempts into n;
 return n is not null;
end $$;

create function public.accept_suggestions(p_id uuid,p_indexes integer[],p_edits jsonb) returns setof public.items language plpgsql security invoker set search_path='' as $$
declare ex public.extractions; idx integer; pos integer:=0; edit jsonb; result public.items;
begin
 if not public.native_session() then raise exception 'Native session required'; end if;
 if cardinality(p_indexes) not between 1 and 20 or cardinality(p_indexes)<>jsonb_array_length(p_edits) then raise exception 'Invalid selection'; end if;
 select * into strict ex from public.extractions where id=p_id and owner_id=auth.uid() for update;
 foreach idx in array p_indexes loop
 if idx<0 or idx>=jsonb_array_length(ex.suggestions) or ex.accepted_ids ? idx::text then raise exception 'Invalid or already accepted selection'; end if;
 edit:=p_edits->pos; pos:=pos+1;
 if not exists(select 1 from pg_timezone_names where name=edit->>'timezone') then raise exception 'Invalid timezone'; end if;
 insert into public.items(kind,title,details,source_id,due_on,starts_at,ends_at,timezone)
 values(edit->>'kind',edit->>'title',edit->>'details',ex.thought_id,(edit->>'due_on')::date,(edit->>'starts_at')::timestamptz,(edit->>'ends_at')::timestamptz,edit->>'timezone') returning * into result;
 ex.accepted_ids:=ex.accepted_ids || jsonb_build_object(idx::text,result.id);
 return next result;
 end loop;
 update public.extractions set accepted_ids=ex.accepted_ids where id=ex.id;
end $$;
revoke all on function public.native_session(),public.can_read_workspace(uuid),public.capture_thought(uuid,text,text),public.consume_ai_attempt(),public.accept_suggestions(uuid,integer[],jsonb) from public,anon;
grant execute on function public.native_session(),public.can_read_workspace(uuid),public.capture_thought(uuid,text,text),public.consume_ai_attempt(),public.accept_suggestions(uuid,integer[],jsonb) to authenticated;
commit;
