const test=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {createApplication}=require('../server/app.js');
const W=require('../workspace.js');
function snapshot(){return W.validateBackup({caregivers:[{id:'alex',name:'Alex'},{id:'sam',name:'Sam'}],scheduleAssignments:{'2027-01-04-Morning':'alex','2027-01-05-Morning':'sam'},shiftStyle:'three'});}
async function fixture(t,options={}){
 const app=createApplication({origin:'http://localhost',testing:true,...options});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.close();});
 const url='http://127.0.0.1:'+app.server.address().port;
 async function request(route,method='GET',body,cookie,headers={}){const response=await fetch(url+'/api/'+route,{method,headers:{Origin:'http://localhost','X-Curavela-Request':'1','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 async function join(email,role,id){const link=app.createInvite(email,role,id);const result=await request('accept-invite','POST',{token:link.split('#invite=')[1],name:email.split('@')[0],password:'A sufficiently long password'});assert.equal(result.status,200,JSON.stringify(result.data));return result.cookie;}
 const manager=await join('manager@example.test','manager');
 assert.equal((await request('draft','PUT',{revision:0,snapshot:snapshot()},manager)).status,200);
 const alex=await join('alex@example.test','caregiver','alex'),sam=await join('sam@example.test','caregiver','sam');
 return {app,request,manager,alex,sam,join,url};
}
test('server enforces sessions, manager permissions, origin protection, and private static files',async t=>{
 const f=await fixture(t);
 assert.equal((await f.request('draft')).status,401);
 assert.equal((await f.request('draft','GET',undefined,f.alex)).status,403);
 assert.equal((await f.request('draft','PUT',{revision:1,snapshot:snapshot()},f.alex)).status,403);
 assert.equal((await f.request('invitations','POST',{email:'x@example.test',role:'manager'},f.alex)).status,403);
 assert.equal((await f.request('draft','PUT',{revision:1,snapshot:snapshot()},f.manager,{Origin:'https://other.example'})).status,403);
 assert.equal((await f.request('session','GET',undefined,f.manager)).data.user.role,'manager');
 for(const path of ['/server/app.js','/data/curavela.sqlite','/%2e%2e/server/app.js'])assert.equal((await fetch(f.url+path)).status,404);
});
test('stale saves and malformed snapshots leave the shared draft unchanged',async t=>{
 const f=await fixture(t),changed=snapshot();changed.caregivers[0].name='Updated';
 assert.equal((await f.request('draft','PUT',{revision:0,snapshot:changed},f.manager)).status,409);
 const bad=snapshot();bad.scheduleAssignments['not-a-date']='alex';
 assert.equal((await f.request('draft','PUT',{revision:1,snapshot:bad},f.manager)).status,400);
 const current=await f.request('draft','GET',undefined,f.manager);assert.equal(current.data.revision,1);assert.equal(current.data.snapshot.caregivers[0].name,'Alex');
});
test('drafts remain private until publishing; acknowledgments belong to the assigned person',async t=>{
 const f=await fixture(t);assert.equal((await f.request('my-shifts','GET',undefined,f.alex)).data.shifts.length,0);
 const published=await f.request('publish','POST',{revision:1,first:'2027-01-04',last:'2027-01-05'},f.manager);assert.equal(published.status,200,JSON.stringify(published.data));assert.equal(published.data.count,6);
 const mine=(await f.request('my-shifts','GET',undefined,f.alex)).data;assert.equal(mine.shifts.length,1);assert.equal(mine.shifts[0].caregiverId,'alex');
 assert.equal((await f.request('acknowledge','POST',{key:'2027-01-05-Morning'},f.alex)).status,404);
 assert.equal((await f.request('acknowledge','POST',{key:'2027-01-04-Morning'},f.alex)).status,200);
 const checked=(await f.request('my-shifts','GET',undefined,f.alex)).data.shifts[0];assert.equal(checked.acknowledged,true,JSON.stringify({checked,acks:f.app.db.prepare('SELECT shift_key,fingerprint FROM acknowledgments').all(),published:JSON.parse(f.app.db.prepare('SELECT published FROM workspace').get().published)[0]}));
 assert.equal((await f.request('notifications','GET',undefined,f.alex)).data.notifications.length,1);
});
test('publishing a time-off conflict is blocked without changing published shifts',async t=>{
 const f=await fixture(t),data=snapshot();data.caregiverRules.alex.timeOff=[{startDate:'2027-01-04',endDate:'2027-01-04'}];
 await f.request('draft','PUT',{revision:1,snapshot:data},f.manager);
 const result=await f.request('publish','POST',{revision:2,first:'2027-01-04',last:'2027-01-05',confirmWarnings:true},f.manager);
 assert.equal(result.status,400);assert.match(result.data.error,/time off/);assert.equal((await f.request('my-shifts','GET',undefined,f.alex)).data.shifts.length,0);
});
test('time-off requests require manager approval and cannot be decided twice',async t=>{
 const f=await fixture(t);const submitted=await f.request('requests','POST',{kind:'time-off',startDate:'2027-01-10',endDate:'2027-01-12'},f.alex);assert.equal(submitted.status,201);
 assert.equal((await f.request('requests/decide','POST',{id:submitted.data.id,decision:'approved',revision:1},f.alex)).status,403);
 const approved=await f.request('requests/decide','POST',{id:submitted.data.id,decision:'approved',revision:1},f.manager);assert.equal(approved.status,200);assert.equal(approved.data.revision,2);
 assert.equal((await f.request('requests/decide','POST',{id:submitted.data.id,decision:'approved',revision:2},f.manager)).status,409);
 assert.equal((await f.request('draft','GET',undefined,f.manager)).data.snapshot.caregiverRules.alex.timeOff.length,1);
 assert.equal((await f.request('requests','GET',undefined,f.sam)).data.requests.length,0);
});
test('open-shift claims are validated again on approval',async t=>{
 const f=await fixture(t);await f.request('publish','POST',{revision:1,first:'2027-01-04',last:'2027-01-05'},f.manager);
 const submitted=await f.request('requests','POST',{kind:'claim',key:'2027-01-05-Afternoon'},f.alex);assert.equal(submitted.status,201);
 const data=snapshot();data.caregiverRules.alex.timeOff=[{startDate:'2027-01-05',endDate:'2027-01-05'}];await f.request('draft','PUT',{revision:1,snapshot:data},f.manager);
 assert.equal((await f.request('requests/decide','POST',{id:submitted.data.id,decision:'approved',revision:2},f.manager)).status,400);
});
test('a reciprocal swap needs agreement and updates both assignments in the draft',async t=>{
 const f=await fixture(t);await f.request('publish','POST',{revision:1,first:'2027-01-04',last:'2027-01-05'},f.manager);
 const submitted=await f.request('requests','POST',{kind:'swap',key:'2027-01-04-Morning',targetKey:'2027-01-05-Morning'},f.alex);assert.equal(submitted.status,201,JSON.stringify(submitted.data));
 assert.equal((await f.request('requests/decide','POST',{id:submitted.data.id,decision:'approved',revision:1},f.manager)).status,400);
 assert.equal((await f.request('requests/decide','POST',{id:submitted.data.id,decision:'approved',revision:1,coworkerConfirmed:true},f.manager)).status,400);
 assert.equal((await f.request('requests/respond','POST',{id:submitted.data.id,decision:'accepted'},f.manager)).status,403);
 assert.equal((await f.request('requests/respond','POST',{id:submitted.data.id,decision:'accepted'},f.alex)).status,403);
 assert.equal((await f.request('requests','GET',undefined,f.sam)).data.requests[0].incoming,true);
 assert.equal((await f.request('requests/respond','POST',{id:submitted.data.id,decision:'accepted'},f.sam)).status,200);
 assert.equal((await f.request('requests/respond','POST',{id:submitted.data.id,decision:'accepted'},f.sam)).status,409);
 const approved=await f.request('requests/decide','POST',{id:submitted.data.id,decision:'approved',revision:1},f.manager);assert.equal(approved.status,200,JSON.stringify(approved.data));
 const draft=(await f.request('draft','GET',undefined,f.manager)).data.snapshot;assert.equal(draft.scheduleAssignments['2027-01-04-Morning'],'sam');assert.equal(draft.scheduleAssignments['2027-01-05-Morning'],'alex');
});
test('invitation tokens are single-use and logout revokes the session',async t=>{
 const f=await fixture(t);const link=f.app.createInvite('alex@example.test','caregiver','alex'),body={token:link.split('#invite=')[1],name:'Alex',password:'A sufficiently long password'};
 const first=await f.request('accept-invite','POST',body);assert.equal(first.status,200);assert.equal((await f.request('accept-invite','POST',body)).status,400);
 await f.request('logout','POST',{},first.cookie);assert.equal((await f.request('requests','GET',undefined,first.cookie)).status,401);
});
test('a caregiver profile cannot be linked to multiple accounts',async t=>{
 const f=await fixture(t);
 const result=await f.request('invitations','POST',{email:'other@example.test',role:'caregiver',caregiverId:'alex'},f.manager);
 assert.equal(result.status,409);assert.match(result.data.error,/already linked/);
});
test('the last manager cannot be demoted through an invitation',async t=>{
 const f=await fixture(t),data=snapshot();data.caregivers.push({id:'new-profile',name:'New profile'});
 await f.request('draft','PUT',{revision:1,snapshot:data},f.manager);
 const result=await f.request('invitations','POST',{email:'manager@example.test',role:'caregiver',caregiverId:'new-profile'},f.manager);
 assert.equal(result.status,409);assert.match(result.data.error,/at least one manager/);
});
test('removing a published additional shift notifies its caregiver',async t=>{
 const f=await fixture(t),data=snapshot();data.workspace.extraShifts.push({dayKey:'2027-01-06',name:'Extra',start:'09:00',end:'11:00'});data.scheduleAssignments['2027-01-06-Extra']='alex';
 await f.request('draft','PUT',{revision:1,snapshot:data},f.manager);
 await f.request('publish','POST',{revision:2,first:'2027-01-06',last:'2027-01-06'},f.manager);
 data.workspace.extraShifts=[];delete data.scheduleAssignments['2027-01-06-Extra'];
 await f.request('draft','PUT',{revision:2,snapshot:data},f.manager);
 await f.request('publish','POST',{revision:3,first:'2027-01-06',last:'2027-01-06'},f.manager);
 assert.ok((await f.request('notifications','GET',undefined,f.alex)).data.notifications.some(n=>n.message.startsWith('Shift removed:')));
 assert.equal((await f.request('my-shifts','GET',undefined,f.alex)).data.shifts.length,0);
});
test('email alerts respect opt-in and retries retain an idempotency key',async t=>{
 const calls=[];const f=await fixture(t,{sendEmail:async(to,message,id)=>{calls.push({to,message,id});if(calls.length===1)throw new Error('temporary provider failure');}});
 await f.request('preferences','POST',{emailEnabled:true,reminders:false},f.alex);
 await f.request('publish','POST',{revision:1,first:'2027-01-04',last:'2027-01-05'},f.manager);
 await f.app.processNotifications();assert.equal((await f.request('notifications','GET',undefined,f.alex)).data.notifications[0].email_state,'failed');
 await f.app.processNotifications();assert.equal((await f.request('notifications','GET',undefined,f.alex)).data.notifications[0].email_state,'accepted');
 assert.equal(calls.length,2);assert.equal(calls[0].id,calls[1].id);assert.equal(calls[0].to,'alex@example.test');
});

test('coworker declines and stale swap acceptances cannot change the draft',async t=>{
 const f=await fixture(t);await f.request('publish','POST',{revision:1,first:'2027-01-04',last:'2027-01-05'},f.manager);
 const create=async()=>f.request('requests','POST',{kind:'swap',key:'2027-01-04-Morning',targetKey:'2027-01-05-Morning'},f.alex);
 const one=await create();assert.equal((await f.request('requests/respond','POST',{id:one.data.id,decision:'declined'},f.sam)).status,200);
 assert.equal((await f.request('requests/decide','POST',{id:one.data.id,decision:'approved',revision:1},f.manager)).status,409);
 const two=await create();assert.equal((await f.request('requests/respond','POST',{id:two.data.id,decision:'accepted'},f.sam)).status,200);
 const data=snapshot();data.shiftTimeOverrides['2027-01-05__Morning']={start:'09:00',end:'12:00'};await f.request('draft','PUT',{revision:1,snapshot:data},f.manager);
 assert.equal((await f.request('requests/decide','POST',{id:two.data.id,decision:'approved',revision:2},f.manager)).status,409);
 const current=(await f.request('draft','GET',undefined,f.manager)).data;assert.equal(current.revision,2);assert.equal(current.snapshot.scheduleAssignments['2027-01-04-Morning'],'alex');
});
test('timed team requests retain exact hours and reject overlaps on approval',async t=>{
 const f=await fixture(t),body={kind:'time-off',startDate:'2027-01-04',endDate:'2027-01-04',allDay:false,startTime:'14:00',endTime:'17:00'};
 const submit=await f.request('requests','POST',body,f.alex);assert.equal(submit.status,201);
 assert.equal((await f.request('requests/decide','POST',{id:submit.data.id,decision:'approved',revision:1},f.manager)).status,200);
 const data=(await f.request('draft','GET',undefined,f.manager)).data.snapshot;assert.equal(data.caregiverRules.alex.timeOff[0].startTime,'14:00');
 const duplicate=await f.request('requests','POST',body,f.alex);assert.equal((await f.request('requests/decide','POST',{id:duplicate.data.id,decision:'approved',revision:2},f.manager)).status,400);
 assert.equal((await f.request('publish','POST',{revision:2,first:'2027-01-04',last:'2027-01-04'},f.manager)).status,200);
 assert.equal((await f.request('requests','POST',{...body,endTime:'13:00'},f.alex)).status,400);
});
test('server restore is manager-only, rejects stale drafts and preserves publications',async t=>{
 const f=await fixture(t);await f.request('publish','POST',{revision:1,first:'2027-01-04',last:'2027-01-05'},f.manager);
 const data=snapshot();data.shiftTimeOverrides['2027-01-04__Morning']={start:'08:00',end:'12:00'};data.workspace.shiftNotes['2027-01-04-Morning']='Draft note';await f.request('draft','PUT',{revision:1,snapshot:data},f.manager);
 assert.equal((await f.request('snapshots','GET',undefined,f.alex)).status,403);
 const preview=await f.request('snapshots/preview','POST',{revision:2,targetRevision:1},f.manager);assert.equal(preview.status,200);assert.equal(preview.data.changes[0].before.start,'08:00');assert.equal(preview.data.changes[0].after.start,'06:30');
 assert.equal((await f.request('snapshots/restore','POST',{revision:1,targetRevision:1},f.manager)).status,409);
 assert.equal((await f.request('snapshots/restore','POST',{revision:2,targetRevision:1},f.alex)).status,403);
 assert.equal((await f.request('snapshots/restore','POST',{revision:2,targetRevision:1},f.manager)).data.revision,3);
 assert.equal((await f.request('my-shifts','GET',undefined,f.alex)).data.shifts[0].startTime,'06:30');
 const history=(await f.request('history','GET',undefined,f.manager)).data.history;assert.equal(history[0].name,'manager');assert.match(history[0].action,/Restore/);assert.equal(history[0].details.changes[0].before.note,'Draft note');
 assert.equal((await f.request('snapshots/restore','POST',{revision:3,targetRevision:2},f.manager)).data.revision,4);
 assert.equal((await f.request('draft','GET',undefined,f.manager)).data.snapshot.workspace.shiftNotes['2027-01-04-Morning'],'Draft note');
});
test('private calendar links show only published own shifts, rotate, revoke and omit notes',async t=>{
 const f=await fixture(t,{timeZone:'America/Chicago'});const created=await f.request('calendar-link','POST',{},f.alex);assert.equal(created.status,200);
 const route=new URL(created.data.link).pathname;let response=await fetch(f.url+route),text=await response.text();assert.match(response.headers.get('content-type'),/text\/calendar/);assert.ok(!text.includes('BEGIN:VEVENT'));
 const data=snapshot();data.workspace.shiftNotes['2027-01-04-Morning']='PRIVATE HANDOFF';await f.request('draft','PUT',{revision:1,snapshot:data},f.manager);await f.request('publish','POST',{revision:2,first:'2027-01-04',last:'2027-01-05'},f.manager);
 text=await (await fetch(f.url+route)).text();assert.equal(text.match(/BEGIN:VEVENT/g).length,1);assert.match(text,/DTSTART:20270104T123000Z/);assert.ok(!text.includes('PRIVATE HANDOFF'));assert.ok(!text.includes('20270105T123000Z'));
 assert.equal((await f.request('my-shifts','GET',undefined,f.alex)).data.shifts[0].note,'PRIVATE HANDOFF');assert.ok((await f.request('swap-options?key=2027-01-05-Morning','GET',undefined,f.sam)).data.shifts.every(s=>!('note' in s)));
 const stored=f.app.db.prepare('SELECT hash FROM calendar_tokens').get().hash;assert.ok(!route.includes(stored));assert.equal(stored.length,64);
 const rotated=await f.request('calendar-link','POST',{},f.alex);assert.equal((await fetch(f.url+route)).status,404);const newRoute=new URL(rotated.data.link).pathname;assert.equal((await fetch(f.url+newRoute)).status,200);
 await f.request('calendar-link','DELETE',undefined,f.alex);assert.equal((await fetch(f.url+newRoute)).status,404);assert.equal((await f.request('calendar-link','POST',{},f.manager)).status,403);
});
test('calendar reassignment publishes a cancellation with stable event ID and restores correctly',async t=>{
 const f=await fixture(t);await f.request('publish','POST',{revision:1,first:'2027-01-04',last:'2027-01-04'},f.manager);const link=(await f.request('calendar-link','POST',{},f.alex)).data.link,route=new URL(link).pathname;
 const original=await(await fetch(f.url+route)).text(),uid=original.match(/UID:[^\r]+/)[0];
 const data=snapshot();data.scheduleAssignments['2027-01-04-Morning']='sam';await f.request('draft','PUT',{revision:1,snapshot:data},f.manager);await f.request('publish','POST',{revision:2,first:'2027-01-04',last:'2027-01-04'},f.manager);
 const cancelled=await(await fetch(f.url+route)).text();assert.match(cancelled,/STATUS:CANCELLED/);assert.equal(cancelled.match(/UID:[^\r]+/)[0],uid);assert.match(cancelled,/SEQUENCE:2/);
 await f.request('draft','PUT',{revision:2,snapshot:snapshot()},f.manager);await f.request('publish','POST',{revision:3,first:'2027-01-04',last:'2027-01-04'},f.manager);
 const restored=await(await fetch(f.url+route)).text();assert.ok(!restored.includes('STATUS:CANCELLED'));assert.equal(restored.match(/BEGIN:VEVENT/g).length,1);
});
test('new public assets have correct media types and private operational files remain inaccessible',async t=>{
 const f=await fixture(t);
 for(const [file,type] of [['calendar.js','text/javascript'],['manifest.webmanifest','application/manifest+json'],['icon-192.png','image/png'],['sw.js','text/javascript']]){const res=await fetch(f.url+'/'+file);assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),type);}
 for(const file of ['server/backup.js','Dockerfile','.env','.dockerignore'])assert.equal((await fetch(f.url+'/'+file)).status,404);
});

test('authenticated team chat is shared only with signed-in teammates',async t=>{
  const f=await fixture(t);
  assert.equal((await f.request('messages?channel=caregiver')).status,401);
  assert.equal((await f.request('messages','POST',{channel:'caregiver',text:'Ready for Friday'},f.alex)).status,201);
  const teammate=await f.request('messages?channel=caregiver','GET',undefined,f.sam);
  assert.equal(teammate.status,200);
  assert.equal(teammate.data.messages.length,1);
  assert.equal(teammate.data.messages[0].body,'Ready for Friday');
  assert.equal((await f.request('messages','POST',{channel:'health',text:'medical details'},f.alex)).status,400);
  assert.equal((await f.request('messages?channel=family','GET',undefined,f.manager)).status,400);
  assert.equal((await f.request('messages','POST',{channel:'caregiver',text:'x'.repeat(2001)},f.alex)).status,400);
  assert.equal((await f.request('messages','POST',{channel:'caregiver',text:'Hello'},f.alex,{Origin:'https://attacker.example'})).status,403);
});
test('schedule conversation restricts participants and manager approval updates draft only',async t=>{
  const f=await fixture(t);
  const published=await f.request('publish','POST',{revision:1,first:'2027-01-04',last:'2027-01-05'},f.manager);
  assert.equal(published.status,200);
  const release=await f.request('requests','POST',{kind:'release',key:'2027-01-04-Morning'},f.alex);
  assert.equal(release.status,201);
  const id=release.data.id,endpoint='messages?channel=schedule&requestId='+id;
  assert.equal((await f.request(endpoint,'GET',undefined,f.sam)).status,403);
  assert.equal((await f.request('messages','POST',{channel:'schedule',requestId:id,text:'Not on this shift'},f.sam)).status,403);
  assert.equal((await f.request('messages','POST',{channel:'schedule',requestId:id,text:'Need someone for Monday morning'},f.alex)).status,201);
  const managerMessages=await f.request(endpoint,'GET',undefined,f.manager);
  assert.equal(managerMessages.status,200);
  assert.equal(managerMessages.data.messages[0].body,'Need someone for Monday morning');
  assert.equal((await f.request('messages','POST',{channel:'schedule',requestId:id,text:'Approved after review'},f.manager)).status,201);
  const approval=await f.request('requests/decide','POST',{id,decision:'approved',revision:1},f.manager);
  assert.equal(approval.status,200,JSON.stringify(approval.data));
  const draft=await f.request('draft','GET',undefined,f.manager);
  assert.equal(draft.data.snapshot.scheduleAssignments['2027-01-04-Morning'],'Open');
  const caregiverView=await f.request('my-shifts','GET',undefined,f.alex);
  assert.ok(caregiverView.data.shifts.some(shift=>shift.key==='2027-01-04-Morning'),'published shift stays assigned until publish');
  assert.equal((await f.request('messages','POST',{channel:'schedule',requestId:id,text:'Reopen without new request'},f.alex)).status,409);
  assert.equal((await f.request(endpoint,'GET',undefined,f.alex)).status,200);
  assert.equal((await f.request('messages?channel=schedule&requestId=unrelated','GET',undefined,f.manager)).status,404);
});
