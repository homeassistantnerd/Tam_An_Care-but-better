'use strict';
// Clinical write endpoints must take the acting identity from the verified
// x-actor-* headers, never from the request body. In-memory mocks only.
const test = require('node:test');
const assert = require('node:assert/strict');

const VERIFIED = { id: 'TA-HSK-01', role: 'HOUSEKEEPING' };
const SPOOF = { actorId: 'TA-SUP-01', actorRole: 'SUPERVISOR' };
// Warning reviews identify the caller as the reviewer.
const REVIEW_SPOOF = { reviewerId: 'TA-SUP-01', reviewerRole: 'SUPERVISOR' };

const load = (path, name) => require(`../dist/${path}`)[name];

// [label, module, class, method, args before (body, actorId, actorRole), spoofed body]
const execute = (domain, cls) =>
  [`${domain} execute`, `${domain}/${domain}.controller.js`, cls, 'execute', ['RES-1']];
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
  ['medication administration', 'medication/medication.controller.js', 'MedicationController', 'mutate', ['ADM-1', 'ASSIGN']],
  ['care plan governance', 'care-plan-governance/care-plan-governance.controller.js', 'CarePlanGovernanceController', 'execute', ['CP-1', 'ACTIVATE']],
  ['care task execution', 'care-task-execution/care-task-execution.controller.js', 'CareTaskExecutionController', 'execute', ['CT-1', 'START']],
  ...['assign', 'transfer', 'startReview', 'resolve', 'reopen'].map(m =>
    [`care action ${m}`, 'care-actions/care-action.controller.js', 'CareActionController', m, ['RES-1', 'PAT-1']]),
  ['responsibility acceptance', 'responsibility-acceptance/responsibility-acceptance.controller.js', 'ResponsibilityAcceptanceController', 'accept', ['RES-1', 'PAT-1']],
  ['care action bridge', 'care-action-bridge/care-action-bridge.controller.js', 'CareActionBridgeController', 'execute', ['W-1']],
  ['incident report', 'incidents/incident.controller.js', 'IncidentController', 'report', []],
  ['incident mutate', 'incidents/incident.controller.js', 'IncidentController', 'mutate', ['INC-1', 'TRIAGE']],
  ['warning review', 'warning-reviews/warning-review.controller.js', 'WarningReviewController', 'review', [], REVIEW_SPOOF],
];

function stubService() {
  const calls = [];
  const service = new Proxy({}, {
    get: (_t, name) => async (...args) => { calls.push({ name, args }); return {}; },
  });
  return { service, calls };
}

for (const [label, path, cls, method, prefix, spoof = SPOOF] of cases) {
  test(`VERIFIED-ACTOR: ${label} ignores body identity and uses verified headers`, async () => {
    const { service, calls } = stubService();
    const controller = new (load(path, cls))(service);
    await controller[method](...prefix, { ...spoof, note: 'x' }, VERIFIED.id, VERIFIED.role);
    assert.ok(calls.length > 0, 'service was not called');
    const sent = JSON.stringify(calls.map(c => c.args));
    assert.ok(!sent.includes('TA-SUP-01'), `spoofed identity reached service: ${sent}`);
    assert.ok(sent.includes(VERIFIED.id) && sent.includes(VERIFIED.role), `verified identity missing: ${sent}`);
  });

  test(`VERIFIED-ACTOR: ${label} rejects requests without verified headers`, async () => {
    const { service, calls } = stubService();
    const controller = new (load(path, cls))(service);
    await assert.rejects(
      async () => controller[method](...prefix, { ...spoof }, undefined, undefined),
      e => e.getStatus?.() === 401,
    );
    assert.equal(calls.length, 0);
  });
}
