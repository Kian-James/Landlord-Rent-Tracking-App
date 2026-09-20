import React, { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import client from '../api/client.js';
import BentoCard from '../components/BentoCard.jsx';
import { Skeleton, SkeletonText } from '../components/Skeleton.jsx';
import { BillIcon } from '../lib/billIcons.jsx';

function peso(amount) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(
    amount || 0
  );
}

function ordinalDay(day) {
  if (!day) return null;
  const suffix = ['th', 'st', 'nd', 'rd'][(day % 10 > 3 || Math.floor(day % 100 / 10) === 1) ? 0 : day % 10];
  return `${day}${suffix}`;
}

function cleanNumber(raw, { decimals = 0, max } = {}) {
  let next = String(raw ?? '').replace(decimals > 0 ? /[^0-9.]/g : /[^0-9]/g, '');
  if (decimals > 0) {
    const [whole, ...rest] = next.split('.');
    next = rest.length ? `${whole}.${rest.join('').slice(0, decimals)}` : whole;
  }
  next = next.replace(/^0+(?=\d)/, '');
  if (max !== undefined && next !== '' && Number(next) > max) next = String(max);
  return next;
}

function withCommas(raw) {
  const [whole, fraction] = String(raw).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

function NumberInput({ value, onChange, decimals = 0, min, max, commas = false, className, ...rest }) {
  const inputRef = useRef(null);
  const caretRef = useRef(null);
  const [, refresh] = useReducer((n) => n + 1, 0);
  const raw = String(value ?? '');
  const display = commas ? withCommas(raw) : raw;

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (caretRef.current === null || !input) return;
    let remaining = caretRef.current;
    caretRef.current = null;
    let position = 0;
    while (position < input.value.length && remaining > 0) {
      if (/[0-9.]/.test(input.value[position])) remaining -= 1;
      position += 1;
    }
    input.setSelectionRange(position, position);
  });

  const handleChange = (e) => {
    const typed = e.target.value;
    const caret = e.target.selectionStart ?? typed.length;
    caretRef.current = typed.slice(0, caret).replace(/[^0-9.]/g, '').length;
    onChange(cleanNumber(typed, { decimals, max }));
    refresh();
  };

  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={display}
      onChange={handleChange}
      onBlur={() => {
        if (min !== undefined && raw !== '' && Number(raw) < min) onChange(String(min));
      }}
      className={className}
    />
  );
}

const UTILITY_TYPES = [
  { key: 'electricity', label: 'Electricity' },
  { key: 'water', label: 'Water' },
  { key: 'wifi', label: 'Wifi' },
];

function emptyUnitForm() {
  return {
    name: '',
    monthlyRent: '',
    electricityAmount: '',
    electricityDueDay: '',
    waterAmount: '',
    waterDueDay: '',
    wifiAmount: '',
    wifiDueDay: '',
  };
}

function unitToFormState(unit) {
  return {
    name: unit.name || '',
    monthlyRent: unit.monthlyRent ?? '',
    electricityAmount: unit.utilities?.electricity?.amount || '',
    electricityDueDay: unit.utilities?.electricity?.dueDay || '',
    waterAmount: unit.utilities?.water?.amount || '',
    waterDueDay: unit.utilities?.water?.dueDay || '',
    wifiAmount: unit.utilities?.wifi?.amount || '',
    wifiDueDay: unit.utilities?.wifi?.dueDay || '',
  };
}

function utilitiesPayloadFrom(form) {
  return {
    electricity: {
      amount: form.electricityAmount ? Number(form.electricityAmount) : 0,
      dueDay: form.electricityDueDay ? Number(form.electricityDueDay) : null,
    },
    water: {
      amount: form.waterAmount ? Number(form.waterAmount) : 0,
      dueDay: form.waterDueDay ? Number(form.waterDueDay) : null,
    },
    wifi: {
      amount: form.wifiAmount ? Number(form.wifiAmount) : 0,
      dueDay: form.wifiDueDay ? Number(form.wifiDueDay) : null,
    },
  };
}

function hasInvalidUtilityDueDay(form) {
  return UTILITY_TYPES.some(({ key }) => {
    const value = form[`${key}DueDay`];
    if (value === '' || value === null || value === undefined) return false;
    const day = Number(value);
    return !Number.isInteger(day) || day < 1 || day > 31;
  });
}

const UTILITY_DAY_ERROR = 'Utility due days must be whole numbers from 1 to 31.';

