const test=require('node:test');
const assert=require('node:assert/strict');
const W=require('../workspace.js');
const R=require('../scheduling.js');
function snapshot(){return W.validateBackup({caregivers:[{id:'alex',name:'Alex'},{id:'sam',name:'Sam'}],scheduleAssignments:{},shiftStyle:'three'});}
test('legacy backups migrate names to stable caregiver IDs',()=>{const data=W.validateBackup({caregivers:['Alex'],scheduleAssignments:{'2026-10-04-Morning':'Alex'},caregiverMaxHours:{Alex:35}});assert.equal(data.scheduleAssignments['2026-10-04-Morning'],'legacy-0');assert.equal(data.caregiverMaxHours['legacy-0'],35);});
test('invalid backups reject bad dates, missing people, future versions, and unsafe keys',()=>{for(const data of [{...snapshot(),scheduleAssignments:{'2026-02-30-Morning':'alex'}},{...snapshot(),scheduleAssignments:{'2026-10-04-Morning':'missing'}},{...snapshot(),version:99},JSON.parse('{"caregivers":[],"scheduleAssignments":{},"__proto__":{}}')])assert.throws(()=>W.validateBackup(data));});
test('time off blocks overnight work even when the shift starts before the viewed month',()=>{const data=snapshot();data.scheduleAssignments['2026-09-30-Night']='alex';data.caregiverRules.alex.timeOff=[{startDate:'2026-10-01',endDate:'2026-10-01'}];const warnings=R.getWarnings(W.model(data),'2026-10-01','2026-10-31');assert.ok(warnings.some(w=>w.code==='time-off'&&w.blocking));});
test('time off is inclusive and midnight boundaries do not produce false conflicts',()=>{const data=snapshot();data.caregiverRules.alex.timeOff=[{startDate:'2026-10-05',endDate:'2026-10-06'}];const model=W.model(data);const check=(day,start,end,id='alex')=>R.evaluate(model,{dayKey:day,shiftName:'Night',caregiverId:id,start,end});assert.equal(check('2026-10-04','19:00','00:00').blocked,false);assert.equal(check('2026-10-04','19:00','07:00').blocked,true);assert.equal(check('2026-10-06','19:00','07:00').blocked,true);assert.equal(check('2026-10-07','00:00','07:00').blocked,false);assert.equal(check('2026-10-05','09:00','17:00','sam').blocked,false);});
test('additional dated shifts appear only on their date and participate in overlap checks',()=>{const data=snapshot();data.workspace.extraShifts=[{dayKey:'2026-10-04',name:'Extra',start:'12:00',end:'15:00'}];data.scheduleAssignments['2026-10-04-Extra']='alex';assert.equal(W.occurrences(data,'2026-10-04','2026-10-05').filter(s=>s.shiftName==='Extra').length,1);assert.equal(R.evaluate(W.model(data),{dayKey:'2026-10-04',shiftName:'Morning',caregiverId:'alex',start:'06:30',end:'13:00'}).blocked,true);});
test('care gaps distinguish assigned shift hours from continuous coverage',()=>{const data=snapshot();data.workspace.care={enabled:true,start:'07:00',end:'19:00',count:1};data.scheduleAssignments={'2026-10-04-Morning':'alex','2026-10-04-Afternoon':'sam'};data.shiftTimeOverrides['2026-10-04__Morning']={start:'07:00',end:'12:00'};const gaps=W.coverageGaps(data,'2026-10-04','2026-10-04');assert.equal(gaps.length,1);assert.equal(gaps[0].end-gaps[0].start,60);});
test('care gaps count unique caregivers and exclude dated time off',()=>{const data=snapshot();data.workspace.care={enabled:true,start:'09:00',end:'12:00',count:2};data.scheduleAssignments['2026-10-04-Morning']='alex';data.workspace.extraShifts=[{dayKey:'2026-10-04',name:'Extra',start:'09:00',end:'12:00'}];data.scheduleAssignments['2026-10-04-Extra']='alex';assert.equal(W.coverageGaps(data,'2026-10-04','2026-10-04')[0].missing,1);data.caregiverRules.alex.timeOff=[{startDate:'2026-10-04',endDate:'2026-10-04'}];assert.equal(W.coverageGaps(data,'2026-10-04','2026-10-04')[0].missing,2);});
test('care coverage includes an overnight assignment from the previous day',()=>{const data=snapshot();data.workspace.care={enabled:true,start:'00:00',end:'07:00',count:1};data.scheduleAssignments['2026-10-03-Night']='alex';assert.deepEqual(W.coverageGaps(data,'2026-10-04','2026-10-04'),[]);});
test('recurrences cross DST and year boundaries and remain bounded',()=>{assert.deepEqual(W.recurrence('2026-12-27','2027-01-10',1),['2026-12-27','2027-01-03','2027-01-10']);assert.throws(()=>W.recurrence('2026-10-04','2030-10-04',1));assert.throws(()=>W.recurrence('2026-10-04','2026-10-01',1));});
module.exports={snapshot};
test('caregiver briefs recompute when shifts are reassigned or their hours change',()=>{
 const data=snapshot();data.scheduleAssignments['2026-10-04-Morning']='alex';
 let brief=W.caregiverBriefs(data,'2026-10-04','2026-10-10');
 assert.equal(brief.people[0].hours,6.5);assert.equal(brief.people[1].hours,0);assert.equal(brief.openShifts,20);
 data.scheduleAssignments['2026-10-04-Morning']='sam';data.shiftTimeOverrides['2026-10-04__Morning']={start:'09:00',end:'12:00'};
 brief=W.caregiverBriefs(data,'2026-10-04','2026-10-10');
 assert.equal(brief.people[0].shifts.length,0);assert.equal(brief.people[1].hours,3);assert.equal(brief.assignedHours,3);
});
test('caregiver briefs include additional and overnight shifts, limits, and date-specific warnings',()=>{
 const data=snapshot();data.scheduleAssignments['2026-10-04-Night']='alex';
 data.workspace.extraShifts.push({dayKey:'2026-10-06',name:'Extra',start:'09:00',end:'11:00'});data.scheduleAssignments['2026-10-06-Extra']='alex';
 data.caregiverRules.alex.timeOff=[{startDate:'2026-10-05',endDate:'2026-10-05'}];
 const brief=W.caregiverBriefs(data,'2026-10-04','2026-10-10');
 assert.equal(brief.people[0].hours,14);assert.equal(brief.people[0].days,2);assert.equal(brief.people[0].weeklyLimit,50);
 assert.ok(brief.people[0].warnings.some(w=>w.code==='time-off'));
 assert.equal(W.caregiverBriefs(data,'2026-10-11','2026-10-17').people[0].hours,0);
});

