import React, { useEffect, useState } from 'react';
import client from '../api/client.js';
import StatModal from './StatModal.jsx';
import Avatar from './Avatar.jsx';
import { BarRow, SectionTitle } from './breakdownParts.jsx';
import { peso, pctOf, plural } from '../lib/breakdown.js';

const TITLES = { active: 'Active tenants', rent: 'Monthly rent roll', expiring: 'Leases expiring soon' };
const DAY = 86400000;

// Same rounding the Tenants page uses for its "expiring soon" count.
const daysUntil = (date) => Math.ceil((new Date(date) - new Date()) / DAY);

function TenantRow({ tenant, note, noteTone = 'text-ink/50' }) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar name={tenant.fullName} size="sm" />
        <span className="min-w-0">
          <span className="block truncate font-medium">{tenant.fullName}</span>
          <span className="block text-xs text-ink/50">
            {[tenant.property?.name, tenant.unit?.name].filter(Boolean).join(' \u00b7 ')}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-semibold">{peso(tenant.monthlyRent)}/mo</span>
        {note && <span className={`block text-xs ${noteTone}`}>{note}</span>}
      </span>
    </li>
  );
}

function TenantList({ children }) {
  return <ul className="divide-y divide-line rounded-xl border border-line">{children}</ul>;
}

const leaseNote = (t) =>
  t.contract?.endDate ? `Lease ends ${new Date(t.contract.endDate).toLocaleDateString()}` : 'No lease dates on file';

function ActiveBody({ tenants }) {
  const active = tenants.filter((t) => t.status === 'active');
  const others = tenants.filter((t) => t.status !== 'active');
  return (
    <>
      <p className="text-3xl font-bold tracking-tight">
        {active.length} <span className="text-lg font-normal text-ink/45">of {tenants.length} total</span>
      </p>
      <p className="mt-0.5 text-sm text-ink/50">tenants currently renting a unit</p>

      <SectionTitle>Active &middot; {active.length}</SectionTitle>
      {active.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-ink/50">
          No active tenants yet.
        </p>
      ) : (
        <TenantList>
          {active.map((t) => (
            <TenantRow key={t._id} tenant={t} note={leaseNote(t)} />
          ))}
        </TenantList>
      )}

      {others.length > 0 && (
        <>
          <SectionTitle>Moved out &middot; {others.length}</SectionTitle>
          <TenantList>
            {others.map((t) => (
              <TenantRow key={t._id} tenant={t} note={String(t.status || 'inactive').replace(/_/g, ' ')} />
            ))}
          </TenantList>
        </>
      )}
    </>
  );
}

function RentBody({ tenants }) {
  const active = tenants.filter((t) => t.status === 'active');
  const roll = active.reduce((sum, t) => sum + (t.monthlyRent || 0), 0);

  const propertyNames = [...new Set(active.map((t) => t.property?.name).filter(Boolean))];
  const byProperty = propertyNames
    .map((name) => {
      const list = active.filter((t) => t.property?.name === name);
      return { name, count: list.length, amount: list.reduce((s, t) => s + (t.monthlyRent || 0), 0) };
    })
    .sort((a, b) => b.amount - a.amount);

  const byTenant = [...active].sort((a, b) => (b.monthlyRent || 0) - (a.monthlyRent || 0));

  return (
    <>
      <p className="text-3xl font-bold tracking-tight">
        {peso(roll)}
        <span className="text-lg font-normal text-ink/45">/mo</span>
      </p>
      <p className="mt-0.5 text-sm text-ink/50">
        contracted rent from {plural(active.length, 'active lease')}
        {active.length > 0 && ` \u00b7 average ${peso(roll / active.length)}`}
      </p>

      {byProperty.length > 1 && (
        <>
          <SectionTitle>By property</SectionTitle>
          <div className="space-y-3.5">
            {byProperty.map((p) => (
              <BarRow
                key={p.name}
                dot="bg-primary"
                label={p.name}
                sub={plural(p.count, 'tenant')}
                amount={p.amount}
                pct={pctOf(p.amount, roll)}
              />
            ))}
          </div>
        </>
      )}

      <SectionTitle>By tenant</SectionTitle>
      {byTenant.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-ink/50">
          No active leases yet.
        </p>
      ) : (
        <div className="space-y-3.5">
          {byTenant.map((t) => (
            <BarRow
              key={t._id}
              dot="bg-primary"
              label={t.fullName}
              sub={t.unit?.name}
              amount={t.monthlyRent || 0}
              pct={pctOf(t.monthlyRent || 0, roll)}
            />
          ))}
        </div>
      )}
    </>
  );
}

