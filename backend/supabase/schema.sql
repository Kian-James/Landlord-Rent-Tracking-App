-- UPDATED_AT TRIGGER
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- LANDLORDS
create table public.landlords (
  id text primary key,
  name text not null check (char_length(name) between 1 and 120),
  email text not null unique check (email = lower(email)),
  gmail_integration jsonb not null
    default '{"connected": false, "gmailAddress": null, "scopes": []}'::jsonb,
  notification_preferences jsonb not null
    default '{"rentReminders": true, "contractReminders": true, "reminderDaysBefore": [3, 1]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger landlords_updated before update on public.landlords
  for each row execute function public.set_updated_at();

-- PROPERTIES
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id text not null references public.landlords(id) on delete cascade,
  name text not null check (char_length(name) <= 160),
  address text not null check (char_length(address) <= 300),
  description text not null default '' check (char_length(description) <= 2000),
  notes text not null default '' check (char_length(notes) <= 2000),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index properties_landlord_name_idx on public.properties (landlord_id, name);

create trigger properties_updated before update on public.properties
  for each row execute function public.set_updated_at();

-- UNITS
create table public.units (
  id uuid primary key default gen_random_uuid(),
  landlord_id text not null references public.landlords(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null check (char_length(name) <= 80),
  monthly_rent numeric(12, 2) not null check (monthly_rent >= 0),
  utilities jsonb not null default '{
    "electricity": {"amount": 0, "dueDay": null},
    "water":       {"amount": 0, "dueDay": null},
    "wifi":        {"amount": 0, "dueDay": null}
  }'::jsonb,
  status text not null default 'vacant'
    check (status in ('occupied', 'vacant', 'reserved', 'maintenance')),
  current_tenant_id uuid,
  notes text not null default '' check (char_length(notes) <= 2000),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index units_landlord_property_idx on public.units (landlord_id, property_id);
create index units_property_idx on public.units (property_id);
create index units_status_idx on public.units (status);

create trigger units_updated before update on public.units
  for each row execute function public.set_updated_at();

-- TENANTS
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  landlord_id text not null references public.landlords(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  full_name text not null check (char_length(full_name) <= 160),
  email text not null default '',
  phone text not null default '',
  monthly_rent numeric(12, 2) not null check (monthly_rent >= 0),
  rent_due_day int not null default 1 check (rent_due_day between 1 and 31),
  lease_start_date timestamptz not null,
  lease_end_date timestamptz not null,
  contract_duration_months int not null default 12,
  status text not null default 'active'
    check (status in ('active', 'notice_period', 'vacated', 'inactive')),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tenants_landlord_status_idx on public.tenants (landlord_id, status);
create index tenants_unit_idx on public.tenants (unit_id);

create trigger tenants_updated before update on public.tenants
  for each row execute function public.set_updated_at();

alter table public.units
  add constraint units_current_tenant_fk
  foreign key (current_tenant_id) references public.tenants(id) on delete set null;

-- CONTRACTS
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  landlord_id text not null references public.landlords(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  start_date timestamptz not null,
  end_date timestamptz not null,
  duration_months int not null,
  monthly_rent numeric(12, 2) not null check (monthly_rent >= 0),
  advance jsonb not null default '{"months": 1, "amountOverride": null, "method": null, "referenceNumber": ""}'::jsonb,
  deposit jsonb not null default '{"months": 1, "amountOverride": null, "method": null, "referenceNumber": ""}'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'expired', 'terminated', 'superseded')),
  reminder_days_before int not null default 30,
  reminder_sent_at timestamptz,
  previous_contract_id uuid references public.contracts(id) on delete set null,
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contracts_landlord_end_status_idx on public.contracts (landlord_id, end_date, status);
create index contracts_tenant_idx on public.contracts (tenant_id);

create trigger contracts_updated before update on public.contracts
  for each row execute function public.set_updated_at();

-- RENT_RECORDS
create table public.rent_records (
  id uuid primary key default gen_random_uuid(),
  landlord_id text not null references public.landlords(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  due_date timestamptz not null,
  amount_due numeric(12, 2) not null check (amount_due >= 0),
  status text not null default 'upcoming'
    check (status in ('upcoming', 'pending', 'paid', 'overdue', 'verification')),
  payment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, period)
);
create index rent_records_landlord_status_due_idx on public.rent_records (landlord_id, status, due_date);
create index rent_records_landlord_period_idx on public.rent_records (landlord_id, period);

create trigger rent_records_updated before update on public.rent_records
  for each row execute function public.set_updated_at();

-- PAYMENTS
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  landlord_id text not null references public.landlords(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  rent_record_id uuid not null references public.rent_records(id) on delete cascade,
  expected_amount numeric(12, 2) not null,
  actual_amount numeric(12, 2),
  payment_date timestamptz,
  method text check (method in ('cash', 'gcash', 'maya', 'bank_transfer', 'other')),
  reference_number text not null default '',
  notes text not null default '' check (char_length(notes) <= 2000),
  receipt jsonb,
  verification_status text not null default 'none'
    check (verification_status in ('none', 'awaiting_verification', 'approved', 'rejected')),
  verified_by text references public.landlords(id) on delete set null,
  verified_at timestamptz,
  rejection_reason text not null default '' check (char_length(rejection_reason) <= 500),
  source text not null default 'manual'
    check (source in ('manual', 'tenant_upload', 'gmail', 'advance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_landlord_verification_idx on public.payments (landlord_id, verification_status);
create index payments_rent_record_idx on public.payments (rent_record_id);
create index payments_tenant_idx on public.payments (tenant_id);

create trigger payments_updated before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.rent_records
  add constraint rent_records_payment_fk
  foreign key (payment_id) references public.payments(id) on delete set null;

-- UTILITY_BILL_RECORDS
create table public.utility_bill_records (
  id uuid primary key default gen_random_uuid(),
  landlord_id text not null references public.landlords(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  type text not null check (type in ('electricity', 'water', 'wifi')),
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  due_date timestamptz not null,
  amount_due numeric(12, 2) check (amount_due >= 0),
  status text not null default 'upcoming'
    check (status in ('upcoming', 'pending', 'paid', 'overdue')),
  paid_at timestamptz,
  paid_amount numeric(12, 2),
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, type, period)
);
create index utility_bills_landlord_status_due_idx on public.utility_bill_records (landlord_id, status, due_date);
create index utility_bills_landlord_period_idx on public.utility_bill_records (landlord_id, period);

create trigger utility_bill_records_updated before update on public.utility_bill_records
  for each row execute function public.set_updated_at();

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  landlord_id text not null references public.landlords(id) on delete cascade,
  type text not null check (type in (
    'rent_due_soon', 'rent_due_today', 'rent_overdue', 'utility_bill_overdue',
    'receipt_received', 'payment_awaiting_verification', 'payment_approved',
    'payment_rejected', 'contract_expiring', 'contract_renewed'
  )),
  title text not null,
  message text not null,
  related_resource_type text not null
    check (related_resource_type in ('RentRecord', 'UtilityBillRecord', 'Payment', 'Contract', 'Tenant')),
  related_resource_id uuid not null,
  priority text not null default 'informational'
    check (priority in ('critical', 'important', 'informational')),
  read boolean not null default false,
  dismissed boolean not null default false,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (landlord_id, dedupe_key)
);
create index notifications_landlord_read_created_idx on public.notifications (landlord_id, read, created_at desc);

create trigger notifications_updated before update on public.notifications
  for each row execute function public.set_updated_at();

-- AUDIT_LOGS
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  landlord_id text not null references public.landlords(id) on delete cascade,
  event text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip text not null default '',
  created_at timestamptz not null default now()
);
create index audit_logs_landlord_created_idx on public.audit_logs (landlord_id, created_at desc);

-- RLS
alter table public.landlords enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.tenants enable row level security;
alter table public.contracts enable row level security;
alter table public.rent_records enable row level security;
alter table public.payments enable row level security;
alter table public.utility_bill_records enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines  in schema public to service_role;

alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on routines  to service_role;