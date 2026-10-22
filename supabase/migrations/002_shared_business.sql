-- Share by workspace membership; preserve original author attribution.
-- Existing v1 data stays in separate workspaces until explicitly consolidated.
begin;
create table public.workspaces (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 160),
 created_at timestamptz not null default now()
);
create table public.workspace_members (
 workspace_id uuid not null references public.workspaces(id),
 user_id uuid not null references auth.users(id),
 slot smallint not null check(slot in (1,2)),
 display_name text not null check(length(trim(display_name)) between 1 and 80),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(workspace_id,user_id), unique(workspace_id,slot), unique(user_id)
);
-- Never automatically expose previously private records to another person.
insert into public.workspaces(id,name) select id,'Existing workspace' from auth.users;
insert into public.workspace_members(workspace_id,user_id,slot,display_name)
 select id,id,1,'Workspace member' from auth.users;

create function public.active_workspace() returns uuid language sql stable security definer set search_path='' as $$
 select workspace_id from public.workspace_members where user_id=auth.uid() and active
$$;
create or replace function public.can_read_workspace(who uuid) returns boolean language sql stable security definer set search_path='' as $$
 select who=public.active_workspace() and (public.native_session() or exists(
 select 1 from public.mcp_grants g where g.owner_id=auth.uid() and g.client_id=auth.jwt()->>'client_id'))
$$;

do $$ declare t text; c record; begin
 -- Remove author-based relationship constraints before replacing them with workspace keys.
 for c in select conrelid::regclass as tbl,conname from pg_constraint
 where contype='f' and conrelid in ('public.thought_tags'::regclass,'public.items'::regclass,'public.extractions'::regclass)
 and confrelid in ('public.thoughts'::regclass,'public.tags'::regclass,'public.boards'::regclass)
 loop execute format('alter table %s drop constraint %I',c.tbl,c.conname); end loop;
 foreach t in array array['thoughts','tags','thought_tags','boards','items','extractions'] loop
 execute format('alter table public.%I add column workspace_id uuid references public.workspaces(id)',t);
 execute format('update public.%I set workspace_id=owner_id',t);
 execute format('alter table public.%I alter column workspace_id set not null, alter column workspace_id set default public.active_workspace()',t);
 execute format('alter table public.%I rename column owner_id to created_by',t);
 execute format('alter table public.%I drop constraint %I',t,t||'_owner_id_fkey');
 execute format('alter table public.%I add foreign key(created_by) references auth.users(id)',t);
 execute format('drop policy own_read on public.%I',t);
 execute format('drop policy own_insert on public.%I',t);
 execute format('drop policy own_update on public.%I',t);
 execute format('drop policy own_delete on public.%I',t);
 execute format('create policy shared_read on public.%I for select to authenticated using (public.can_read_workspace(workspace_id))',t);
 execute format('create policy shared_insert on public.%I for insert to authenticated with check (workspace_id=public.active_workspace() and created_by=auth.uid() and public.native_session())',t);
 execute format('create policy shared_update on public.%I for update to authenticated using (workspace_id=public.active_workspace() and public.native_session()) with check (workspace_id=public.active_workspace() and public.native_session())',t);
 -- UI archives content; no member can hard-delete business records through PostgREST.
 execute format('revoke delete on public.%I from authenticated',t);
 if t<>'thought_tags' then
 execute format('alter table public.%I add unique(workspace_id,id)',t);
 end if;
 execute format('create index on public.%I(workspace_id)',t);
 end loop;
end $$;
alter table public.tags drop constraint tags_owner_id_name_key;
alter table public.tags add unique(workspace_id,name);
alter table public.thought_tags drop constraint thought_tags_pkey;
alter table public.thought_tags add primary key(workspace_id,thought_id,tag_id);
alter table public.thought_tags add foreign key(workspace_id,thought_id) references public.thoughts(workspace_id,id),
 add foreign key(workspace_id,tag_id) references public.tags(workspace_id,id);
alter table public.items add foreign key(workspace_id,source_id) references public.thoughts(workspace_id,id),
 add foreign key(workspace_id,board_id) references public.boards(workspace_id,id),
 add column assigned_to uuid, add column calendar_owner_id uuid,
 add column updated_by uuid references auth.users(id), add column updated_at timestamptz not null default now();
update public.items set assigned_to=case when kind='task' then created_by end,
 calendar_owner_id=case when kind='event' then created_by end,updated_by=created_by;
alter table public.items add foreign key(workspace_id,assigned_to) references public.workspace_members(workspace_id,user_id),
 add foreign key(workspace_id,calendar_owner_id) references public.workspace_members(workspace_id,user_id),
 add check(assigned_to is null or kind='task'),
 add check((kind='event' and calendar_owner_id is not null) or (kind<>'event' and calendar_owner_id is null));
alter table public.extractions add foreign key(workspace_id,thought_id) references public.thoughts(workspace_id,id);

