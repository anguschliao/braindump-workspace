begin;
create or replace function public.capture_thought(p_id uuid,p_body text,p_timezone text) returns public.thoughts language plpgsql security invoker set search_path='' as $$
declare result public.thoughts; tag text; tid uuid;
begin
 if not public.native_session() or public.active_workspace() is null then raise exception 'Active membership required'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
 insert into public.thoughts(id,body,timezone) values(p_id,p_body,p_timezone) on conflict(id) do nothing;
 select * into strict result from public.thoughts where id=p_id and created_by=auth.uid() and workspace_id=public.active_workspace();
 if result.body<>p_body or result.timezone<>p_timezone then raise exception 'Idempotency conflict'; end if;
 for tag in select distinct lower(m[1]) from regexp_matches(p_body,'#([[:alnum:]_-]{1,64})','g') m loop
 insert into public.tags(name) values(tag) on conflict(workspace_id,name) do nothing;
 select id into tid from public.tags where workspace_id=public.active_workspace() and name=tag;
 insert into public.thought_tags(thought_id,tag_id) values(p_id,tid) on conflict do nothing;
 end loop;return result;
end $$;
commit;
