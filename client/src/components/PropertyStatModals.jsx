import React from 'react';
import StatModal from './StatModal.jsx';
import { BarRow, SectionTitle } from './breakdownParts.jsx';
import { BILL_TYPE_META, BillIcon } from '../lib/billIcons.jsx';
import { peso, pctOf, plural } from '../lib/breakdown.js';

const TITLES = { gross: 'Total potential gross', occupancy: 'Realized occupancy', baselines: 'Utility baselines' };
const UTILITIES = ['electricity', 'water', 'wifi'];

// Flatten to one row per unit with its property name attached.
function flattenUnits(properties, unitsByProperty) {
  return properties.flatMap((pr) =>
    (unitsByProperty[pr._id] || []).map((u) => ({ ...u, propertyName: pr.name, propertyId: pr._id }))
  );
}

const rentOf = (u) => u.monthlyRent || 0;
const sumRent = (list) => list.reduce((s, u) => s + rentOf(u), 0);
const hasBaseline = (u) => Object.values(u.utilities || {}).some((v) => v?.amount);

function UnitList({ children }) {
  return <ul className="divide-y divide-line rounded-xl border border-line">{children}</ul>;
}
function Empty({ children }) {
  return <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-ink/50">{children}</p>;
}

function GrossBody({ properties, units }) {
  const gross = sumRent(units);
  const earning = sumRent(units.filter((u) => u.status === 'occupied'));
  const idle = gross - earning;
  const byProperty = properties
    .map((pr) => {
      const list = units.filter((u) => u.propertyId === pr._id);
      return { name: pr.name, count: list.length, amount: sumRent(list) };
    })
    .sort((a, b) => b.amount - a.amount);

  return (
    <>
      <p className="text-3xl font-bold tracking-tight">
        {peso(gross)}
        <span className="text-lg font-normal text-ink/45">/mo</span>
      </p>
      <p className="mt-0.5 text-sm text-ink/50">
        if every unit were rented &middot; {properties.length} {properties.length === 1 ? 'property' : 'properties'},{' '}
        {plural(units.length, 'unit')}
      </p>

      <SectionTitle>Earning vs. idle</SectionTitle>
      <div className="space-y-3.5">
        <BarRow dot="bg-status-paid" label="Earning now" sub="occupied units" amount={earning} pct={pctOf(earning, gross)} />
        <BarRow
          dot="bg-status-pending"
          label="Not earning"
          sub="vacant or under maintenance"
          amount={idle}
          pct={pctOf(idle, gross)}
        />
      </div>

      <SectionTitle>By property</SectionTitle>
      <div className="space-y-3.5">
        {byProperty.map((p) => (
          <BarRow key={p.name} dot="bg-primary" label={p.name} sub={plural(p.count, 'unit')} amount={p.amount} pct={pctOf(p.amount, gross)} />
        ))}
      </div>

      <SectionTitle>Highest rents</SectionTitle>
      <UnitList>
        {[...units]
          .sort((a, b) => rentOf(b) - rentOf(a))
          .slice(0, 5)
          .map((u) => (
            <li key={u._id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{u.name}</span>
                <span className="block text-xs text-ink/50">{u.propertyName}</span>
              </span>
              <span className="shrink-0 font-semibold">{peso(rentOf(u))}/mo</span>
            </li>
          ))}
      </UnitList>
    </>
  );
}

function OccupancyBody({ properties, units }) {
  const occupied = units.filter((u) => u.status === 'occupied');
  const vacant = units.filter((u) => u.status === 'vacant');
  const maintenance = units.filter((u) => u.status === 'maintenance');
  const pct = pctOf(occupied.length, units.length);

  const unitRow = (u, note) => (
    <li key={u._id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="block truncate font-medium">{u.name}</span>
        <span className="block text-xs text-ink/50">{u.propertyName}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-semibold">{peso(rentOf(u))}/mo</span>
        {note && <span className="block text-xs text-ink/50">{note}</span>}
      </span>
    </li>
  );

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tracking-tight">
            {occupied.length} / {units.length} <span className="text-lg font-normal text-ink/45">units occupied</span>
          </p>
          <p className="mt-0.5 text-sm text-ink/50">
            {vacant.length} vacant &middot; {maintenance.length} under maintenance
          </p>
        </div>
        <span className="rounded-full bg-status-paidSoft px-3 py-1 text-sm font-semibold text-status-paid">{pct}%</span>
      </div>

      <SectionTitle>By property</SectionTitle>
      <div className="space-y-3.5">
        {properties.map((pr) => {
          const list = units.filter((u) => u.propertyId === pr._id);
          const occ = list.filter((u) => u.status === 'occupied').length;
          return (
            <div key={pr._id}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{pr.name}</span>
                <span className="shrink-0 text-xs text-ink/50">
                  {occ} / {list.length} occupied &middot; {pctOf(occ, list.length)}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-status-paid" style={{ width: `${pctOf(occ, list.length)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <SectionTitle>Available to rent &middot; {vacant.length}</SectionTitle>
      {vacant.length === 0 ? <Empty>No vacant units. Everything rentable is occupied.</Empty> : <UnitList>{vacant.map((u) => unitRow(u, 'vacant'))}</UnitList>}

      {maintenance.length > 0 && (
        <>
          <SectionTitle>Under maintenance &middot; {maintenance.length}</SectionTitle>
          <UnitList>{maintenance.map((u) => unitRow(u, 'not rentable yet'))}</UnitList>
        </>
      )}
    </>
  );
}

function BaselinesBody({ units }) {
  const covered = units.filter(hasBaseline);
  const missing = units.filter((u) => !hasBaseline(u));

  const unitRow = (u) => (
    <li key={u._id} className="px-3 py-2.5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-medium">{u.name}</span>
        <span className="shrink-0 text-xs text-ink/50">{u.propertyName}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {UTILITIES.map((type) => {
          const cfg = u.utilities?.[type];
          const on = !!cfg?.amount;
          return (
            <span
              key={type}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                on ? 'bg-canvas text-ink/80' : 'bg-canvas/60 text-ink/30'
              }`}
            >
              <BillIcon type={type} className="text-[10px]" />
              {BILL_TYPE_META[type].label}
              {on ? ` ${peso(cfg.amount)}${cfg.dueDay ? ` \u00b7 day ${cfg.dueDay}` : ''}` : ' \u00b7 not set'}
            </span>
          );
        })}
      </div>
    </li>
  );

  return (
    <>
      <p className="text-3xl font-bold tracking-tight">
        {covered.length} / {units.length} <span className="text-lg font-normal text-ink/45">units covered</span>
      </p>
      <p className="mt-0.5 text-sm text-ink/50">
        A unit is covered once at least one of electricity, water or wifi has an amount set. Units without one get no
        utility bills generated.
      </p>

      <SectionTitle>Not configured &middot; {missing.length}</SectionTitle>
      {missing.length === 0 ? <Empty>Every unit has a utility baseline.</Empty> : <UnitList>{missing.map(unitRow)}</UnitList>}

      <SectionTitle>Configured &middot; {covered.length}</SectionTitle>
      {covered.length === 0 ? <Empty>No unit has a utility baseline yet.</Empty> : <UnitList>{covered.map(unitRow)}</UnitList>}
    </>
  );
}

// kind: 'gross' | 'occupancy' | 'baselines' (null = closed).
export default function PropertyStatModals({ kind, properties, unitsByProperty, onClose }) {
  const units = flattenUnits(properties, unitsByProperty);
  return (
    <StatModal open={!!kind} title={kind ? TITLES[kind] : ''} onClose={onClose}>
      {kind === 'gross' && <GrossBody properties={properties} units={units} />}
      {kind === 'occupancy' && <OccupancyBody properties={properties} units={units} />}
      {kind === 'baselines' && <BaselinesBody units={units} />}
    </StatModal>
  );
}