test('brief totals distinguish assigned shifts and scheduled caregivers from the full roster',()=>{
 const data=snapshot();data.caregivers.push({id:'jo',name:'Jo'},{id:'unused',name:'Not scheduled'});data.caregiverMaxHours.jo=50;data.caregiverMaxHours.unused=50;
 data.scheduleAssignments={'2026-10-11-Morning':'alex','2026-10-11-Afternoon':'alex','2026-10-13-Morning':'alex','2026-10-12-Afternoon':'sam','2026-10-14-Night':'sam','2026-10-16-Night':'jo'};
 const brief=W.caregiverBriefs(data,'2026-10-11','2026-10-17');
 assert.equal(brief.assignedHours,49);assert.equal(brief.assignedShifts,6);assert.equal(brief.totalShifts,21);assert.equal(brief.openShifts,15);assert.equal(brief.scheduledCaregivers,3);assert.equal(brief.people.length,4);
 assert.equal(brief.openRows.length,15);assert.ok(brief.openRows.every(row=>row.caregiverId==='Open'));
 assert.deepEqual(brief.people.map(person=>person.hours),[19,18,12,0]);
});
test('brief shows a prior-week overnight shift separately without double-counting its hours',()=>{
 const data=snapshot();data.scheduleAssignments={'2026-10-10-Night':'alex','2026-10-17-Night':'sam'};
 const brief=W.caregiverBriefs(data,'2026-10-11','2026-10-17');
 assert.equal(brief.assignedHours,12);assert.equal(brief.assignedShifts,1);assert.equal(brief.people[0].hours,0);assert.equal(brief.people[0].carryoverShifts[0].key,'2026-10-10-Night');
 data.shiftTimeOverrides['2026-10-10__Night']={start:'19:00',end:'00:00'};
 assert.equal(W.caregiverBriefs(data,'2026-10-11','2026-10-17').people[0].carryoverShifts.length,0);
});

test('large-team monthly occurrences include split parts and dated shifts exactly once without repeated scans',()=>{
  const people=Array.from({length:100},(_,i)=>({id:'person-'+i,name:'Caregiver '+i}));
  const base={
    caregivers:people,
    shiftStyle:'three',
    scheduleAssignments:{'2026-10-01-Morning':'person-0','2026-10-01-Morning (part 2)':'person-1'},
    shiftTimeOverrides:{'2026-10-01__Morning (part 2)':{start:'10:00',end:'12:00'}},
    workspace:{extraShifts:[
      {dayKey:'2026-10-01',name:'Morning (part 2)',start:'10:00',end:'12:00'},
      ...Array.from({length:1200},(_,i)=>({
        dayKey:R.addDays('2026-10-01',i%31),
        name:'Extra '+i,start:'10:00',end:'11:00'
      })),
      {dayKey:'2026-11-04',name:'Outside month',start:'12:00',end:'13:00'}
    ]}
  };
  const data=W.validateBackup(base);
  const originalFilter=data.workspace.extraShifts.filter;
  data.workspace.extraShifts.filter=()=>{throw Error('repeated full-array scan');};
  let rows;
  try{rows=W.occurrences(data,'2026-10-01','2026-10-31');}
  finally{data.workspace.extraShifts.filter=originalFilter;}
  const dayOne=rows.filter(x=>x.dayKey==='2026-10-01');
  assert.equal(rows.length,31*3+1201);
  assert.deepEqual(dayOne.slice(0,3).map(x=>x.shiftName),['Morning','Afternoon','Night']);
  assert.equal(dayOne[3].shiftName,'Morning (part 2)');
  assert.equal(dayOne[3].caregiverId,'person-1');
  assert.equal(dayOne[3].hours,2);
  assert.equal(rows.filter(x=>x.shiftName==='Outside month').length,0);
  assert.equal(rows.filter(x=>x.key==='2026-10-01-Morning (part 2)').length,1);
});
