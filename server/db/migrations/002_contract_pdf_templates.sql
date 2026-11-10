-- Contract PDF feature
-- Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Safe to run more than once, and safe whether or not an earlier version was run.

-- 1. Addresses used in the contract
alter table public.tenants
  add column if not exists address text not null default '' check (char_length(address) <= 300);

alter table public.landlords
  add column if not exists address text not null default '' check (char_length(address) <= 300);

-- 2. One contract template per landlord (their uploaded PDF + which parts change per tenant).
--    No row = the landlord uses the built-in starter contract.
create table if not exists public.contract_templates (
  landlord_id text primary key references public.landlords(id) on delete cascade,
  pdf_base64 text,
  model jsonb,
  slots jsonb not null default '[]'::jsonb,
  source_filename text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If an earlier (text-only) version of this table exists, bring it up to date.
alter table public.contract_templates add column if not exists pdf_base64 text;
alter table public.contract_templates add column if not exists model jsonb;
alter table public.contract_templates add column if not exists slots jsonb not null default '[]'::jsonb;
alter table public.contract_templates add column if not exists source_filename text not null default '';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'contract_templates' and column_name = 'body'
  ) then
    alter table public.contract_templates alter column body drop not null;
    -- old text templates can't be used by the new PDF-based feature
    delete from public.contract_templates where pdf_base64 is null;
  end if;
end $$;

drop trigger if exists contract_templates_updated on public.contract_templates;
create trigger contract_templates_updated before update on public.contract_templates
  for each row execute function public.set_updated_at();

alter table public.contract_templates enable row level security;
