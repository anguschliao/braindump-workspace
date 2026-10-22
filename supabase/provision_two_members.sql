-- OPERATOR TEMPLATE ONLY: use after migrations and approved Auth account creation.
-- Replace NULLs with the two intended Auth user IDs and set their display names.
-- Existing memberships are refused; this never silently merges private data.
begin;
do $$
declare first_user uuid := '821ee55b-e938-4240-8f40-c8cd67883e2a'; second_user uuid := 'ddb348c1-9229-4f7d-8ead-ab50fa393d04';
 first_name text := 'angus'; second_name text := 'churmy';
 business_name text := 'sotaria'; workspace uuid;
begin
 if first_user is null or second_user is null or first_user=second_user then
 raise exception 'Specify two distinct approved Auth user IDs'; end if;
 if (select count(*) from auth.users where id in (first_user,second_user))<>2 then
 raise exception 'Both Auth accounts must already exist'; end if;
 if exists(select 1 from public.workspace_members where user_id in (first_user,second_user)) then
 raise exception 'Existing memberships require a separate reviewed migration'; end if;
 insert into public.workspaces(name) values(business_name) returning id into workspace;
 insert into public.workspace_members(workspace_id,user_id,slot,display_name) values
 (workspace,first_user,1,first_name),(workspace,second_user,2,second_name);
end $$;
commit;
