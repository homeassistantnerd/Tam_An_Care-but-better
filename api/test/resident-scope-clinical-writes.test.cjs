'use strict';
// Clinical write endpoints must check per-resident access for the verified
// actor before the domain service runs, and fail closed. In-memory mocks only.
const test = require('node:test');
const assert = require('node:assert/strict');

const load = (path, name) => require(`../dist/${path}`)[name];
const { ResidentAccessScopeService } = require('../dist/resident-access-scope/resident-access-scope.service.js');

const ACTOR = { id: 'TA-NUR-01', role: 'NURSE' };
const execute = (domain, cls) =>
  [`${domain} execute`, `${domain}/${domain}.controller.js`, cls, 'execute', ['RES-1']];
// [label, module, class, method, args before (body, actorId, actorRole)]
const cases = [
  execute('fall-mobility', 'FallMobilityController'),
  execute('sleep-rest', 'SleepRestController'),
  execute('infection-control', 'InfectionControlController'),
  execute('medication-safety', 'MedicationSafetyController'),
  execute('pain-comfort', 'PainComfortController'),
  execute('safeguarding', 'SafeguardingController'),
  execute('personal-care', 'PersonalCareController'),
  execute('skin-wound', 'SkinWoundController'),
  execute('activity-rehabilitation', 'ActivityRehabilitationController'),
  execute('nutrition-hydration', 'NutritionHydrationController'),
  execute('behavioral-cognitive', 'BehavioralCognitiveController'),
  ...['assign', 'transfer', 'startReview', 'resolve', 'reopen'].map(m =>
    [`care action ${m}`, 'care-actions/care-action.controller.js', 'CareActionController', m, ['RES-1', 'PAT-1']]),
];
const PSYCH = 'behavioral-cognitive/behavioral-cognitive.controller.js';

function stubs(allow) {
  const calls = [];
  const scopeCalls = [];
  const service = new Proxy({}, {
    get: (_t, name) => async (...args) => { calls.push({ name, args }); return {}; },
  });
  const scope = {
    assertClinicalWriteAccess: async (...args) => {
      scopeCalls.push(args);
      if (!allow) {
        const { ForbiddenException } = require('@nestjs/common');
        throw new ForbiddenException('Resident access denied');
      }
    },
  };
  return { service, scope, calls, scopeCalls };
}

const invoke = (controller, method, prefix, actorId, actorRole) =>
  method === 'createPsychologicalAssessment'
    ? controller[method](actorId, actorRole, 'RES-1', { note: 'x' })
    : controller[method](...prefix, { note: 'x' }, actorId, actorRole);

const all = [...cases, ['psychological assessment create', PSYCH, 'BehavioralCognitiveController', 'createPsychologicalAssessment', []]];

for (const [label, path, cls, method, prefix] of all) {
  test(`RESIDENT-SCOPE: ${label} denies with 403 before the service runs`, async () => {
    const { service, scope, calls, scopeCalls } = stubs(false);
    const controller = new (load(path, cls))(service, scope);
    await assert.rejects(
      async () => invoke(controller, method, prefix, ACTOR.id, ACTOR.role),
      e => e.getStatus?.() === 403,
    );
    assert.equal(calls.length, 0);
    assert.deepEqual(scopeCalls, [[ACTOR.id, ACTOR.role, 'RES-1']]);
  });

  test(`RESIDENT-SCOPE: ${label} reaches the service when access is granted`, async () => {
    const { service, scope, calls } = stubs(true);
    const controller = new (load(path, cls))(service, scope);
    await invoke(controller, method, prefix, ACTOR.id, ACTOR.role);
    assert.ok(calls.length > 0, 'service was not called');
  });
}