function UnitFieldsEditor({ form, onChange }) {
  const set = (key) => (e) => onChange({ ...form, [key]: e.target.value });
  const setNumber = (key) => (value) => onChange({ ...form, [key]: value });
  return (
    <>
      <input
        required
        placeholder="Unit name (e.g. Unit 101)"
        value={form.name}
        onChange={set('name')}
        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
      />
      <div>
        <label className="text-[11px] text-ink/50">Monthly rent</label>
        <NumberInput
          required
          decimals={2}
          commas
          placeholder="0"
          value={form.monthlyRent}
          onChange={setNumber('monthlyRent')}
          className="mt-0.5 w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium text-ink/50">Utilities (optional) &mdash; amount and day of month each is due</p>
        {UTILITY_TYPES.map(({ key, label }) => (
          <div key={key} className="grid grid-cols-3 items-center gap-2">
            <span className="text-xs text-ink/60"><BillIcon type={key} className="mr-1" />{label}</span>
            <NumberInput
              decimals={2}
              commas
              placeholder="Amount"
              value={form[`${key}Amount`]}
              onChange={setNumber(`${key}Amount`)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
            <NumberInput
              min={1}
              max={31}
              placeholder="Due day (1-31)"
              value={form[`${key}DueDay`]}
              onChange={setNumber(`${key}DueDay`)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>

      <p className="text-[11px] text-ink/40">
        Utility amounts and due days are for your own reference — they're shown alongside rent and on the calendar,
        but they aren't billed or tracked as rent obligations.
      </p>
    </>
  );
}

export default function Properties() {
  const [properties, setProperties] = useState([]);
  const [unitsByProperty, setUnitsByProperty] = useState({});
  const [loading, setLoading] = useState(true);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [propertyForm, setPropertyForm] = useState({ name: '', address: '', description: '' });
  const [editingPropertyId, setEditingPropertyId] = useState(null);
  const [editPropertyForm, setEditPropertyForm] = useState({ name: '', address: '', description: '' });
  const [unitFormFor, setUnitFormFor] = useState(null);
  const [unitForm, setUnitForm] = useState(emptyUnitForm());
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [editUnitForm, setEditUnitForm] = useState(emptyUnitForm());
  const [editUnitStatus, setEditUnitStatus] = useState('vacant');
  const [error, setError] = useState('');

  const loadProperties = async () => {
    const { data } = await client.get('/properties');
    setProperties(data.properties);
  };

  const loadUnits = async (propertyId) => {
    const { data } = await client.get('/units', { params: { propertyId } });
    setUnitsByProperty((prev) => ({ ...prev, [propertyId]: data.units }));
  };

  useEffect(() => {
    loadProperties().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    properties.forEach((p) => loadUnits(p._id));
  }, [properties.length]);

  const handleCreateProperty = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await client.post('/properties', propertyForm);
      setPropertyForm({ name: '', address: '', description: '' });
      setShowPropertyForm(false);
      await loadProperties();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not add property.');
    }
  };

  const startEditProperty = (property) => {
    setEditingPropertyId(property._id);
    setEditPropertyForm({
      name: property.name || '',
      address: property.address || '',
      description: property.description || '',
    });
  };

  const cancelEditProperty = () => {
    setEditingPropertyId(null);
  };

  const handleUpdateProperty = async (e, propertyId) => {
    e.preventDefault();
    setError('');
    try {
      await client.patch(`/properties/${propertyId}`, editPropertyForm);
      setEditingPropertyId(null);
      await loadProperties();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not update property.');
    }
  };

  const handleDeleteProperty = async (property) => {
    const confirmed = confirm(
      `Delete "${property.name}"? This can't be undone. Properties with occupied units can't be deleted — move those tenants out first.`
    );
    if (!confirmed) return;
    setError('');
    try {
      await client.delete(`/properties/${property._id}`);
      setEditingPropertyId(null);
      await loadProperties();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not delete this property.');
    }
  };

  const handleCreateUnit = async (e, propertyId) => {
    e.preventDefault();
    setError('');
    if (hasInvalidUtilityDueDay(unitForm)) {
      setError(UTILITY_DAY_ERROR);
      return;
    }
    try {
      await client.post('/units', {
        propertyId,
        name: unitForm.name,
        monthlyRent: Number(unitForm.monthlyRent),
        utilities: utilitiesPayloadFrom(unitForm),
      });
      setUnitForm(emptyUnitForm());
      setUnitFormFor(null);
      await loadUnits(propertyId);
      await loadProperties();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not add unit.');
    }
  };

  const startEditUnit = (unit) => {
    setEditingUnitId(unit._id);
    setEditUnitForm(unitToFormState(unit));
    setEditUnitStatus(unit.status);
  };

  const cancelEditUnit = () => {
    setEditingUnitId(null);
  };

  const handleUpdateUnit = async (e, unit) => {
    e.preventDefault();
    setError('');
    if (hasInvalidUtilityDueDay(editUnitForm)) {
      setError(UTILITY_DAY_ERROR);
      return;
    }
    try {
      const payload = {
        name: editUnitForm.name,
        monthlyRent: Number(editUnitForm.monthlyRent),
        utilities: utilitiesPayloadFrom(editUnitForm),
      };
      if (unit.status !== 'occupied') payload.status = editUnitStatus;

      await client.patch(`/units/${unit._id}`, payload);
      setEditingUnitId(null);
      await loadUnits(unit.property);
      await loadProperties();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not update unit.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Properties &amp; Units</h1>
        </div>
        <button
          onClick={() => setShowPropertyForm((s) => !s)}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/90"
        >
          + Add Property
        </button>
      </div>

      {error && <p className="text-sm text-status-overdue">{error}</p>}

      {showPropertyForm && (
        <BentoCard>
          <form onSubmit={handleCreateProperty} className="grid gap-3 md:grid-cols-3">
            <input
              required
              placeholder="Property name"
              value={propertyForm.name}
              onChange={(e) => setPropertyForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-lg border border-line px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Address"
              value={propertyForm.address}
              onChange={(e) => setPropertyForm((f) => ({ ...f, address: e.target.value }))}
              className="rounded-lg border border-line px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <input
                placeholder="Description (optional)"
                value={propertyForm.description}
                onChange={(e) => setPropertyForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
              <button type="submit" className="shrink-0 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-white">
                Save
              </button>
            </div>
          </form>
        </BentoCard>
      )}

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <BentoCard key={i}>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <SkeletonText width="w-40" />
                  <SkeletonText width="w-56" className="h-3" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </BentoCard>
          ))}
        </div>
      ) : (
        <>
          {properties.length === 0 && !showPropertyForm && (
            <BentoCard className="text-center">
              <p className="font-medium">No properties yet</p>
              <p className="mt-1 text-sm text-ink/50">Add your first property to start tracking rent.</p>
            </BentoCard>
          )}

          <div className="space-y-4">
            {properties.map((property) => (
          <BentoCard key={property._id}>
            {editingPropertyId === property._id ? (
              <form onSubmit={(e) => handleUpdateProperty(e, property._id)} className="space-y-2">
                <div>
                  <label className="text-[11px] text-ink/50">Property name</label>
                  <input
                    required
                    value={editPropertyForm.name}
                    onChange={(e) => setEditPropertyForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-line px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-ink/50">Address</label>
                  <input
                    required
                    value={editPropertyForm.address}
                    onChange={(e) => setEditPropertyForm((f) => ({ ...f, address: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-line px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-ink/50">Description (optional)</label>
                  <textarea
                    rows={2}
                    value={editPropertyForm.description}
                    onChange={(e) => setEditPropertyForm((f) => ({ ...f, description: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-line px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <button type="submit" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditProperty}
                      className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink/60"
                    >
                      Cancel
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteProperty(property)}
                    className="rounded-lg border border-status-overdue/30 px-4 py-2 text-sm font-medium text-status-overdue hover:bg-status-overdueSoft"
                  >
                    Delete Property
                  </button>
                </div>
                {property.occupiedCount > 0 && (
                  <p className="text-[11px] text-ink/40">
                    This property has {property.occupiedCount} occupied unit{property.occupiedCount === 1 ? '' : 's'} —
                    move those tenants out before it can be deleted.
                  </p>
                )}
              </form>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-semibold">{property.name}</p>
                  <p className="text-sm text-ink/50">{property.address}</p>
                  {property.description && <p className="mt-1 text-sm text-ink/60">{property.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="text-xs text-ink/50">
                    {property.occupiedCount}/{property.unitCount} occupied
                  </p>
                  <button
                    onClick={() => startEditProperty(property)}
                    className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink/60 hover:bg-canvas"
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(unitsByProperty[property._id] || []).map((unit) =>
                editingUnitId === unit._id ? (
                  <form
                    key={unit._id}
                    onSubmit={(e) => handleUpdateUnit(e, unit)}
                    className="col-span-full space-y-2 rounded-lg border border-line p-3 sm:col-span-2 lg:col-span-3"
                  >
                    <UnitFieldsEditor form={editUnitForm} onChange={setEditUnitForm} />
                    {unit.status === 'occupied' ? (
                      <p className="text-[11px] text-ink/40">
                        This unit is currently occupied by {unit.currentTenant?.fullName || 'a tenant'}. Move them out
                        from the Tenants page to change its status.
                      </p>
                    ) : (
                      <div>
                        <label className="text-[11px] text-ink/50">Status</label>
                        <select
                          value={editUnitStatus}
                          onChange={(e) => setEditUnitStatus(e.target.value)}
                          className="mt-0.5 w-full rounded-lg border border-line px-3 py-2 text-sm"
                        >
                          <option value="vacant">Vacant</option>
                          <option value="reserved">Reserved</option>
                          <option value="maintenance">Maintenance</option>
                        </select>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button type="submit" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditUnit}
                        className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink/60"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div key={unit._id} className="rounded-lg border border-line p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{unit.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          unit.status === 'occupied'
                            ? 'bg-status-paidSoft text-status-paid'
                            : unit.status === 'maintenance'
                            ? 'bg-status-pendingSoft text-status-pending'
                            : 'bg-line text-ink/60'
                        }`}
                      >
                        {unit.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink/50">{peso(unit.monthlyRent)}/mo rent</p>
                    {(unit.utilities?.electricity?.amount > 0 || unit.utilities?.electricity?.dueDay ||
                      unit.utilities?.water?.amount > 0 || unit.utilities?.water?.dueDay ||
                      unit.utilities?.wifi?.amount > 0 || unit.utilities?.wifi?.dueDay) && (
                      <div className="mt-1.5 space-y-0.5 text-[11px] text-ink/45">
                        {(unit.utilities.electricity?.amount > 0 || unit.utilities.electricity?.dueDay) && (
                          <p>
                            <BillIcon type="electricity" className="mr-1" />
                            {unit.utilities.electricity.amount > 0 ? peso(unit.utilities.electricity.amount) : 'Amount not set'}
                            {unit.utilities.electricity.dueDay && ` · due ${ordinalDay(unit.utilities.electricity.dueDay)}`}
                          </p>
                        )}
                        {(unit.utilities.water?.amount > 0 || unit.utilities.water?.dueDay) && (
                          <p>
                            <BillIcon type="water" className="mr-1" />
                            {unit.utilities.water.amount > 0 ? peso(unit.utilities.water.amount) : 'Amount not set'}
                            {unit.utilities.water.dueDay && ` · due ${ordinalDay(unit.utilities.water.dueDay)}`}
                          </p>
                        )}
                        {(unit.utilities.wifi?.amount > 0 || unit.utilities.wifi?.dueDay) && (
                          <p>
                            <BillIcon type="wifi" className="mr-1" />
                            {unit.utilities.wifi.amount > 0 ? peso(unit.utilities.wifi.amount) : 'Amount not set'}
                            {unit.utilities.wifi.dueDay && ` · due ${ordinalDay(unit.utilities.wifi.dueDay)}`}
                          </p>
                        )}
                      </div>
                    )}
                    {unit.currentTenant && <p className="mt-1 text-xs text-ink/60">{unit.currentTenant.fullName}</p>}
                    <button
                      onClick={() => startEditUnit(unit)}
                      className="mt-2 text-xs font-medium text-ink/50 hover:text-ink"
                    >
                      Edit unit
                    </button>
                  </div>
                )
              )}
            </div>

            {unitFormFor === property._id ? (
              <form onSubmit={(e) => handleCreateUnit(e, property._id)} className="mt-3 space-y-2 rounded-lg border border-line p-3">
                <UnitFieldsEditor form={unitForm} onChange={setUnitForm} />
                <div className="flex gap-2">
                  <button type="submit" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">
                    Add Unit
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitFormFor(null)}
                    className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink/60"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setUnitFormFor(property._id)}
                className="mt-3 text-sm font-medium text-brand"
              >
                + Add unit
              </button>
            )}
          </BentoCard>
        ))}
          </div>
        </>
      )}
    </div>
  );
}