create function public.preserve_attribution() returns trigger language plpgsql set search_path='' as $$
begin
 if new.workspace_id is distinct from old.workspace_id or new.created_by is distinct from old.created_by then
 raise exception 'Workspace and original author cannot be changed'; end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['thoughts','tags','thought_tags','boards','items','extractions'] loop
 execute format('create trigger preserve_attribution before update on public.%I for each row execute function public.preserve_attribution()',t);
 end loop;
end $$;
create function public.validate_item_members() returns trigger language plpgsql set search_path='' as $$
declare person uuid;
begin
 if tg_op='INSERT' and new.kind='event' and new.calendar_owner_id is null then new.calendar_owner_id:=auth.uid(); end if;
 person:=coalesce(new.assigned_to,new.calendar_owner_id);
 if person is not null and (tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to or new.calendar_owner_id is distinct from old.calendar_owner_id) then
 if not exists(select 1 from public.workspace_members where workspace_id=new.workspace_id and user_id=person and active) then raise exception 'Choose an active workspace member'; end if;
 end if;
 new.updated_by:=auth.uid();new.updated_at:=now();return new;
end $$;
create trigger item_member_fields before insert or update on public.items for each row execute function public.validate_item_members();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
revoke all on public.workspaces,public.workspace_members from anon,authenticated;
grant select on public.workspaces,public.workspace_members to authenticated;
create policy workspace_read on public.workspaces for select to authenticated using(public.can_read_workspace(id));
create policy member_read on public.workspace_members for select to authenticated using(public.can_read_workspace(workspace_id));
-- Membership provisioning is operator-only. Knowing the other user's ID is not an invitation.
revoke all on function public.active_workspace(),public.preserve_attribution(),public.validate_item_members() from public,anon;
grant execute on function public.active_workspace() to authenticated;

create or replace function public.capture_thought(p_id uuid,p_body text,p_timezone text) returns public.thoughts language plpgsql security invoker set search_path='' as $$
declare result public.thoughts; tag text; tid uuid;
begin
 if not public.native_session() or public.active_workspace() is null then raise exception 'Active membership required'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
 insert into public.thoughts(id,body,timezone) values(p_id,p_body,p_timezone) on conflict(id) do nothing;
 select * into strict result from public.thoughts where id=p_id and created_by=auth.uid() and workspace_id=public.active_workspace();
 if result.body<>p_body or result.timezone<>p_timezone then raise exception 'Idempotency conflict'; end if;
 for tag in select distinct lower(m[1]) from regexp_matches(p_body,'#([[:alnum:]_]{1,64})','g') m loop
 insert into public.tags(name) values(tag) on conflict(workspace_id,name) do nothing;
 select id into tid from public.tags where workspace_id=public.active_workspace() and name=tag;
 insert into public.thought_tags(thought_id,tag_id) values(p_id,tid) on conflict do nothing;
 end loop;return result;
end $$;
create or replace function public.consume_ai_attempt() returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not public.native_session() or public.active_workspace() is null then raise exception 'Active membership required'; end if;
 insert into public.usage_buckets(owner_id,day,attempts) values(auth.uid(),(now() at time zone 'UTC')::date,1)
 on conflict(owner_id,day) do update set attempts=public.usage_buckets.attempts+1 where public.usage_buckets.attempts<10 returning attempts into n;
 return n is not null;
end $$;
create or replace function public.accept_suggestions(p_id uuid,p_indexes integer[],p_edits jsonb) returns setof public.items language plpgsql security invoker set search_path='' as $$
declare ex public.extractions; idx integer; pos integer:=0; edit jsonb; result public.items;
begin
 if not public.native_session() or public.active_workspace() is null then raise exception 'Active membership required'; end if;
 if cardinality(p_indexes) not between 1 and 20 or cardinality(p_indexes)<>jsonb_array_length(p_edits) then raise exception 'Invalid selection'; end if;
 select * into strict ex from public.extractions where id=p_id and workspace_id=public.active_workspace() for update;
 foreach idx in array p_indexes loop
 if idx<0 or idx>=jsonb_array_length(ex.suggestions) or ex.accepted_ids ? idx::text then raise exception 'Invalid or already accepted selection'; end if;
 edit:=p_edits->pos;pos:=pos+1;
 if not exists(select 1 from pg_timezone_names where name=edit->>'timezone') then raise exception 'Invalid timezone'; end if;
 insert into public.items(kind,title,details,source_id,due_on,starts_at,ends_at,timezone,assigned_to,calendar_owner_id)
 values(edit->>'kind',edit->>'title',edit->>'details',ex.thought_id,(edit->>'due_on')::date,(edit->>'starts_at')::timestamptz,(edit->>'ends_at')::timestamptz,edit->>'timezone',(edit->>'assigned_to')::uuid,(edit->>'calendar_owner_id')::uuid) returning * into result;
 ex.accepted_ids:=ex.accepted_ids || jsonb_build_object(idx::text,result.id);return next result;
 end loop;
 update public.extractions set accepted_ids=ex.accepted_ids where id=ex.id;
end $$;
commit;
