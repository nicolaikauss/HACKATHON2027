create table nexi.gateway_config (
  id boolean primary key default true check (id),
  secret_sha256 text not null
);
alter table nexi.gateway_config enable row level security;
revoke all on nexi.gateway_config from public;

create function public.nexi_gateway(secret text, fn text, input jsonb) returns jsonb
language plpgsql security definer set search_path = nexi, pg_temp as $$
declare result jsonb;
begin
  if not exists (
    select 1 from gateway_config
    where secret_sha256 = encode(sha256(convert_to(secret, 'UTF8')), 'hex')
  ) then
    raise exception 'gateway_forbidden';
  end if;
  if fn not in (
    'api_create_session', 'api_state', 'api_agent_context', 'api_human_grant',
    'api_human_keep_rules', 'api_human_regrant', 'api_human_revoke', 'api_submit_proposal',
    'api_begin_submission', 'api_apply_provider_event', 'api_next_week'
  ) then
    raise exception 'invalid_request';
  end if;
  execute format('select nexi.%I($1)', fn) into result using input;
  return result;
end $$;

revoke all on function public.nexi_gateway(text, text, jsonb) from public, authenticated, service_role;
grant execute on function public.nexi_gateway(text, text, jsonb) to anon;
notify pgrst, 'reload schema';
