-- Invented demo data for the video and screenshots. Safe to run more than once:
-- it first removes only the rows it created earlier (properties marked 'seed'
-- and everything under them). Nothing else in the database is touched.
--
-- 1. Log in to the app once so your landlord row exists.
-- 2. Firebase console -> Authentication -> Users -> copy your User UID.
-- 3. Paste it below, then run this file in the Supabase SQL Editor.

do $$
declare
  lid text := 'PASTE-YOUR-FIREBASE-UID-HERE';
  p1 uuid; p2 uuid;
  u1 uuid; u2 uuid; u3 uuid; u4 uuid; u5 uuid; u6 uuid;
  t1 uuid; t2 uuid; t3 uuid; t4 uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid;
  m0 timestamptz := date_trunc('month', now());
  rec record;
  pay uuid;
  rr uuid;
begin
  if not exists (select 1 from landlords where id = lid) then
    raise exception 'No landlord with id %. Log in to the app once, then paste your Firebase UID above.', lid;
  end if;

  delete from properties where landlord_id = lid and notes = 'seed';

  insert into properties (landlord_id, name, address, description, notes)
  values (lid, 'Sampaguita Apartments', '12 Mabini Street, Barangay Poblacion', 'Three-unit apartment building near the market.', 'seed')
  returning id into p1;
  insert into properties (landlord_id, name, address, description, notes)
  values (lid, 'Narra Townhomes', '48 Rizal Avenue, Barangay San Jose', 'Two-storey townhouses with a shared parking area.', 'seed')
  returning id into p2;

  insert into units (landlord_id, property_id, name, monthly_rent, utilities)
  values (lid, p1, 'Unit 101', 8500, '{"electricity":{"amount":1800,"dueDay":15},"water":{"amount":350,"dueDay":10},"wifi":{"amount":1299,"dueDay":5}}') returning id into u1;
  insert into units (landlord_id, property_id, name, monthly_rent, utilities)
  values (lid, p1, 'Unit 102', 9000, '{"electricity":{"amount":2100,"dueDay":15},"water":{"amount":400,"dueDay":10},"wifi":{"amount":0,"dueDay":null}}') returning id into u2;
  insert into units (landlord_id, property_id, name, monthly_rent) values (lid, p1, 'Unit 103', 8000) returning id into u3;
  insert into units (landlord_id, property_id, name, monthly_rent, utilities)
  values (lid, p2, 'Townhome A', 12000, '{"electricity":{"amount":2600,"dueDay":18},"water":{"amount":500,"dueDay":12},"wifi":{"amount":1599,"dueDay":7}}') returning id into u4;
  insert into units (landlord_id, property_id, name, monthly_rent, utilities)
  values (lid, p2, 'Townhome B', 12500, '{"electricity":{"amount":2400,"dueDay":18},"water":{"amount":450,"dueDay":12},"wifi":{"amount":0,"dueDay":null}}') returning id into u5;
  insert into units (landlord_id, property_id, name, monthly_rent, status) values (lid, p2, 'Townhome C', 11000, 'maintenance') returning id into u6;

  insert into tenants (landlord_id, property_id, unit_id, full_name, email, phone, monthly_rent, rent_due_day, lease_start_date, lease_end_date, contract_duration_months)
  values (lid, p1, u1, 'Juan Dela Cruz', 'juan.sample@example.com', '09170000001', 8500, 1, m0 - interval '5 months', m0 + interval '7 months', 12) returning id into t1;
  insert into tenants (landlord_id, property_id, unit_id, full_name, email, phone, monthly_rent, rent_due_day, lease_start_date, lease_end_date, contract_duration_months)
  values (lid, p1, u2, 'Maria Clara Reyes', 'maria.sample@example.com', '09170000002', 9000, 10, m0 - interval '11 months', m0 + interval '20 days', 12) returning id into t2;
  insert into tenants (landlord_id, property_id, unit_id, full_name, email, phone, monthly_rent, rent_due_day, lease_start_date, lease_end_date, contract_duration_months)
  values (lid, p2, u4, 'Pedro Santos', 'pedro.sample@example.com', '09170000003', 12000, 5, m0 - interval '3 months', m0 + interval '9 months', 12) returning id into t3;
  insert into tenants (landlord_id, property_id, unit_id, full_name, email, phone, monthly_rent, rent_due_day, lease_start_date, lease_end_date, contract_duration_months)
  values (lid, p2, u5, 'Ana Lim', 'ana.sample@example.com', '09170000004', 12500, 25, m0 - interval '2 months', m0 + interval '10 months', 12) returning id into t4;

  update units set status = 'occupied', current_tenant_id = t1 where id = u1;
  update units set status = 'occupied', current_tenant_id = t2 where id = u2;
  update units set status = 'occupied', current_tenant_id = t3 where id = u4;
  update units set status = 'occupied', current_tenant_id = t4 where id = u5;

  insert into contracts (landlord_id, tenant_id, unit_id, property_id, start_date, end_date, duration_months, monthly_rent, advance, deposit)
  select lid, t.id, t.unit_id, t.property_id, t.lease_start_date, t.lease_end_date, t.contract_duration_months, t.monthly_rent,
         jsonb_build_object('months', 1, 'amountOverride', null, 'collectedAt', t.lease_start_date, 'method', 'cash', 'referenceNumber', ''),
         jsonb_build_object('months', 1, 'amountOverride', null, 'collectedAt', t.lease_start_date, 'method', 'cash', 'referenceNumber', '')
  from tenants t where t.id in (t1, t2, t3, t4);

  for rec in
    select t.id as tenant_id, t.unit_id, t.property_id, t.monthly_rent, t.rent_due_day, gs.back
    from tenants t
    cross join generate_series(0, 2) as gs(back)
    where t.id in (t1, t2, t3, t4)
  loop
    insert into rent_records (landlord_id, tenant_id, unit_id, property_id, period, due_date, amount_due, status)
    values (
      lid, rec.tenant_id, rec.unit_id, rec.property_id,
      to_char(m0 - (rec.back || ' months')::interval, 'YYYY-MM'),
      m0 - (rec.back || ' months')::interval + ((rec.rent_due_day - 1) || ' days')::interval,
      rec.monthly_rent, 'upcoming'
    )
    returning id into rr;

    if rec.back > 0 and not (rec.tenant_id = t4 and rec.back = 1)
       or (rec.back = 0 and rec.tenant_id = t1) then
      insert into payments (landlord_id, tenant_id, unit_id, property_id, rent_record_id, expected_amount, actual_amount, payment_date, method, verification_status, verified_by, verified_at, source)
      values (
        lid, rec.tenant_id, rec.unit_id, rec.property_id, rr, rec.monthly_rent, rec.monthly_rent,
        m0 - (rec.back || ' months')::interval + ((rec.rent_due_day - 1) || ' days')::interval,
        case when rec.tenant_id = t1 then 'gcash' else 'cash' end,
        'approved', lid, now(), 'manual'
      )
      returning id into pay;
      update rent_records set status = 'paid', payment_id = pay where id = rr;
    end if;
  end loop;

  insert into utility_bill_records (landlord_id, unit_id, property_id, tenant_id, type, period, due_date, amount_due, status, paid_at, paid_amount)
  select lid, u.id, u.property_id, u.current_tenant_id, b.type, to_char(m0, 'YYYY-MM'),
         m0 + (((u.utilities -> b.type ->> 'dueDay')::int - 1) || ' days')::interval,
         (u.utilities -> b.type ->> 'amount')::numeric,
         case when b.type = 'wifi' then 'paid' else 'upcoming' end,
         case when b.type = 'wifi' then m0 + interval '4 days' end,
         case when b.type = 'wifi' then (u.utilities -> b.type ->> 'amount')::numeric end
  from units u
  cross join (values ('electricity'), ('water'), ('wifi')) as b(type)
  where u.landlord_id = lid and u.property_id in (p1, p2)
    and (u.utilities -> b.type ->> 'dueDay') is not null;
end;
$$;
