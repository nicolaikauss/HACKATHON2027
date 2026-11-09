begin;
create schema nexi;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'nexi_app') then
    create role nexi_app nologin;
  end if;
end $$;

create table nexi.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default gen_random_uuid(),
  agent_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create table nexi.accounts (
  session_id uuid primary key references nexi.sessions,
  available_cents integer not null default 28000 check (available_cents >= 0),
  period integer not null default 1 check (period > 0)
);
create table nexi.mandates (
  session_id uuid primary key references nexi.sessions,
  id uuid not null unique default gen_random_uuid(),
  current_version integer not null default 0,
  status text not null default 'revoked' check (status in ('active', 'revoked')),
  spent_cents integer not null default 0 check (spent_cents >= 0),
  reserved_cents integer not null default 0 check (reserved_cents >= 0)
);
create table nexi.mandate_versions (
  session_id uuid not null references nexi.mandates,
  version integer not null,
  kind text not null check (kind in ('standing','one_time')),
  terms jsonb not null,
  scope_offer_id text,
  scope_offer_version text,
  consumed_at timestamptz,
  granted_at timestamptz not null default now(),
  primary key (session_id, version)
);
create table nexi.merchants (id text primary key, name text not null);
create table nexi.offers (
  id text not null,
  version text not null,
  merchant_id text not null references nexi.merchants,
  category text not null,
  label text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency = 'EUR'),
  scenario text not null check (scenario in ('weekly_basket','pharmacy_refill','next_basket')),
  primary key (id, version)
);
create table nexi.proposals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references nexi.sessions,
  idempotency_key text not null,
  request jsonb not null,
  mandate_snapshot jsonb not null,
  offer_snapshot jsonb,
  policy jsonb not null,
  decision text not null check (decision in ('allow','block','request_approval')),
  resolution text not null default 'none' check (resolution in ('none','kept_rules','regranted')),
  created_at timestamptz not null default now(),
  unique (session_id, idempotency_key)
);
create table nexi.payments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references nexi.sessions,
  proposal_id uuid not null unique references nexi.proposals,
  state text not null default 'proposed' check (state in ('proposed','blocked','processing','authorized','executed','failed','requires_action','unknown')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency = 'EUR'),
  merchant_id text not null references nexi.merchants,
  mandate_version integer not null,
  provider_reference text not null unique default gen_random_uuid()::text,
  binding_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table nexi.provider_events (
  id text primary key,
  payment_id uuid not null references nexi.payments,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create table nexi.audit_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references nexi.sessions,
  actor text not null check (actor in ('human','agent','gate','provider','simulator')),
  type text not null,
  summary text not null,
  evidence jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table nexi.ledger_entries (
  id bigint generated always as identity primary key,
  session_id uuid not null references nexi.sessions,
  payment_id uuid references nexi.payments,
  type text not null check (type in ('reserve','release','settle','pay')),
  amount_cents integer not null,
  created_at timestamptz not null default now()
);

create function nexi.reject_mutation() returns trigger language plpgsql security definer set search_path = nexi, pg_temp as $$
begin raise exception 'append_only'; end $$;
create trigger audit_append_only before update or delete on nexi.audit_events for each row execute function nexi.reject_mutation();
create trigger ledger_append_only before update or delete on nexi.ledger_entries for each row execute function nexi.reject_mutation();
create trigger offers_immutable before update or delete on nexi.offers for each row execute function nexi.reject_mutation();
create trigger merchants_immutable before update or delete on nexi.merchants for each row execute function nexi.reject_mutation();

insert into nexi.merchants values ('dispensa-nord','Dispensa Nord'),('mercato-aurora','Mercato Aurora'),('spesa-lampo','Spesa Lampo'),('farmacia-lumen','Farmacia Lumen');
insert into nexi.offers values
 ('offer-a','1','dispensa-nord','essentials','Weekly essentials basket',5800,'EUR','weekly_basket'),
 ('offer-b','1','mercato-aurora','essentials','Weekly market basket',6100,'EUR','weekly_basket'),
 ('offer-c','1','spesa-lampo','essentials','Express weekly basket',5400,'EUR','weekly_basket'),
 ('offer-pharmacy','1','farmacia-lumen','essentials','Pharmacy refill',2500,'EUR','pharmacy_refill'),
 ('offer-next','1','dispensa-nord','essentials','Next weekly basket',5200,'EUR','next_basket');

create function nexi.audit(s uuid, a text, t text, description text, data jsonb default '{}') returns void
language sql security definer set search_path = nexi, pg_temp as $$
 insert into audit_events(session_id,actor,type,summary,evidence) values(s,a,t,description,data);
$$;
create function nexi.rule(c text, ok boolean, explanation text) returns jsonb
language sql security definer set search_path = nexi, pg_temp as $$
 select jsonb_build_object('code',c,'passed',coalesce(ok,false),'explanation',explanation);
$$;

create function nexi.eur(c integer) returns text
language sql security definer set search_path = nexi, pg_temp as $$
 select '€'||to_char(c/100.0,'FM999999990.00');
$$;

create function nexi.mandate_view(s uuid) returns jsonb language sql security definer set search_path = nexi, pg_temp as $$
 select v.terms || jsonb_build_object('id',m.id,'version',v.version,'kind',v.kind,
  'ownerId',x.owner_id,'agentId',x.agent_id,
  'status',case when m.status='active' and (v.terms->>'expiresAt')::timestamptz <= now() then 'expired' else m.status end,
  'currency','EUR','spentCents',m.spent_cents,'reservedCents',m.reserved_cents,
  'grantedBy','Elena','grantedAt',v.granted_at)
 from mandates m join sessions x on x.id=m.session_id
 join mandate_versions v on v.session_id=m.session_id and v.version=m.current_version where m.session_id=s;
$$;
create function nexi.proposal_view(p nexi.proposals) returns jsonb language sql security definer set search_path = nexi, pg_temp as $$
 select jsonb_build_object('id',p.id,'scenario',p.request->>'scenario','mandateVersion',(p.request->>'mandateVersion')::integer,
  'merchantId',coalesce(p.offer_snapshot->>'merchant_id',p.request->>'merchantId'),
  'merchantName',coalesce(p.offer_snapshot->>'merchant_name',p.request->>'merchantId'),
  'label',coalesce(p.offer_snapshot->>'label','Unknown offer'),
  'amountCents',coalesce((p.offer_snapshot->>'amount_cents')::integer,(p.request->>'amountCents')::integer),
  'decision',p.decision,'policy',p.policy,'humanResolution',p.resolution,'createdAt',p.created_at);
$$;
create function nexi.payment_view(p nexi.payments) returns jsonb language sql security definer set search_path = nexi, pg_temp as $$
 select jsonb_build_object('id',p.id,'proposalId',p.proposal_id,'state',p.state,'mode','simulation','amountCents',p.amount_cents,
  'merchantName',(select name from merchants where id=p.merchant_id),'providerReference',p.provider_reference,
  'bindingHash',p.binding_hash,'mandateVersion',p.mandate_version,'createdAt',p.created_at,'updatedAt',p.updated_at);
$$;

create function nexi.api_state(p jsonb) returns jsonb language plpgsql security definer set search_path = nexi, pg_temp as $$
declare s uuid := (p->>'sessionId')::uuid; a accounts; m mandates; v jsonb; pending proposals; quote jsonb; os jsonb;
begin
 -- Hold matching read locks so separate SPI queries cannot mix payment states.
 select * into m from mandates where session_id=s for share;
 select * into a from accounts where session_id=s for share;
 if not found then raise exception 'session_not_found'; end if;
 v := mandate_view(s);
 select * into pending from proposals where session_id=s and decision='request_approval' and resolution='none' order by created_at desc,id desc limit 1;
 if pending.id is not null and v is not null then
  quote := jsonb_build_object('proposalId',pending.id,'amountCents',(pending.offer_snapshot->>'amount_cents')::integer,
   'protectedShortfallCents',greatest(0,(v->>'minimumAvailableBalanceCents')::integer - (a.available_cents-m.reserved_cents-(pending.offer_snapshot->>'amount_cents')::integer)),
   'budgetOverrunCents',greatest(0,m.spent_cents+m.reserved_cents+(pending.offer_snapshot->>'amount_cents')::integer-(v->>'budgetCents')::integer),
   'newMinimumAvailableBalanceCents',a.available_cents-m.reserved_cents-(pending.offer_snapshot->>'amount_cents')::integer,
   'newBudgetCents',m.spent_cents+m.reserved_cents+(pending.offer_snapshot->>'amount_cents')::integer);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'version',o.version,'merchantId',o.merchant_id,'merchantName',r.name,
  'category',o.category,'label',o.label,'amountCents',o.amount_cents,'currency',o.currency,
  'eligible',coalesce((v->'allowedMerchantIds' ? o.merchant_id) and (v->'allowedCategories' ? o.category),false),
  'eligibilityReason',case when v is null then 'Grant a mandate first' when not (v->'allowedMerchantIds' ? o.merchant_id) then 'Merchant is not approved' when not (v->'allowedCategories' ? o.category) then 'Category is not approved' else 'Merchant and category approved' end,
  'selected',coalesce((o.id,o.version)=(select q.offer_snapshot->>'id',q.offer_snapshot->>'version' from proposals q
    where q.session_id=s and q.request->>'scenario'='weekly_basket' and q.decision='allow' order by q.created_at desc,q.id desc limit 1),false)) order by o.amount_cents,o.id),'[]') into os from offers o join merchants r on r.id=o.merchant_id;
 return jsonb_build_object('sessionId',s,'mode','simulation','planner','deterministic','offersAreSynthetic',true,'ownerName','Elena',
  'availableBalanceCents',a.available_cents,'period',a.period,'mandate',v,
  'reachCents',case when v->>'status'='active' then greatest(0,least((v->>'budgetCents')::integer-m.spent_cents-m.reserved_cents,(v->>'perPaymentLimitCents')::integer,a.available_cents-m.reserved_cents-(v->>'minimumAvailableBalanceCents')::integer)) else 0 end,
  'protectedShortfallCents',coalesce(greatest(0,(v->>'minimumAvailableBalanceCents')::integer-a.available_cents),0),
  'oneTimeExceptionCount',(select count(*) from mandate_versions where session_id=s and kind='one_time'),
  'merchants',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by id),'[]') from merchants),
  'offers',os,'proposals',(select coalesce(jsonb_agg(proposal_view(q) order by q.created_at desc,q.id desc),'[]') from proposals q where session_id=s),
  'payments',(select coalesce(jsonb_agg(payment_view(q) order by q.created_at desc,q.id desc),'[]') from payments q where session_id=s),
  'audit',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'actor',actor,'type',type,'summary',summary,'createdAt',created_at) order by id desc),'[]') from audit_events where session_id=s),
  'pendingException',case when pending.id is not null then proposal_view(pending) else null end,'regrantQuote',quote);