test('RESIDENT-SCOPE: psychological assessment create rejects missing verified headers', async () => {
  const { service, scope, calls, scopeCalls } = stubs(true);
  const controller = new (load(PSYCH, 'BehavioralCognitiveController'))(service, scope);
  await assert.rejects(
    async () => invoke(controller, 'createPsychologicalAssessment', [], undefined, undefined),
    e => e.getStatus?.() === 401,
  );
  assert.equal(calls.length + scopeCalls.length, 0);
});

// assertClinicalWriteAccess role policy against a stubbed DB.
function scopeService({ staffRole, assigned = false, residentActive = true }) {
  const queries = [];
  const db = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      const supervisory = !sql.includes('resident_access_assignments');
      return { rowCount: residentActive && (supervisory || assigned) ? 1 : 0, rows: [] };
    },
  };
  const staffActors = {
    resolveActiveActorWithRole: async (_id, role) => (staffRole === role ? { primary_operational_role: role } : null),
  };
  return { service: new ResidentAccessScopeService(db, staffActors), queries };
}

const denied = e => e.getStatus?.() === 403;

test('RESIDENT-SCOPE: NURSE needs an active CLINICAL_CARE assignment', async () => {
  await assert.rejects(scopeService({ staffRole: 'NURSE' }).service.assertClinicalWriteAccess('N1', 'NURSE', 'RES-1'), denied);
  const { service, queries } = scopeService({ staffRole: 'NURSE', assigned: true });
  await service.assertClinicalWriteAccess('N1', 'NURSE', 'RES-1');
  assert.deepEqual(queries[0].params, ['RES-1', 'N1', 'NURSE', 'CLINICAL_CARE']);
});

test('RESIDENT-SCOPE: CAREGIVER and PSYCHOLOGIST are assignment scoped', async () => {
  for (const [role, accessScope] of [['CAREGIVER', 'DIRECT_CARE'], ['PSYCHOLOGIST', 'PSYCHOSOCIAL_CARE'], ['SOCIAL_WORKER', 'PSYCHOSOCIAL_CARE']]) {
    await assert.rejects(scopeService({ staffRole: role }).service.assertClinicalWriteAccess('A1', role, 'RES-1'), denied);
    const { service, queries } = scopeService({ staffRole: role, assigned: true });
    await service.assertClinicalWriteAccess('A1', role, 'RES-1');
    assert.equal(queries[0].params[3], accessScope);
  }
});

test('RESIDENT-SCOPE: MEDICAL_HEAD and managers are supervisory over active residents', async () => {
  for (const role of ['MEDICAL_HEAD', 'SUPERVISOR', 'ADMIN', 'CARE_MANAGER']) {
    await scopeService({ staffRole: role }).service.assertClinicalWriteAccess('M1', role, 'RES-1');
    await assert.rejects(scopeService({ staffRole: role, residentActive: false }).service.assertClinicalWriteAccess('M1', role, 'RES-1'), denied);
  }
});

test('RESIDENT-SCOPE: stale or mismatched staff row is denied', async () => {
  await assert.rejects(scopeService({ staffRole: 'CAREGIVER', assigned: true }).service.assertClinicalWriteAccess('M1', 'MEDICAL_HEAD', 'RES-1'), denied);
  await assert.rejects(scopeService({ staffRole: 'NURSE', assigned: true }).service.assertClinicalWriteAccess('', 'NURSE', 'RES-1'), denied);
});

test('RESIDENT-SCOPE: guardian, specialists, non-clinical and AI roles are denied without a DB lookup', async () => {
  for (const role of ['GUARDIAN', 'NUTRITIONIST', 'REHABILITATION_SPECIALIST', 'ACCOUNTANT', 'RECEPTIONIST',
    'COMMUNICATIONS', 'HOUSEKEEPING', 'SECURITY', 'AI', 'SYSTEM', '']) {
    const { service, queries } = scopeService({ staffRole: role, assigned: true });
    await assert.rejects(service.assertClinicalWriteAccess('X1', role, 'RES-1'), denied, role);
    assert.equal(queries.length, 0, role);
  }
});
