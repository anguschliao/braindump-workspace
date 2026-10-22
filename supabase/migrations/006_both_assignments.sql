begin;
alter table public.items add column for_both boolean not null default false;
-- Replace the old single-calendar-owner check, preserving unrelated checks.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.items'::regclass and contype='c' and pg_get_constraintdef(oid) like '%calendar_owner_id%' loop
 execute format('alter table public.items drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.items add constraint items_both_assignment_check check (
 not for_both or (kind in ('task','event') and assigned_to is null and calendar_owner_id is null)
), add constraint items_calendar_assignment_check check (
 (kind='event' and (for_both or calendar_owner_id is not null)) or (kind<>'event' and calendar_owner_id is null)
);
create or replace function public.validate_item_members() returns trigger language plpgsql set search_path='' as $$
declare person uuid;
begin
 if tg_op='INSERT' and new.kind='event' and new.calendar_owner_id is null and not new.for_both then new.calendar_owner_id:=auth.uid(); end if;
 person:=coalesce(new.assigned_to,new.calendar_owner_id);
 if person is not null and (tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to or new.calendar_owner_id is distinct from old.calendar_owner_id) then
 if not exists(select 1 from public.workspace_members where workspace_id=new.workspace_id and user_id=person and active) then raise exception 'Choose an active workspace member'; end if;
 end if;
 new.updated_by:=auth.uid();new.updated_at:=now();return new;
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
 insert into public.items(kind,title,details,source_id,due_on,starts_at,ends_at,timezone,assigned_to,calendar_owner_id,for_both)
 values(edit->>'kind',edit->>'title',edit->>'details',ex.thought_id,(edit->>'due_on')::date,(edit->>'starts_at')::timestamptz,(edit->>'ends_at')::timestamptz,edit->>'timezone',(edit->>'assigned_to')::uuid,(edit->>'calendar_owner_id')::uuid,coalesce((edit->>'for_both')::boolean,false)) returning * into result;
 ex.accepted_ids:=ex.accepted_ids || jsonb_build_object(idx::text,result.id);return next result;
 end loop;
 update public.extractions set accepted_ids=ex.accepted_ids where id=ex.id;
end $$;
commit;
