/* Shared snapshot validation and schedule calculations, used by browser and server. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./scheduling.js') : root.CuravelaScheduling);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CuravelaWorkspace = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function (rules) {
  'use strict';
  const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const defaults = {'Full Day':{start:'00:00',end:'00:00'},Day:{start:'07:00',end:'19:00'},Night:{start:'19:00',end:'07:00'},Morning:{start:'06:30',end:'13:00'},Afternoon:{start:'13:00',end:'19:00'}};
  function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function safeKeys(value) {
    if (!value || typeof value !== 'object') return;
    for (const key of Object.keys(value)) {
      assert(!['__proto__','constructor','prototype'].includes(key), 'The backup contains an unsupported property.');
      safeKeys(value[key]);
    }
  }
  function validTime(value) { return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
  function validateBackup(input) {
    assert(object(input), 'Choose a Curavela JSON backup.');
    safeKeys(input);
    input = JSON.parse(JSON.stringify(input));
    assert(!input.app || input.app === 'Curavela' || input.app === 'Kindshift', 'This file is not a Curavela backup.');
    assert(!input.version || (Number.isInteger(input.version) && input.version <= 6), 'This backup needs a newer Curavela version.');
    assert(Array.isArray(input.caregivers) && object(input.scheduleAssignments), 'The backup is missing caregivers or assignments.');
    assert(input.caregivers.length <= 500, 'This workspace supports up to 500 caregivers.');
    const people = input.caregivers.map((p,i) => typeof p === 'string' ? {id:'legacy-'+i,name:p} : p);
    const ids = new Set(), names = new Map();
    people.forEach(p => {
      assert(object(p) && typeof p.id === 'string' && p.id.length > 0 && typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= 200, 'A caregiver has an invalid name or ID.');
      assert(p.id.length<=200&&!['__proto__','constructor','prototype','Open'].includes(p.id),'A caregiver ID is reserved or too long.');
      assert(!ids.has(p.id), 'Caregiver IDs must be unique.'); ids.add(p.id); names.set(p.name,p.id);
    });
    const times = {...defaults,...(input.shiftTimes || {})};
    Object.values(times).forEach(t => assert(object(t) && validTime(t.start) && validTime(t.end), 'A shift has invalid start or end times.'));
    const custom = input.customShifts || ['Morning','Afternoon','Night'];
    assert(Array.isArray(custom) && custom.length <= 100 && custom.every(n=>typeof n==='string' && n.trim() && times[n]), 'Custom shift templates are invalid.');
    const style = input.shiftStyle || 'three';
    assert(['one','two','three','custom'].includes(style), 'Unknown shift style.');
    const weekStart = input.weekStart || 'Sunday'; assert(weekdays.includes(weekStart),'Unknown week-start day.');
    const extra = input.workspace || {};
    assert(object(extra), 'Workspace settings are invalid.');
    const extraShifts = extra.extraShifts || [];
    assert(Array.isArray(extraShifts) && extraShifts.length <= 20000, 'Extra shifts are invalid.');
    const unique = new Set();
    const activeNames=style==='one'?['Full Day']:style==='two'?['Day','Night']:style==='three'?['Morning','Afternoon','Night']:custom;
    extraShifts.forEach(s => {
      assert(object(s) && Number.isFinite(rules.dateNumber(s.dayKey)) && typeof s.name==='string' && s.name.trim() && s.name.length<=120 && validTime(s.start) && validTime(s.end), 'An additional shift has invalid dates or times.');
      const key=s.dayKey+'-'+s.name; assert(!unique.has(key),'Additional shifts have duplicate names on the same date.'); unique.add(key);
      assert(!activeNames.includes(s.name),'An additional shift duplicates an active template.');
    });
    const assignments = {};
    assert(Object.keys(input.scheduleAssignments).length<=30000,'The backup contains too many assignments.');
    Object.entries(input.scheduleAssignments).forEach(([key,id])=>{
      assert(Number.isFinite(rules.dateNumber(key.slice(0,10))) && key[10]==='-' && key.length>11,'An assignment date is invalid.');
      const mapped=ids.has(id)||id==='Open'?id:names.get(id);
      assert(Boolean(mapped),'An assignment refers to a missing caregiver.'); assignments[key]=mapped;
    });
    const overrides = input.shiftTimeOverrides || {};
    assert(object(overrides),'Dated times are invalid.');
    Object.entries(overrides).forEach(([key,t])=> assert(Number.isFinite(rules.dateNumber(key.slice(0,10))) && key.slice(10,12)==='__' && object(t) && validTime(t.start) && validTime(t.end),'A dated shift time is invalid.'));
    const cgRules={}, maxHours={};
    people.forEach(p=>{
      const r=p.rules || (input.caregiverRules||{})[p.id] || (input.caregiverRules||{})[p.name] || {};
      assert(object(r),'Caregiver rules are invalid.');
      const days=r.availableDays || weekdays;
      assert(Array.isArray(days)&&days.every(d=>weekdays.includes(d)),'Available days are invalid.');
      assert(!r.allowedShifts || (Array.isArray(r.allowedShifts)&&r.allowedShifts.every(s=>typeof s==='string')),'Allowed shifts are invalid.');
      assert(!r.timeOff || (Array.isArray(r.timeOff)&&r.timeOff.every(t=>rules.timeOffInterval(t))),'Time-off dates are invalid.');
      assert(r.minRestHours===undefined||(typeof r.minRestHours==='number'&&Number.isFinite(r.minRestHours)&&r.minRestHours>=0&&r.minRestHours<=168),'Minimum rest hours are invalid.');
      assert(r.maxConsecutiveDays===undefined||(Number.isInteger(r.maxConsecutiveDays)&&r.maxConsecutiveDays>=0&&r.maxConsecutiveDays<=366),'Maximum consecutive days are invalid.');
      assert(r.needsTwoConsecutiveDaysOff===undefined||typeof r.needsTwoConsecutiveDaysOff==='boolean','Days-off preference is invalid.');
      assert(r.note===undefined||(typeof r.note==='string'&&r.note.length<=10000),'Caregiver note is invalid.');
      const max=Number(p.maxHours || (input.caregiverMaxHours||{})[p.id] || (input.caregiverMaxHours||{})[p.name] || 50);
      assert(Number.isFinite(max)&&max>0&&max<=168,'Weekly hour limits must be between 0 and 168.'); maxHours[p.id]=max;
      cgRules[p.id]={availableDays:days,allowedShifts:[],maxConsecutiveDays:0,minRestHours:0,needsTwoConsecutiveDaysOff:false,note:'',timeOff:[],...r};
    });
    const care=extra.care || {enabled:false,start:'00:00',end:'00:00',count:1};
    assert(object(care) && validTime(care.start) && validTime(care.end) && Number.isInteger(Number(care.count)) && care.count>=1 && care.count<=20,'Required care hours or staffing count are invalid.');
    const series=extra.series || [];
    assert(Array.isArray(series) && series.every(s=>object(s)&&typeof s.id==='string'&&Array.isArray(s.keys)&&s.keys.every(k=>typeof k==='string'&&Number.isFinite(rules.dateNumber(k.slice(0,10))))),'Recurring shift information is invalid.');
    return {app:'Curavela',version:6,customShifts:custom,caregivers:people.map(p=>({id:p.id,name:p.name})),caregiverMaxHours:maxHours,caregiverRules:cgRules,scheduleAssignments:assignments,shiftTimes:times,shiftTimeOverrides:overrides,scheduleBriefs:object(input.scheduleBriefs)?input.scheduleBriefs:{},shiftStyle:style,weekStart,scheduleView:['weekly','monthly','agenda'].includes(input.scheduleView)?input.scheduleView:'weekly',month:/^\d{4}-\d{2}$/.test(input.month||'')?input.month:'',weekStartDate:Number.isFinite(rules.dateNumber(input.weekStartDate))?input.weekStartDate:'',workspace:{extraShifts,series,care,history:Array.isArray(extra.history)?extra.history.slice(-200):[]}};
  }
  function templates(data) {
    const names=data.shiftStyle==='one'?['Full Day']:data.shiftStyle==='two'?['Day','Night']:data.shiftStyle==='three'?['Morning','Afternoon','Night']:data.customShifts;
    return names.map(name=>({name,...data.shiftTimes[name]}));
  }
  function model(data) { return {shifts:templates(data),extraShifts:data.workspace.extraShifts,assignments:data.scheduleAssignments,overrides:data.shiftTimeOverrides,caregivers:data.caregivers,rules:data.caregiverRules,maxHours:data.caregiverMaxHours,weekStart:data.weekStart}; }
  function occurrences(data,first,last) {
    const result=[];
    for(let date=first;date<=last;date=rules.addDays(date,1)) {
      templates(data).concat(data.workspace.extraShifts.filter(s=>s.dayKey===date)).forEach(s=>{
        const key=date+'-'+s.name,t=data.shiftTimeOverrides[date+'__'+s.name]||s,span=rules.interval(date,t.start,t.end);
        result.push({key,dayKey:date,shiftName:s.name,startTime:t.start,endTime:t.end,caregiverId:data.scheduleAssignments[key]||'Open',...span});
      });
    }
    return result;
  }
  function coverageGaps(data,first,last) {
    if(!data.workspace.care.enabled)return [];
    const care=data.workspace.care;
    const entries=rules.buildEntries(model(data)).filter(e=>!e.invalid&&!rules.getTimeOffConflicts(data.caregiverRules[e.caregiverId]||{},e).length);
    const gaps=[];
    for(let date=first;date<=last;date=rules.addDays(date,1)) {
      const need=rules.interval(date,care.start,care.end);
      const relevant=entries.filter(e=>e.start<need.end&&e.end>need.start);
      const points=[need.start,need.end,...relevant.flatMap(e=>[Math.max(need.start,e.start),Math.min(need.end,e.end)])];
      const ordered=[...new Set(points)].sort((a,b)=>a-b);
      for(let i=0;i<ordered.length-1;i++) {
        const start=ordered[i],end=ordered[i+1],count=new Set(relevant.filter(e=>e.start<end&&e.end>start).map(e=>e.caregiverId)).size;
        if(count>=care.count)continue;
        const previous=gaps[gaps.length-1];
        if(previous&&previous.end===start&&previous.dayKey===date&&previous.missing===care.count-count)previous.end=end;
        else gaps.push({dayKey:date,start,end,missing:care.count-count});
      }
    }
    return gaps;
  }
  function recurrence(first,last,everyWeeks) {
    assert(Number.isFinite(rules.dateNumber(first))&&Number.isFinite(rules.dateNumber(last))&&last>=first,'Choose a valid recurrence end date.');
    assert([1,2,4].includes(Number(everyWeeks)),'Repeat every 1, 2, or 4 weeks.');
    const dates=[];for(let day=first;day<=last;day=rules.addDays(day,Number(everyWeeks)*7)){dates.push(day);assert(dates.length<=52,'A series can contain up to 52 shifts.');}return dates;
  }
  function caregiverBriefs(data,first,last) {
    const rows=occurrences(data,first,last);
    const warnings=rules.getWarnings(model(data),first,last);
    return {
      first,last,
      assignedHours:rows.filter(row=>row.caregiverId!=='Open').reduce((sum,row)=>sum+row.hours,0),
      openShifts:rows.filter(row=>row.caregiverId==='Open').length,
      people:data.caregivers.map(person=>{
        const shifts=rows.filter(row=>row.caregiverId===person.id).sort((a,b)=>a.start-b.start||a.shiftName.localeCompare(b.shiftName));
        return {
          id:person.id,name:person.name,shifts,
          hours:shifts.reduce((sum,row)=>sum+row.hours,0),
          days:new Set(shifts.map(row=>row.dayKey)).size,
          weeklyLimit:data.caregiverMaxHours[person.id],
          warnings:warnings.filter(warning=>warning.caregiverId===person.id),
        };
      }),
    };
  }
  return {validateBackup,templates,model,occurrences,coverageGaps,recurrence,validTime,caregiverBriefs};
});