end $$;

create function nexi.api_agent_context(p jsonb) returns jsonb language plpgsql security definer set search_path = nexi, pg_temp as $$
declare s uuid := (p->>'sessionId')::uuid; v jsonb; state jsonb; eligible jsonb;
begin
 state := api_state(p);
 v := state->'mandate';
 select coalesce(jsonb_agg(x),'[]') into eligible from jsonb_array_elements(state->'offers') x
 where exists(select 1 from offers o where o.id=x->>'id' and o.version=x->>'version' and o.scenario=p->>'scenario');
 return jsonb_build_object('agentId',(select agent_id from sessions where id=s),'mandateVersion',coalesce((v->>'version')::integer,0),
  'mandateStatus',coalesce(v->>'status','revoked'),'period',state->'period','offers',eligible);
end $$;

create function nexi.api_create_session(p jsonb) returns jsonb language plpgsql security definer set search_path = nexi, pg_temp as $$
declare s uuid;
begin
 insert into sessions default values returning id into s;
 insert into accounts(session_id) values(s);
 insert into mandates(session_id) values(s);
 perform audit(s,'simulator','session_created','Synthetic demo session created with 28000 EUR cents');
 return api_state(jsonb_build_object('sessionId',s));
end $$;

create function nexi.api_human_grant(p jsonb) returns jsonb language plpgsql security definer set search_path = nexi, pg_temp as $$
declare s uuid := (p->>'sessionId')::uuid; m mandates; t jsonb; o jsonb := coalesce(p->'overrides','{}');
begin
 select * into m from mandates where session_id=s for update;
 if not found then raise exception 'session_not_found'; end if;
 if exists(select 1 from mandate_versions where session_id=s and version=m.current_version and kind='one_time') then raise exception 'one_time_pending'; end if;
 if o - array['budgetCents','perPaymentLimitCents','minimumAvailableBalanceCents','expiryDays'] <> '{}'::jsonb then raise exception 'invalid_request'; end if;
 t := jsonb_build_object('purpose','Weekly household essentials','allowedCategories',jsonb_build_array('essentials'),
  'budgetCents',coalesce((o->>'budgetCents')::integer,6500),'perPaymentLimitCents',coalesce((o->>'perPaymentLimitCents')::integer,6500),
  'minimumAvailableBalanceCents',coalesce((o->>'minimumAvailableBalanceCents')::integer,20000),
  'allowedMerchantIds',jsonb_build_array('dispensa-nord','mercato-aurora','farmacia-lumen'),'creditAllowed',false,
  'expiresAt',now()+make_interval(days=>coalesce((o->>'expiryDays')::integer,28)));
 if (t->>'budgetCents')::integer not between 1 and 1000000 or (t->>'perPaymentLimitCents')::integer not between 1 and 1000000
  or (t->>'minimumAvailableBalanceCents')::integer not between 0 and 1000000 or coalesce((o->>'expiryDays')::integer,28) not between 1 and 365 then raise exception 'invalid_request'; end if;
 insert into mandate_versions(session_id,version,kind,terms) values(s,m.current_version+1,'standing',t);
 update mandates set current_version=current_version+1,status='active' where session_id=s;
 perform audit(s,'human','mandate_granted',format('Standing mandate v%s granted',m.current_version+1),t);
 return api_state(p);
