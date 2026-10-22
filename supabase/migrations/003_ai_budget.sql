begin;
create table public.ai_monthly_budget (
 month date primary key,
 reserved_microdollars bigint not null default 0 check(reserved_microdollars between 0 and 5000000)
);
create table public.ai_attempts (
 thought_id uuid primary key references public.thoughts(id),
 workspace_id uuid not null references public.workspaces(id),
 month date not null references public.ai_monthly_budget(month),
 reserved_microdollars bigint not null check(reserved_microdollars>0),
 created_at timestamptz not null default now()
);
alter table public.ai_monthly_budget enable row level security;
alter table public.ai_attempts enable row level security;
revoke all on public.ai_monthly_budget, public.ai_attempts from anon,authenticated;
-- No refunds: ambiguous timeouts and failures retain their full reservation.
-- No client-provided amounts, and no way for clients to release/replay an attempt.
create function public.reserve_ai_thought(p_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare t public.thoughts; m date; cost bigint; total bigint;
begin
 if not public.native_session() or public.active_workspace() is null then raise exception 'Active membership required'; end if;
 select * into t from public.thoughts where id=p_id and workspace_id=public.active_workspace() and not archived;
 if not found then raise exception 'Thought unavailable'; end if;
 m:=date_trunc('month',now() at time zone 'UTC')::date;
 -- Avoid dispatch across a billing-month boundary.
 if (now() at time zone 'UTC') >= (m+interval '1 month'-interval '1 minute') then return 'budget'; end if;
 insert into public.ai_monthly_budget(month) values(m) on conflict do nothing;
 select reserved_microdollars into total from public.ai_monthly_budget where month=m for update;
 if exists(select 1 from public.ai_attempts where thought_id=p_id)
 or exists(select 1 from public.extractions where thought_id=p_id) then return 'existing'; end if;
 -- GPT-5.6 Luna: conservatively budget one token per UTF-8 JSON byte,
 -- plus 10,000 tokens for fixed instructions/schema/metadata; input $0.25/M
 -- (includes cache-write uplift), output <=3000 tokens at $1.20/M.
 cost:=ceil((octet_length(to_json(t.body)::text)+10000)*0.25+3600);
 if total+cost>5000000 then return 'budget'; end if;
 insert into public.ai_attempts(thought_id,workspace_id,month,reserved_microdollars) values(p_id,t.workspace_id,m,cost)
 on conflict do nothing;
 if not found then return 'existing'; end if;
 update public.ai_monthly_budget set reserved_microdollars=reserved_microdollars+cost where month=m;
 return 'reserved';
end $$;
revoke all on function public.reserve_ai_thought(uuid) from public,anon;
grant execute on function public.reserve_ai_thought(uuid) to authenticated;
commit;