// Loaded from GET /contracts/expiring-soon (everything ending within 90 days,
// plus active leases already past their end date). The modal only mounts while
// open, so every open fetches fresh data. `tenants` supplies the property name
// and keeps the list to currently active tenants, same as the card's count.
function ExpiringBody({ tenants }) {
  const [contracts, setContracts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    client
      .get('/contracts/expiring-soon', { params: { days: 90 } })
      .then(({ data }) => {
        if (!ignore) setContracts(data.contracts);
      })
      .catch(() => {
        if (!ignore) setError('Could not load expiring leases.');
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (error) return <p className="text-sm text-status-overdue">{error}</p>;
  if (!contracts) return <p className="text-sm text-ink/50">Loading leases&hellip;</p>;

  const tenantById = new Map(tenants.map((t) => [t._id, t]));
  const withEnd = contracts
    .map((c) => ({ contract: c, tenant: tenantById.get(c.tenant?._id) }))
    .filter(({ tenant }) => tenant && tenant.status === 'active')
    .map(({ contract, tenant }) => ({
      // Row shape TenantRow expects, built from the lease so its rent and unit are what the contract says.
      tenant: { _id: tenant._id, fullName: tenant.fullName, property: tenant.property, unit: contract.unit || tenant.unit, monthlyRent: contract.monthlyRent },
      days: daysUntil(contract.endDate),
    }))
    .sort((a, b) => a.days - b.days);

  const ended = withEnd.filter((x) => x.days < 0);
  const soon = withEnd.filter((x) => x.days >= 0 && x.days <= 30);
  const later = withEnd.filter((x) => x.days > 30 && x.days <= 90);

  const dayNote = (days) => (days === 0 ? 'ends today' : days === 1 ? 'ends tomorrow' : `ends in ${days} days`);

  return (
    <>
      <p className="text-3xl font-bold tracking-tight">
        {soon.length} <span className="text-lg font-normal text-ink/45">within 30 days</span>
      </p>
      <p className="mt-0.5 text-sm text-ink/50">To renew: turn on Manage mode, then click Renew Lease on the tenant.</p>

      {ended.length > 0 && (
        <>
          <SectionTitle>Past their end date &middot; {ended.length}</SectionTitle>
          <TenantList>
            {ended.map(({ tenant, days }) => (
              <TenantRow key={tenant._id} tenant={tenant} note={`ended ${Math.abs(days)} day(s) ago`} noteTone="text-status-overdue" />
            ))}
          </TenantList>
        </>
      )}

      <SectionTitle>Expiring within 30 days &middot; {soon.length}</SectionTitle>
      {soon.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-ink/50">
          No leases expire in the next 30 days.
        </p>
      ) : (
        <TenantList>
          {soon.map(({ tenant, days }) => (
            <TenantRow key={tenant._id} tenant={tenant} note={dayNote(days)} noteTone="text-status-pending" />
          ))}
        </TenantList>
      )}

      {later.length > 0 && (
        <>
          <SectionTitle>Next 31 to 90 days &middot; {later.length}</SectionTitle>
          <TenantList>
            {later.map(({ tenant, days }) => (
              <TenantRow key={tenant._id} tenant={tenant} note={`ends in ${days} days`} />
            ))}
          </TenantList>
        </>
      )}
    </>
  );
}

// kind: 'active' | 'rent' | 'expiring' (null = closed).
export default function TenantStatModals({ kind, tenants, onClose }) {
  return (
    <StatModal open={!!kind} title={kind ? TITLES[kind] : ''} onClose={onClose}>
      {kind === 'active' && <ActiveBody tenants={tenants} />}
      {kind === 'rent' && <RentBody tenants={tenants} />}
      {kind === 'expiring' && <ExpiringBody tenants={tenants} />}
    </StatModal>
  );
}