end $$;

create function nexi.submit_proposal(p jsonb) returns jsonb language plpgsql security definer set search_path = nexi, pg_temp as $$
declare s uuid := (p->>'sessionId')::uuid; m mandates; a accounts; v mandate_versions; o offers; old proposals;
 q proposals; pay payments; r jsonb; d text; failed text[]; amount integer; snap jsonb; mv jsonb; request jsonb := p-'sessionId';
begin
 -- All money-changing functions take locks in this order: mandate, account, payment.
 select * into m from mandates where session_id=s for update;
 if not found then raise exception 'session_not_found'; end if;
 select * into a from accounts where session_id=s for update;
 select * into old from proposals where session_id=s and idempotency_key=p->>'idempotencyKey';
 if found then
  if old.request <> request then raise exception 'idempotency_conflict'; end if;
  select * into pay from payments where proposal_id=old.id;
  return jsonb_build_object('proposal',proposal_view(old),'payment',case when pay.id is not null then payment_view(pay) else null end,'replayed',true);
 end if;
 if coalesce(length(p->>'idempotencyKey'),0) not between 1 and 200 then raise exception 'invalid_request'; end if;
 select * into v from mandate_versions where session_id=s and version=m.current_version;
 select * into o from offers where id=p->>'offerId' and version=p->>'offerVersion';
 amount := coalesce(o.amount_cents,(p->>'amountCents')::integer,0);
 mv := coalesce(mandate_view(s),'{}');
 if o.id is not null then select to_jsonb(o)||jsonb_build_object('merchant_name',name) into snap from merchants where id=o.merchant_id; end if;
 r := jsonb_build_array(
  rule('agent_relationship',p->>'agentId'=(select agent_id::text from sessions where id=s),'Agent must match the session agent'),
  rule('mandate_active',m.status='active',format('Mandate status is %s',m.status)),
  rule('mandate_version_current',(p->>'mandateVersion')::integer=m.current_version,format('Claimed version %s; current version %s',p->>'mandateVersion',m.current_version)),
  rule('mandate_not_expired',v.version is not null and (v.terms->>'expiresAt')::timestamptz>now(),format('Mandate expiry %s; evaluated at %s',v.terms->>'expiresAt',now())),
  rule('one_time_scope',v.kind='standing' or (v.kind='one_time' and v.consumed_at is null and v.scope_offer_id=p->>'offerId' and v.scope_offer_version=p->>'offerVersion'),'One-time mandate must be unconsumed and match the exact offer version'),
  rule('offer_exists',o.id is not null,format('Server offer %s version %s',p->>'offerId',p->>'offerVersion')),
  rule('offer_matches_server',o.id is not null and o.merchant_id=p->>'merchantId' and o.amount_cents=(p->>'amountCents')::integer and o.currency=p->>'currency',format('Claim %s cents, merchant %s, currency %s; server %s cents, merchant %s, currency %s',p->>'amountCents',p->>'merchantId',p->>'currency',o.amount_cents,o.merchant_id,o.currency)),
  rule('amount_valid',(p->>'amountCents')::integer>0 and amount>0,format('Claimed amount %s cents; server amount %s cents',p->>'amountCents',amount)),
  rule('currency_match',p->>'currency'='EUR' and o.currency='EUR',format('Claimed currency %s; mandate currency EUR',p->>'currency')),
  rule('merchant_allowed',v.terms->'allowedMerchantIds' ? o.merchant_id,format('Server merchant %s must be in %s',o.merchant_id,v.terms->'allowedMerchantIds')),
  rule('category_allowed',v.terms->'allowedCategories' ? o.category,format('Server category %s must be in %s',o.category,v.terms->'allowedCategories')),
  rule('per_payment_limit',amount<=(v.terms->>'perPaymentLimitCents')::integer,format('Server amount %s cents; per-payment limit %s cents',amount,v.terms->>'perPaymentLimitCents')),
  rule('budget_remaining',amount <= (v.terms->>'budgetCents')::integer-m.spent_cents-m.reserved_cents,format('Weekly budget: needs %s, %s left',eur(amount),eur(greatest(0,(v.terms->>'budgetCents')::integer-m.spent_cents-m.reserved_cents)))),
  rule('balance_above_buffer',a.available_cents-m.reserved_cents-amount >= (v.terms->>'minimumAvailableBalanceCents')::integer,format('Protected money: would leave %s, your line is %s',eur(a.available_cents-m.reserved_cents-amount),eur((v.terms->>'minimumAvailableBalanceCents')::integer))),
  rule('credit_forbidden',p->>'fundingType'='debit' or (p->>'fundingType'='credit' and (v.terms->>'creditAllowed')::boolean),format('Funding %s; credit allowed %s',p->>'fundingType',v.terms->>'creditAllowed'))
 );
 select array_agg(x->>'code') into failed from jsonb_array_elements(r) x where not (x->>'passed')::boolean;
 d := case when failed is null then 'allow' when failed <@ array['budget_remaining','balance_above_buffer'] then 'request_approval' else 'block' end;
 insert into proposals(session_id,idempotency_key,request,mandate_snapshot,offer_snapshot,policy,decision)
 values(s,p->>'idempotencyKey',request,mv,snap,jsonb_build_object('decision',d,'rules',r,
  'projectedAvailableBalanceCents',a.available_cents-m.reserved_cents-amount,
  'projectedBudgetRemainingCents',coalesce((v.terms->>'budgetCents')::integer,0)-m.spent_cents-m.reserved_cents-amount),d) returning * into q;
 if d='allow' then
  insert into payments(session_id,proposal_id,amount_cents,currency,merchant_id,mandate_version,binding_hash)
  values(s,q.id,amount,o.currency,o.merchant_id,v.version,encode(sha256(convert_to(concat_ws('|',q.id,o.merchant_id,amount,o.currency,o.id,o.version,v.version),'UTF8')),'hex')) returning * into pay;
  update mandates set reserved_cents=reserved_cents+amount where session_id=s;
  if v.kind='one_time' then update mandate_versions set consumed_at=now() where session_id=s and version=v.version; end if;
  insert into ledger_entries(session_id,payment_id,type,amount_cents) values(s,pay.id,'reserve',amount);
 end if;
 perform audit(s,'gate','proposal_'||d,format('Proposal %s: %s; failed rules: %s',q.id,d,coalesce(array_to_string(failed,', '),'none')),
  jsonb_build_object('proposalId',q.id,'policy',q.policy,'mandate',mv,'offer',snap,'providerReference',pay.provider_reference));
 return jsonb_build_object('proposal',proposal_view(q),'payment',case when pay.id is not null then payment_view(pay) else null end,'replayed',false);
