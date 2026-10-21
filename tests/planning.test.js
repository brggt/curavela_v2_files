const test=require('node:test');
const assert=require('node:assert/strict');
const W=require('../workspace.js'),R=require('../scheduling.js'),C=require('../calendar.js');
function base(){return W.validateBackup({caregivers:[{id:'a',name:'Alex'},{id:'b',name:'Sam'}],scheduleAssignments:{'2027-01-04-Morning':'a'},shiftStyle:'three'});}

test('legacy hidden assignments are recovered as dated shifts using their original times',()=>{
 const data=base();data.shiftStyle='two';data.shiftTimeOverrides['2027-01-04__Morning']={start:'08:00',end:'11:00'};
 const restored=W.validateBackup(data),row=W.occurrences(restored,'2027-01-04','2027-01-04').find(s=>s.shiftName==='Morning');
 assert.equal(row.caregiverId,'a');assert.equal(row.hours,3);assert.equal(restored.workspace.extraShifts.length,1);
 assert.throws(()=>W.validateBackup({...data,scheduleAssignments:{'2027-01-04-Unknown':'a'}}),/no known times/);
});
test('style changes retain assignments, open edited slots and notes through a round trip',()=>{
 const data=base();data.workspace.shiftNotes['2027-01-04-Morning']='Bring the updated handoff sheet.';
 data.shiftTimeOverrides['2027-01-05__Afternoon']={start:'15:00',end:'17:00'};
 data.workspace.extraShifts.push({dayKey:'2027-01-04',name:'Day',start:'08:00',end:'15:00'});data.scheduleAssignments['2027-01-04-Day']='b';
 const changed=W.changeStyle(data,'two'),rows=W.occurrences(changed,'2027-01-04','2027-01-05');
 assert.equal(rows.find(s=>s.key==='2027-01-04-Morning').note,'Bring the updated handoff sheet.');
 assert.equal(rows.find(s=>s.key==='2027-01-04-Day').hours,7);
 assert.equal(rows.filter(s=>s.key==='2027-01-04-Day').length,1);
 const again=W.changeStyle(changed,'three');
 assert.equal(W.occurrences(again,'2027-01-05','2027-01-05').find(s=>s.shiftName==='Afternoon').hours,2);
 assert.equal(again.scheduleAssignments['2027-01-04-Day'],'b');
 assert.equal(data.shiftStyle,'three');
});
test('rotating patterns preserve dated shifts, times and notes across year boundaries',()=>{
 const data=base();data.workspace.extraShifts.push({dayKey:'2027-01-06',name:'Extra',start:'22:00',end:'02:00'});data.scheduleAssignments['2027-01-06-Extra']='b';data.workspace.shiftNotes['2027-01-06-Extra']='Check supplies';
 const pattern=W.capturePattern(data,'2027-01-04',14,'Two week rotation','rotation');
 const preview=W.applyPattern(data,pattern,'2027-12-27',2);
 assert.equal(preview.last,'2028-01-23');
 for(const day of ['2027-12-29','2028-01-12']){const row=W.occurrences(preview.data,day,day).find(s=>s.shiftName==='Extra');assert.equal(row.caregiverId,'b');assert.equal(row.hours,4);assert.equal(row.note,'Check supplies');}
 assert.equal(data.scheduleAssignments['2027-12-27-Morning'],undefined);
});
test('patterns flag removed caregivers as open, preserve unrelated slots and reject malformed patterns',()=>{
 const data=base(),pattern=W.capturePattern(data,'2027-01-04',7,'Week','week');data.caregivers=data.caregivers.filter(p=>p.id!=='a');delete data.scheduleAssignments['2027-01-04-Morning'];
 data.workspace.extraShifts.push({dayKey:'2027-02-01',name:'Unrelated',start:'10:00',end:'12:00'});data.scheduleAssignments['2027-02-01-Unrelated']='b';
 const result=W.applyPattern(data,pattern,'2027-02-01');assert.deepEqual(result.missing,['a']);assert.equal(result.data.scheduleAssignments['2027-02-01-Morning'],'Open');assert.equal(result.data.scheduleAssignments['2027-02-01-Unrelated'],'b');
 assert.throws(()=>W.applyPattern(data,{...pattern,rows:[...pattern.rows,pattern.rows[0]]},'2027-02-01'),/duplicate/);
 assert.throws(()=>W.applyPattern(data,pattern,'2027-02-01',13));
});
test('partial-day time off checks exact boundaries and the following overnight date',()=>{
 const data=base();data.caregiverRules.a.timeOff=[{startDate:'2027-01-04',endDate:'2027-01-04',allDay:false,startTime:'14:00',endTime:'17:00'}];
 const check=(day,start,end)=>R.evaluate(W.model(data),{dayKey:day,shiftName:'Morning',caregiverId:'a',start,end});
 assert.equal(check('2027-01-04','10:00','14:00').blocked,false);assert.equal(check('2027-01-04','13:00','15:00').blocked,true);assert.equal(check('2027-01-04','17:00','19:00').blocked,false);
 data.caregiverRules.a.timeOff=[{startDate:'2027-01-05',endDate:'2027-01-05',startTime:'01:00',endTime:'03:00'}];assert.equal(check('2027-01-04','19:00','07:00').blocked,true);
 for(const record of [{startDate:'2027-01-04',endDate:'2027-01-04',allDay:false},{startDate:'2027-01-04',endDate:'2027-01-04',startTime:'17:00',endTime:'14:00'},{startDate:'2027-01-04',endDate:'2027-01-04',startTime:'14:00',endTime:'14:00'}])assert.equal(R.timeOffInterval(record),null);
});
test('daily availability windows check the whole shift, including overnight windows',()=>{
 const data=base();data.caregiverRules.a.availabilityWindows={Monday:{start:'19:00',end:'07:00'}};
 const check=(start,end)=>R.evaluate(W.model(data),{dayKey:'2027-01-04',shiftName:'Morning',caregiverId:'a',start,end});
 assert.equal(check('19:00','07:00').safe,true);assert.ok(check('18:00','07:00').warnings.some(w=>w.code==='availability-time'));assert.equal(check('19:00','07:01').blocked,false);assert.equal(check('19:00','07:01').safe,false);
 assert.throws(()=>W.validateBackup({...data,caregiverRules:{a:{availabilityWindows:{Monday:{start:'bad',end:'10:00'}}}}}),/windows/);
});
test('readable change history includes assignments, exact hours and note changes',()=>{
 const data=base(),after=structuredClone(data);after.scheduleAssignments['2027-01-04-Morning']='b';after.shiftTimeOverrides['2027-01-04__Morning']={start:'08:00',end:'12:00'};after.workspace.shiftNotes['2027-01-04-Morning']='New handoff';
 const change=W.changes(data,after).find(c=>c.type==='shift');assert.equal(change.before.caregiver,'Alex');assert.equal(change.after.caregiver,'Sam');assert.equal(change.before.start,'06:30');assert.equal(change.after.end,'12:00');assert.equal(change.after.note,'New handoff');
});
test('notes, patterns and availability survive validated backups; invalid notes are rejected',()=>{
 const data=base();data.workspace.shiftNotes['2027-01-04-Morning']='Line 1\nLine 2';data.workspace.patterns.push(W.capturePattern(data,'2027-01-04',7,'Week','week'));data.caregiverRules.a.availabilityWindows={Monday:{start:'06:00',end:'14:00'}};
 const restored=W.validateBackup(JSON.parse(JSON.stringify(data)));assert.equal(restored.workspace.patterns[0].rows[0].note,'Line 1\nLine 2');assert.equal(restored.caregiverRules.a.availabilityWindows.Monday.end,'14:00');
 data.workspace.shiftNotes['2027-01-04-Morning']='x'.repeat(2001);assert.throws(()=>W.validateBackup(data),/2,000/);
});
test('calendar UTC conversion uses care location and handles ordinary, gap and fold times',()=>{
 const instant=(day,time)=>new Date(C.toInstant(day,time,'America/Chicago')).toISOString();
 assert.equal(instant('2027-01-04','09:00'),'2027-01-04T15:00:00.000Z');
 assert.equal(instant('2027-03-14','02:30'),'2027-03-14T08:30:00.000Z');
 assert.equal(instant('2027-11-07','01:30'),'2027-11-07T06:30:00.000Z');
 assert.throws(()=>C.toInstant('2027-01-04','09:00','Not/AZone'),/time zone/);
});
test('calendar exports overnight dates, stable IDs, safe text and UTF-8 folded lines without notes',()=>{
 const row={key:'2027-01-04-Extra',dayKey:'2027-01-04',shiftName:'Care, evening;\n'+('é'.repeat(60)),startTime:'19:00',endTime:'07:00',note:'PRIVATE HANDOFF'};
 const options={timeZone:'America/Chicago',scope:'test:a',updatedAt:'2027-01-01T00:00:00Z',sequence:4};
 const text=C.serialize([row],options);assert.match(text,/DTSTART:20270105T010000Z/);assert.match(text,/DTEND:20270105T130000Z/);assert.match(text,/SUMMARY:Care\\, evening\\;\\n/);assert.ok(!text.includes('PRIVATE HANDOFF'));assert.ok(text.split('\r\n').every(line=>Buffer.byteLength(line)<=75));
 const updated=C.serialize([{...row,startTime:'18:00',cancelled:true}],{...options,sequence:5});assert.equal(updated.match(/UID:[^\r]+/)[0],text.match(/UID:[^\r]+/)[0]);assert.match(updated,/STATUS:CANCELLED/);assert.match(updated,/SEQUENCE:5/);
 assert.throws(()=>C.serialize([{...row,dayKey:'2027-03-14',startTime:'02:30',endTime:'03:00'}],options),/daylight saving/);
});

test('care gaps subtract only the timed absence from an assigned shift',()=>{
 const data=base();data.workspace.care={enabled:true,start:'09:00',end:'17:00',count:1};data.shiftTimeOverrides['2027-01-04__Morning']={start:'09:00',end:'17:00'};
 data.caregiverRules.a.timeOff=[{startDate:'2027-01-04',endDate:'2027-01-04',startTime:'14:00',endTime:'16:00'}];
 const gaps=W.coverageGaps(data,'2027-01-04','2027-01-04');assert.equal(gaps.length,1);assert.equal(gaps[0].start,R.dateNumber('2027-01-04')+14*60);assert.equal(gaps[0].end-gaps[0].start,120);
});
