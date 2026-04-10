create table if not exists properties (
  id text primary key,
  name text not null,
  address text,
  city text,
  state text,
  created_at timestamptz default now()
);

create table if not exists app_settings (
  id text primary key,
  due_day integer not null default 1,
  warning_template text not null
);

create table if not exists units (
  id text primary key,
  property_id text references properties(id) on delete cascade,
  unit_number text not null,
  parking_spot text,
  status text not null default 'Vacant',
  default_monthly_rent numeric(12,2) not null default 0,
  created_at timestamptz default now()
);

create table if not exists tenants (
  id text primary key,
  property_id text references properties(id) on delete cascade,
  unit_id text references units(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  memo text,
  monthly_rent numeric(12,2) not null default 0,
  deposit_amount numeric(12,2) not null default 0,
  lease_start date,
  lease_end date,
  status text not null default 'Active',
  created_at timestamptz default now()
);

create table if not exists tenant_documents (
  id text primary key,
  tenant_id text references tenants(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  file_path text,
  uploaded_at timestamptz default now()
);

create table if not exists rent_charges (
  id text primary key,
  tenant_id text references tenants(id) on delete cascade,
  charge_month text not null,
  due_date date not null,
  rent_amount numeric(12,2) not null default 0,
  other_charges numeric(12,2) not null default 0,
  total_charge numeric(12,2) not null default 0,
  created_at timestamptz default now()
);

create table if not exists payments (
  id text primary key,
  tenant_id text references tenants(id) on delete cascade,
  payment_date date not null,
  amount numeric(12,2) not null default 0,
  method text not null,
  reference text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_units_property_id on units(property_id);
create index if not exists idx_tenants_property_id on tenants(property_id);
create index if not exists idx_tenants_unit_id on tenants(unit_id);
create index if not exists idx_documents_tenant_id on tenant_documents(tenant_id);
create index if not exists idx_rent_charges_tenant_id on rent_charges(tenant_id);
create index if not exists idx_payments_tenant_id on payments(tenant_id);

alter table properties enable row level security;
alter table app_settings enable row level security;
alter table units enable row level security;
alter table tenants enable row level security;
alter table tenant_documents enable row level security;
alter table rent_charges enable row level security;
alter table payments enable row level security;

do $$ begin
  create policy "service role manages properties" on properties for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "service role manages settings" on app_settings for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "service role manages units" on units for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "service role manages tenants" on tenants for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "service role manages tenant documents" on tenant_documents for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "service role manages rent charges" on rent_charges for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "service role manages payments" on payments for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

insert into storage.buckets (id, name, public)
values ('lease-documents', 'lease-documents', true)
on conflict (id) do nothing;