end $$;
create function nexi.api_submit_proposal(p jsonb) returns jsonb language sql security definer set search_path = nexi, pg_temp as $$ select submit_proposal(p); $$;

create function nexi.human_regrant(s uuid, proposal_id uuid) returns jsonb language plpgsql security definer set search_path = nexi, pg_temp as $$
declare m mandates; a accounts; q proposals; v mandate_versions; t jsonb; amount integer;
begin
 select * into m from mandates where session_id=s for update;
 select * into a from accounts where session_id=s for update;
 select * into q from proposals where id=proposal_id and session_id=s for update;
 if q.id is null or q.decision<>'request_approval' or q.resolution<>'none' then raise exception 'invalid_resolution'; end if;
 select * into v from mandate_versions where session_id=s and version=m.current_version;
 if m.status<>'active' or v.kind<>'standing' or v.version<>(q.request->>'mandateVersion')::integer or (v.terms->>'expiresAt')::timestamptz<=now() then raise exception 'stale_proposal'; end if;
 amount := (q.offer_snapshot->>'amount_cents')::integer;
 if a.available_cents-m.reserved_cents-amount<0 then raise exception 'insufficient_balance'; end if;
 t := v.terms || jsonb_build_object('minimumAvailableBalanceCents',a.available_cents-m.reserved_cents-amount,'budgetCents',m.spent_cents+m.reserved_cents+amount);
 insert into mandate_versions(session_id,version,kind,terms,scope_offer_id,scope_offer_version)
 values(s,m.current_version+1,'one_time',t,q.offer_snapshot->>'id',q.offer_snapshot->>'version');
 update mandates set current_version=current_version+1 where session_id=s;
 update proposals set resolution='regranted' where id=q.id;
 perform audit(s,'human','mandate_regranted',format('One-time mandate v%s for %s cents',m.current_version+1,amount),t);
 return api_state(jsonb_build_object('sessionId',s));
