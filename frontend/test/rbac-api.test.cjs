'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ts=require('typescript');
function load(name,mocks,globals={}){const source=fs.readFileSync(require('node:path').join(__dirname,'../src',name),'utf8').replaceAll('import.meta.env.PROD','true');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;const exports={};vm.runInNewContext(js,{...globals,exports,require:n=>{if(!(n in mocks))throw Error('Unexpected import '+n);return mocks[n];},console,URLSearchParams,localStorage:{getItem:()=>assert.fail('production must not load local fixtures')}});return exports;}
for(const code of [401,403,404])test('Production resident APIs propagate '+code,async()=>{const error=Error('HTTP '+code);const api=load('api/residents.ts',{'./client':{apiRequest:async()=>{throw error;}}});for(const call of [()=>api.listResidents({actorId:'A',actorRole:'NURSE'}),()=>api.getResident('B',{}),()=>api.getResidentCareView('B',{})])await assert.rejects(call,e=>e===error);});
test('Production empty scoped list remains empty',async()=>{let path;const api=load('api/residents.ts',{'./client':{apiRequest:async p=>{path=p;return [];}}});const result=await api.listResidents({actorRole:'PSYCHOLOGIST'});assert.equal(result.length,0);assert.equal(path,'/api/operations/residents/assigned');assert.equal(api.getStoredResidents,undefined,'no local resident fixtures exist');});
test('Login uses server password authentication and stores JWT',async()=>{let sent,stored;const actor={actorId:'actor-A',actorRole:'NURSE'};const fetch=async(url,o)=>{sent={url,o};return {ok:true,status:200,json:async()=>({accessToken:'ci-token',actor})};};const api=load('api/auth.ts',{'./client':{API_BASE_URL:'',apiRequest:async()=>{throw Error('resolve requires server');}},'../auth/session':{storeAccessToken:v=>{stored=v;},clearStoredAuthSession:()=>{},readStoredAuthMetadata:()=>null}},{fetch});assert.equal(await api.loginWithPassword(' actor-A ',' password '),actor);assert.equal(sent.url,'/api/auth/login');assert.equal(JSON.parse(sent.o.body).actorId,'actor-A');assert.equal(JSON.parse(sent.o.body).password,' password ');assert.equal(stored,'ci-token');await assert.rejects(api.resolveStaffActor('Admin'));});

test('Staff status uses backend and propagates failure instead of local success',async()=>{
 let sent;const error=Error('revocation failed');const api=load('api/staff-actors.ts',{'./client':{apiRequest:async(p,o)=>{sent={p,o};throw error;}}});
 await assert.rejects(api.updateStaffStatus({actorId:'manager-A',actorRole:'SUPERVISOR'},{actorId:'staff-A',status:'SUSPENDED',reason:'test'}),e=>e===error);
 assert.equal(sent.p,'/api/operations/staff-actors/staff-A/status');assert.equal(JSON.parse(sent.o.body).status,'SUSPENDED');
});

for(const code of [401,403,404,500])test('Health report operations propagate HTTP '+code,async()=>{
 const error=Error('HTTP '+code),actor={actorId:'A',actorRole:'NURSE'};
 const api=load('features/health-reports/healthReportsApi.ts',{'../../api/client':{apiRequest:async()=>{throw error;}},'../../auth/session':{}});
 for(const call of [()=>api.listHealthReports(actor),()=>api.createHealthReport(actor,{}),()=>api.updateHealthReport(actor,'B','{}','APPROVED'),()=>api.generateHealthReport(actor,'B'),()=>api.submitHealthReportForReview(actor,'B'),()=>api.approveHealthReport(actor,'B'),()=>api.deliverHealthReport(actor,'B',{})])await assert.rejects(call,e=>e===error);
});
test('Health reports preserve empty result and do not send client approval status',async()=>{
 const calls=[],actor={actorId:'A',actorRole:'NURSE'};
 const api=load('features/health-reports/healthReportsApi.ts',{'../../api/client':{apiRequest:async(p,o)=>{calls.push({p,o});return [];}},'../../auth/session':{}});
 assert.equal((await api.listHealthReports(actor)).length,0);
 await api.createHealthReport(actor,{residentId:'B',initialStatus:'APPROVED'});
 await api.updateHealthReport(actor,'B','{}','APPROVED');
 assert.equal(calls[0].p,'/api/health-reports');
 assert.equal(JSON.parse(calls[1].o.body).initialStatus,undefined);
 assert.deepEqual(JSON.parse(calls[2].o.body),{summary:'{}'});
});

test('Stored session survives reload for every canonical role (COMMUNICATIONS regression)',()=>{
 const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
 const roles=['ADMIN','SUPERVISOR','CARE_MANAGER','MEDICAL_HEAD','NURSE','CAREGIVER','NUTRITIONIST','ACCOUNTANT','RECEPTIONIST','PSYCHOLOGIST','SOCIAL_WORKER','REHABILITATION_SPECIALIST','COMMUNICATIONS','HOUSEKEEPING','SECURITY','GUARDIAN'];
 for(const role of roles){
  const store={'taman-care-production-access-token':'h.'+b64({sub:'A',role,jti:'j',exp:Math.floor(Date.now()/1000)+3600})+'.s','taman-care-v75-development-actor':JSON.stringify({actorId:'A',actorRole:role})};
  const window={atob:s=>Buffer.from(s,'base64').toString('binary'),dispatchEvent(){},localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;},removeItem:k=>{delete store[k];}}};
  const api=load('auth/session.ts',{},{window,Event:function(){}});
  assert.equal(api.readStoredActor()?.actorRole,role,role);
 }
});
