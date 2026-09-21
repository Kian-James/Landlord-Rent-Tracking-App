import 'dotenv/config';
import http from 'http';

process.env.NODE_ENV = 'test';
process.env.CLIENT_URL = 'http://localhost:5173';
for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[key]) {
    console.error(`[smoke-test] ${key} is not set (see .env.example).`);
    process.exit(1);
  }
}
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'smoke-test-project';

const RUN_ID = Date.now();
const UID_A = `smoke-${RUN_ID}-a`;
const UID_B = `smoke-${RUN_ID}-b`;

const tokenFor = (uid, email, name) => `test:${uid}|${email}|${name}`;

function req(app) {
  return (method, url, { body, token } = {}) =>
    new Promise((resolve, reject) => {
      const server = http.createServer(app);
      server.listen(0, () => {
        const { port } = server.address();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const payload = body ? JSON.stringify(body) : null;
        if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

        const request = http.request(
          { hostname: '127.0.0.1', port, path: url, method, headers },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              server.close();
              let json = null;
              try {
                json = data ? JSON.parse(data) : null;
              } catch {
                json = data;
              }
              resolve({ status: res.statusCode, body: json, headers: res.headers });
            });
          }
        );
        request.on('error', (err) => {
          server.close();
          reject(err);
        });
        if (payload) request.write(payload);
        request.end();
      });
    });
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ok - ${message}`);
}

async function main() {
  const { firebaseAuth } = await import('../src/config/firebase.js');
  firebaseAuth().verifyIdToken = async (token) => {
    if (!token.startsWith('test:')) throw new Error('bad token');
    const [uid, email, name] = token.slice(5).split('|');
    return { uid, email, name };
  };

  const { supabase } = await import('../src/config/supabase.js');

  const { createApp } = await import('../src/app.js');
  const app = createApp();
  const call = req(app);

  try {
    await run(call);
  } finally {
    await supabase.from('landlords').delete().in('id', [UID_A, UID_B]);
  }
  console.log('\n[smoke-test] ALL CHECKS PASSED ✔');
}

async function run(call) {
  console.log('\n[1] First authenticated call creates the landlord row');
  const token = tokenFor(UID_A, 'juan@example.com', 'Juan Santos');
  let res = await call('GET', '/api/auth/user', { token });
  assert(res.status === 200, `me returns 200 (got ${res.status}: ${JSON.stringify(res.body)})`);
  assert(res.body.landlord.email === 'juan@example.com' && res.body.landlord._id === UID_A, 'landlord row auto-created from the Firebase token');
  assert(res.body.landlord.name === 'Juan Santos', 'name comes from the token');

  res = await call('GET', '/api/auth/user', {});
  assert(res.status === 401, 'no token -> 401');
  res = await call('GET', '/api/auth/user', { token: 'garbage' });
  assert(res.status === 401, 'invalid token -> 401');

  console.log('\n[2] Create property + unit');
  res = await call('POST', '/api/properties', {
    token,
    body: { name: 'Sunrise Apartment', address: 'Quezon City, Philippines' },
  });
  assert(res.status === 201, `create property (got ${res.status}: ${JSON.stringify(res.body)})`);
  const propertyId = res.body.property._id;

  res = await call('PATCH', `/api/properties/${propertyId}`, {
    token,
    body: { name: 'Sunrise Apartment (Renamed)', address: 'Manila, Philippines', description: 'Corner lot, 3 floors' },
  });
  assert(res.status === 200, `edit property (got ${res.status}: ${JSON.stringify(res.body)})`);
  assert(
    res.body.property.name === 'Sunrise Apartment (Renamed)' &&
      res.body.property.address === 'Manila, Philippines' &&
      res.body.property.description === 'Corner lot, 3 floors',
    'property name/address/description are all editable after creation'
  );

  res = await call('PATCH', `/api/properties/${propertyId}`, { token, body: { name: '' } });
  assert(res.status === 400, `blanking out the property name is rejected (got ${res.status})`);

  res = await call('POST', '/api/units', {
    token,
    body: {
      propertyId,
      name: 'Unit 101',
      monthlyRent: 9500,
      utilities: {
        electricity: { amount: 1200, dueDay: 25 },
        water: { amount: 350, dueDay: 10 },
        wifi: { amount: 1500, dueDay: 7 },
      },
    },
  });
  assert(res.status === 201, `create unit (got ${res.status}: ${JSON.stringify(res.body)})`);
  const unitId = res.body.unit._id;
  assert(res.body.unit.status === 'vacant', 'new unit defaults to vacant');
  assert(
    res.body.unit.utilities.electricity.amount === 1200 &&
      res.body.unit.utilities.electricity.dueDay === 25 &&
      res.body.unit.utilities.water.dueDay === 10 &&
      res.body.unit.utilities.wifi.dueDay === 7,
    'unit stores electricity/water/wifi amounts AND due days alongside rent'
  );

  res = await call('PATCH', `/api/units/${unitId}`, {
    token,
    body: {
      name: 'Unit 101-A',
      monthlyRent: 10000,
      status: 'maintenance',
      utilities: { electricity: { amount: 1350, dueDay: 26 } },
    },
  });
  assert(res.status === 200, `edit unit (got ${res.status}: ${JSON.stringify(res.body)})`);
  assert(
    res.body.unit.name === 'Unit 101-A' &&
      res.body.unit.monthlyRent === 10000 &&
      res.body.unit.status === 'maintenance' &&
      res.body.unit.utilities.electricity.amount === 1350 &&
      res.body.unit.utilities.electricity.dueDay === 26 &&
      res.body.unit.utilities.water.dueDay === 10,
    'unit name/rent/status/utilities are all editable, and untouched utility fields are preserved on partial updates'
  );

  res = await call('PATCH', `/api/units/${unitId}`, { token, body: { status: 'vacant' } });
  assert(res.status === 200 && res.body.unit.status === 'vacant', 'unit restored to vacant for the move-in flow below');

  console.log('\n[3] Move in tenant (creates tenant + contract, occupies unit)');
  res = await call('POST', '/api/tenants', {
    token,
    body: {
      unitId,
      fullName: 'Maria Santos',
      email: 'maria@example.com',
      monthlyRent: 9500,
      rentDueDay: 5,
      leaseStartDate: '2026-01-01',
      leaseEndDate: '2026-12-31',
      contractDurationMonths: 12,
    },
  });
  assert(res.status === 201, `move-in tenant (got ${res.status}: ${JSON.stringify(res.body)})`);
  const tenantId = res.body.tenant._id;
  assert(res.body.contract.status === 'active', 'first contract created as active');

  res = await call('GET', '/api/units', { token });
  const unit = res.body.units.find((u) => u._id === unitId);
  assert(unit.status === 'occupied', 'unit flips to occupied on move-in');

  console.log('\n[4] Generate this month\'s rent + verify no duplicates on re-run');
  res = await call('POST', '/api/rent-records/generate', { token, body: {} });
  assert(res.status === 200 && res.body.created === 1, `first generation creates 1 record (got ${JSON.stringify(res.body)})`);
  res = await call('POST', '/api/rent-records/generate', { token, body: {} });
  assert(res.body.created === 0, 'second generation creates 0 (idempotent, no duplicates)');

  res = await call('GET', '/api/rent-records', { token });
  assert(res.body.records.length === 1, 'checklist shows exactly one rent record');
  const rentRecordId = res.body.records[0]._id;

  console.log('\n[5] Generate utility bills from unit due days + verify no duplicates, then mark one paid');
  res = await call('POST', '/api/utility-bills/generate', { token, body: {} });
  assert(
    res.status === 200 && res.body.created === 3,
    `first utility bill generation creates 3 records - electricity/water/wifi (got ${JSON.stringify(res.body)})`
  );
  res = await call('POST', '/api/utility-bills/generate', { token, body: {} });
  assert(res.body.created === 0, 'second utility bill generation creates 0 (idempotent, no duplicates)');

  res = await call('GET', '/api/utility-bills', { token });
  assert(res.body.records.length === 3, 'utility bill checklist shows exactly 3 records for this unit');
  const electricityBill = res.body.records.find((r) => r.type === 'electricity');
  assert(electricityBill.amountDue === 1350 && electricityBill.status !== 'paid', 'electricity bill carries the unit amount and starts unpaid');

  res = await call('POST', `/api/utility-bills/${electricityBill._id}/mark-paid`, { token, body: {} });
  assert(res.status === 200 && res.body.record.status === 'paid', 'utility bill can be marked paid directly ');

  res = await call('POST', `/api/utility-bills/${electricityBill._id}/mark-paid`, { token, body: {} });
  assert(res.status === 409, 'marking an already-paid utility bill again is rejected');

  console.log('\n[6] Dashboard reflects outstanding rent, no payments yet');
  res = await call('GET', '/api/dashboard', { token });
  assert(res.body.totals.expectedRent === 9500, 'dashboard expected rent matches unit rent');
  assert(res.body.totals.paid === 0, 'nothing paid yet');

  console.log('\n[7] Mark rent paid directly -> dashboard reflects it');
  res = await call('POST', `/api/rent-records/${rentRecordId}/mark-paid`, { token, body: {} });
  assert(res.status === 200 && res.body.record.status === 'paid', 'rent record is marked paid by the landlord');

  res = await call('GET', '/api/dashboard', { token });
  assert(res.body.totals.paid === 1, 'dashboard now shows 1 paid');
  assert(res.body.totals.collected === 9500, 'dashboard collected amount updated');

  console.log('\n[8] Mark-unpaid reverts a mistaken mark-paid, for both rent and utility bills');
  res = await call('POST', `/api/rent-records/${rentRecordId}/mark-unpaid`, { token, body: {} });
  assert(res.status === 200, `revert rent to unpaid succeeds (got ${res.status}: ${JSON.stringify(res.body)})`);
  assert(res.body.record.status !== 'paid', 'rent record is no longer paid after reverting');

  res = await call('POST', `/api/rent-records/${rentRecordId}/mark-unpaid`, { token, body: {} });
  assert(res.status === 409, 'reverting an already-unpaid rent record is rejected');

  res = await call('POST', `/api/rent-records/${rentRecordId}/mark-paid`, { token, body: {} });
  assert(res.status === 200 && res.body.record.status === 'paid', 're-marking paid after a revert works normally');

  res = await call('POST', `/api/utility-bills/${electricityBill._id}/mark-unpaid`, { token, body: {} });
  assert(res.status === 200, `revert utility bill to unpaid succeeds (got ${res.status}: ${JSON.stringify(res.body)})`);
  assert(res.body.record.status !== 'paid', 'utility bill is no longer paid after reverting');
  assert(res.body.record.paidAmount === null, 'paidAmount is cleared on revert');

  res = await call('POST', `/api/utility-bills/${electricityBill._id}/mark-unpaid`, { token, body: {} });
  assert(res.status === 409, 'reverting an already-unpaid utility bill is rejected');

  console.log('\n[9] Ownership isolation: a second landlord cannot see the first\'s data');
  const intruderToken = tokenFor(UID_B, 'intruder@example.com', 'Intruder');
  res = await call('GET', `/api/tenants/${tenantId}`, { token: intruderToken });
  assert(res.status === 404, `cross-tenant access returns 404, not the record (got ${res.status})`);

  console.log('\n[10] Contract renewal preserves history');
  res = await call('GET', '/api/contracts', { token, body: undefined });
  const activeContract = res.body.contracts.find((c) => c.tenant._id === tenantId);
  res = await call('POST', `/api/contracts/${activeContract._id}/renew`, {
    token,
    body: { startDate: '2027-01-01', endDate: '2027-12-31', durationMonths: 12, monthlyRent: 10000 },
  });
  assert(res.status === 201, `renewal succeeds (got ${res.status}: ${JSON.stringify(res.body)})`);
  assert(res.body.previousContract.status === 'superseded', 'old contract preserved as superseded, not deleted');

  console.log('\n[11] Property deletion is blocked while it has an occupied unit');
  res = await call('DELETE', `/api/properties/${propertyId}`, { token });
  assert(res.status === 409, `delete blocked while occupied (got ${res.status}: ${JSON.stringify(res.body)})`);

  console.log('\n[12] Move-out preserves tenant + history, frees the unit');
  res = await call('POST', `/api/tenants/${tenantId}/move-out`, { token, body: {} });
  assert(res.status === 200 && res.body.tenant.status === 'vacated', 'tenant marked vacated, not deleted');
  assert(res.body.unit.status === 'vacant', 'unit freed on move-out');

  console.log('\n[13] Property deletion succeeds once no units are occupied');
  res = await call('DELETE', `/api/properties/${propertyId}`, { token });
  assert(res.status === 204, `delete succeeds after move-out (got ${res.status}: ${JSON.stringify(res.body)})`);

  res = await call('GET', '/api/properties', { token });
  assert(
    !res.body.properties.some((p) => p._id === propertyId),
    'deleted property no longer appears in the property list'
  );
}

main().catch((err) => {
  console.error('\n[smoke-test] FAILED:', err);
  process.exit(1);
});