end $$;
create function nexi.api_human_regrant(p jsonb) returns jsonb language sql security definer set search_path = nexi, pg_temp as $$ select human_regrant((p->>'sessionId')::uuid,(p->>'proposalId')::uuid); $$;
create function nexi.api_human_keep_rules(p jsonb) returns jsonb language plpgsql security definer set search_path = nexi, pg_temp as $$
declare s uuid := (p->>'sessionId')::uuid;
begin
 perform 1 from mandates where session_id=s for update;
 update proposals set resolution='kept_rules' where session_id=s and id=(p->>'proposalId')::uuid and decision='request_approval' and resolution='none';
 if not found then raise exception 'invalid_resolution'; end if;
 perform audit(s,'human','rules_kept','Human kept the standing rules',p-'sessionId');
 return api_state(p);
end $$;
create function nexi.api_human_revoke(p jsonb) returns jsonb language plpgsql security definer set search_path = nexi, pg_temp as $$
begin
 update mandates set status='revoked' where session_id=(p->>'sessionId')::uuid;
 if not found then raise exception 'session_not_found'; end if;
 perform audit((p->>'sessionId')::uuid,'human','mandate_revoked','Mandate revoked; completed payments remain unchanged');
 return api_state(p);
end $$;

create function nexi.restore_standing(s uuid, used_version integer) returns void language plpgsql security definer set search_path = nexi, pg_temp as $$
declare m mandates; t jsonb;
begin
 select * into m from mandates where session_id=s;
 if m.current_version=used_version and exists(select 1 from mandate_versions where session_id=s and version=used_version and kind='one_time') then
  select terms into t from mandate_versions where session_id=s and kind='standing' order by version desc limit 1;
  insert into mandate_versions(session_id,version,kind,terms) values(s,m.current_version+1,'standing',t);
  update mandates set current_version=current_version+1 where session_id=s;
  perform audit(s,'gate','standing_restored',format('Standing terms restored as v%s',m.current_version+1),t);
 end if;
end $$;
create function nexi.begin_submission(p jsonb) returns jsonb language plpgsql security definer set search_path = nexi, pg_temp as $$
declare s uuid := (p->>'sessionId')::uuid; m mandates; a accounts; pay payments; v mandate_versions;
begin
 select * into m from mandates where session_id=s for update;
 select * into a from accounts where session_id=s for update;
 select * into pay from payments where id=(p->>'paymentId')::uuid and session_id=s for update;
 if pay.id is null then raise exception 'payment_not_found'; end if;
 if pay.state<>'proposed' then return jsonb_build_object('started',false,'payment',payment_view(pay)); end if;
 select * into v from mandate_versions where session_id=s and version=m.current_version;
 if m.status<>'active' or (v.terms->>'expiresAt')::timestamptz<=now() or pay.mandate_version<>m.current_version then
  update payments set state='blocked',updated_at=now() where id=pay.id returning * into pay;
  update mandates set reserved_cents=reserved_cents-pay.amount_cents where session_id=s;
  insert into ledger_entries(session_id,payment_id,type,amount_cents) values(s,pay.id,'release',pay.amount_cents);
  perform audit(s,'gate','submission_blocked','Submission blocked by revocation, expiry, or stale mandate version',jsonb_build_object('paymentId',pay.id));
  return jsonb_build_object('started',false,'payment',payment_view(pay));
 end if;
 update payments set state='processing',updated_at=now() where id=pay.id returning * into pay;
 perform audit(s,'gate','submission_started','Provider submission started',jsonb_build_object('paymentId',pay.id,'providerReference',pay.provider_reference,'bindingHash',pay.binding_hash));
 return jsonb_build_object('started',true,'payment',payment_view(pay));
end $$;
create function nexi.api_begin_submission(p jsonb) returns jsonb language sql security definer set search_path = nexi, pg_temp as $$ select begin_submission(p); $$;

create function nexi.apply_provider_event(p jsonb) returns jsonb language plpgsql security definer set search_path = nexi, pg_temp as $$
declare pay payments; s uuid; m mandates; a accounts; existing provider_events; st text := p->>'state';
begin
 select session_id into s from payments where provider_reference=p->>'reference';
 if s is null then raise exception 'payment_not_found'; end if;
 select * into m from mandates where session_id=s for update;
 select * into a from accounts where session_id=s for update;
 select * into pay from payments where provider_reference=p->>'reference' for update;
 if coalesce((p->>'amountCents')::integer,-1)<>pay.amount_cents or p->>'currency' is distinct from pay.currency or p->>'bindingHash' is distinct from pay.binding_hash then raise exception 'provider_mismatch'; end if;
 if st is null or st not in ('authorized','executed','failed','requires_action','unknown') or coalesce(length(p->>'eventId'),0) not between 1 and 200 then raise exception 'invalid_provider_event'; end if;
 select * into existing from provider_events where id=p->>'eventId';
 if found then
  if existing.payload<>p then raise exception 'provider_event_conflict'; end if;
  return jsonb_build_object('replayed',true,'payment',payment_view(pay));
 end if;
 if pay.state not in ('processing','authorized','requires_action','unknown','executed','failed') then raise exception 'invalid_payment_transition'; end if;
 insert into provider_events(id,payment_id,payload) values(p->>'eventId',pay.id,p);
 -- Late events after a terminal outcome are recorded but cannot settle twice or regress it.
 if pay.state in ('executed','failed') then return jsonb_build_object('replayed',false,'payment',payment_view(pay)); end if;
 if st='executed' then
  update accounts set available_cents=available_cents-pay.amount_cents where session_id=s;
  update mandates set reserved_cents=reserved_cents-pay.amount_cents,spent_cents=spent_cents+pay.amount_cents where session_id=s;
  insert into ledger_entries(session_id,payment_id,type,amount_cents) values(s,pay.id,'settle',pay.amount_cents);
 elsif st='failed' then
  update mandates set reserved_cents=reserved_cents-pay.amount_cents where session_id=s;
  insert into ledger_entries(session_id,payment_id,type,amount_cents) values(s,pay.id,'release',pay.amount_cents);
 end if;
 update payments set state=st,updated_at=now() where id=pay.id returning * into pay;
 perform audit(s,'provider','payment_'||st,format('Verified provider event: %s, %s cents',st,pay.amount_cents),p);
 if st in ('executed','failed') then perform restore_standing(s,pay.mandate_version); end if;
 return jsonb_build_object('replayed',false,'payment',payment_view(pay));
end $$;
create function nexi.api_apply_provider_event(p jsonb) returns jsonb language sql security definer set search_path = nexi, pg_temp as $$ select apply_provider_event(p); $$;

create function nexi.api_next_week(p jsonb) returns jsonb language plpgsql security definer set search_path = nexi, pg_temp as $$
declare s uuid := (p->>'sessionId')::uuid; m mandates;
begin
 select * into m from mandates where session_id=s for update;
 if not found then raise exception 'session_not_found'; end if;
 perform 1 from accounts where session_id=s for update;
 if m.reserved_cents<>0 then raise exception 'payments_pending'; end if;
 update accounts set available_cents=available_cents+12000,period=period+1 where session_id=s;
 update mandates set spent_cents=0 where session_id=s;
 insert into ledger_entries(session_id,type,amount_cents) values(s,'pay',12000);
 perform audit(s,'simulator','next_week','Synthetic next week: pay +12000 cents; period budget reset');
 return api_state(p);
end $$;

-- Default function EXECUTE grants must be removed, including internal helpers.
revoke all on schema nexi from public;
revoke all on all tables in schema nexi from public, nexi_app;
revoke all on all sequences in schema nexi from public, nexi_app;
revoke all on all functions in schema nexi from public, nexi_app;
alter default privileges in schema nexi revoke execute on functions from public;
grant usage on schema nexi to nexi_app;
do $$ declare r record; role_name text; begin
 for r in select tablename from pg_tables where schemaname='nexi' loop
  execute format('alter table nexi.%I enable row level security',r.tablename);
 end loop;
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='nexi' and p.proname like 'api\_%' escape '\' loop
  execute format('grant execute on function %s to nexi_app',r.signature);
 end loop;
 foreach role_name in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on schema nexi from %I',role_name);
   execute format('revoke all on all tables in schema nexi from %I',role_name);
   execute format('revoke all on all sequences in schema nexi from %I',role_name);
   execute format('revoke all on all functions in schema nexi from %I',role_name);
  end if;
 end loop;
end $$;
commit;

