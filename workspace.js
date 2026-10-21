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
    assert(!input.version || (Number.isInteger(input.version) && input.version <= 7), 'This backup needs a newer Curavela version.');
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
      // Dated shifts that become templates are reconciled below without losing their times.
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
    const notes=extra.shiftNotes || {};
    assert(object(notes) && Object.keys(notes).length<=30000,'Shift notes are invalid.');
    Object.entries(notes).forEach(([key,note])=>assert(Number.isFinite(rules.dateNumber(key.slice(0,10)))&&key[10]==='-'&&key.length>11&&typeof note==='string'&&note.length<=2000,'A shift note is invalid or longer than 2,000 characters.'));
    // Recover legacy assignments hidden by a previous template-style change.
    const datedKeys=new Set([...Object.keys(assignments),...Object.keys(notes),...Object.keys(overrides).map(k=>k.slice(0,10)+'-'+k.slice(12))]);
    for(const key of datedKeys) {
      const name=key.slice(11),dayKey=key.slice(0,10);
      if(activeNames.includes(name)||unique.has(key))continue;
      const time=overrides[dayKey+'__'+name]||times[name];
      assert(time,'A saved shift has no known times: '+key+'. Restore its template times before importing.');
      assert(extraShifts.length<20000,'Too many additional shifts.');
      extraShifts.push({dayKey,name,start:time.start,end:time.end});unique.add(key);
    }
    const dated=extraShifts.filter(shift=>{
      if(!activeNames.includes(shift.name))return true;
      const key=shift.dayKey+'__'+shift.name;
      if(!overrides[key])overrides[key]={start:shift.start,end:shift.end};
      return false;
    });
    const patterns=extra.patterns||[];
    assert(Array.isArray(patterns)&&patterns.length<=30,'Save up to 30 schedule patterns.');
    const patternIds=new Set();
    patterns.forEach(pattern=>{
      assert(object(pattern)&&typeof pattern.id==='string'&&pattern.id.length<=200&&!patternIds.has(pattern.id)&&typeof pattern.name==='string'&&pattern.name.trim()&&pattern.name.length<=100&&[7,14,28].includes(pattern.days),'A saved pattern is invalid.');
      patternIds.add(pattern.id);
      assert(Array.isArray(pattern.rows)&&pattern.rows.length<=3000,'A saved pattern has too many shifts.');
      const keys=new Set();
      pattern.rows.forEach(row=>{
        assert(object(row)&&Number.isInteger(row.offset)&&row.offset>=0&&row.offset<pattern.days&&typeof row.shiftName==='string'&&row.shiftName.trim()&&row.shiftName.length<=120&&validTime(row.start)&&validTime(row.end)&&typeof row.caregiverId==='string'&&typeof (row.note||'')==='string'&&(row.note||'').length<=2000,'A saved pattern shift is invalid.');
        const key=row.offset+'-'+row.shiftName;assert(!keys.has(key),'A pattern contains duplicate shifts.');keys.add(key);
      });
    });
    const calendarTimeZone=extra.calendarTimeZone||'';
    assert(typeof calendarTimeZone==='string'&&calendarTimeZone.length<=100,'Calendar time zone is invalid.');
    if(calendarTimeZone){try{new Intl.DateTimeFormat('en',{timeZone:calendarTimeZone});}catch{throw new Error('Choose a valid IANA calendar time zone.');}}
    const cgRules={}, maxHours={};
    people.forEach(p=>{
      const r=p.rules || (input.caregiverRules||{})[p.id] || (input.caregiverRules||{})[p.name] || {};
      assert(object(r),'Caregiver rules are invalid.');
      const days=r.availableDays || weekdays;
      const windows=r.availabilityWindows||{};
      assert(object(windows)&&Object.entries(windows).every(([day,w])=>weekdays.includes(day)&&object(w)&&validTime(w.start)&&validTime(w.end)),'Available time windows are invalid.');
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
    return {app:'Curavela',version:7,customShifts:custom,caregivers:people.map(p=>({id:p.id,name:p.name})),caregiverMaxHours:maxHours,caregiverRules:cgRules,scheduleAssignments:assignments,shiftTimes:times,shiftTimeOverrides:overrides,scheduleBriefs:object(input.scheduleBriefs)?input.scheduleBriefs:{},shiftStyle:style,weekStart,scheduleView:['weekly','monthly','agenda'].includes(input.scheduleView)?input.scheduleView:'weekly',month:/^\d{4}-\d{2}$/.test(input.month||'')?input.month:'',weekStartDate:Number.isFinite(rules.dateNumber(input.weekStartDate))?input.weekStartDate:'',workspace:{extraShifts:dated,series,care,shiftNotes:notes,patterns,calendarTimeZone,history:Array.isArray(extra.history)?extra.history.slice(-200):[]}};
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
        result.push({key,dayKey:date,shiftName:s.name,startTime:t.start,endTime:t.end,caregiverId:data.scheduleAssignments[key]||'Open',note:data.workspace.shiftNotes?.[key]||'',...span});
      });
    }
    return result;
  }
  function coverageGaps(data,first,last) {
    if(!data.workspace.care.enabled)return [];
    const care=data.workspace.care;
    const entries=rules.buildEntries(model(data)).filter(e=>!e.invalid).flatMap(entry=>{
      let segments=[entry];
      for(const record of rules.getTimeOffConflicts(data.caregiverRules[entry.caregiverId]||{},entry)){
        const away=rules.timeOffInterval(record);
        segments=segments.flatMap(segment=>{
          if(segment.end<=away.start||segment.start>=away.end)return [segment];
          const available=[];
          if(segment.start<away.start)available.push({...segment,end:away.start});
          if(segment.end>away.end)available.push({...segment,start:away.end});
          return available;
        });
      }
      return segments;
    });
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
  // Template changes preserve all explicitly dated work, including open shifts and notes.
  function changeStyle(input,style) {
    const data=validateBackup(input), before=templates(data);
    data.shiftStyle=style;
    const active=new Set(templates(data).map(s=>s.name));
    const names=new Map(before.map(s=>[s.name,s]));
    const keys=new Set([...Object.keys(data.scheduleAssignments),...Object.keys(data.workspace.shiftNotes),...Object.keys(data.shiftTimeOverrides).map(k=>k.slice(0,10)+'-'+k.slice(12))]);
    for(const key of keys){
      const name=key.slice(11),dayKey=key.slice(0,10);
      if(active.has(name)||data.workspace.extraShifts.some(s=>s.dayKey+'-'+s.name===key))continue;
      const time=data.shiftTimeOverrides[dayKey+'__'+name]||names.get(name)||data.shiftTimes[name];
      if(time)data.workspace.extraShifts.push({dayKey,name,start:time.start,end:time.end});
    }
    return validateBackup(data);
  }
  function capturePattern(input,first,days,name,id) {
    assert([7,14,28].includes(days)&&Number.isFinite(rules.dateNumber(first)),'Choose 1, 2, or 4 weeks starting on a valid date.');
    return {id,name,days,rows:occurrences(input,first,rules.addDays(first,days-1)).map(s=>({offset:(rules.dateNumber(s.dayKey)-rules.dateNumber(first))/1440,shiftName:s.shiftName,start:s.startTime,end:s.endTime,caregiverId:s.caregiverId,note:s.note||''}))};
  }
  function applyPattern(input,pattern,first,cycles=1) {
    assert(Number.isFinite(rules.dateNumber(first))&&Number.isInteger(cycles)&&cycles>=1&&cycles<=12,'Choose a start date and 1–12 cycles.');
    const check=validateBackup({...input,workspace:{...input.workspace,patterns:[pattern]}}), data=validateBackup(input);
    pattern=check.workspace.patterns[0];
    const active=new Set(templates(data).map(s=>s.name)),people=new Set(data.caregivers.map(p=>p.id));
    const keys=[],missing=new Set();let replaced=0;
    for(let cycle=0;cycle<cycles;cycle++)for(const row of pattern.rows){
      const dayKey=rules.addDays(first,cycle*pattern.days+row.offset),key=dayKey+'-'+row.shiftName;
      const existing=data.scheduleAssignments[key];if(existing&&existing!=='Open')replaced++;
      if(!active.has(row.shiftName)&&!data.workspace.extraShifts.some(s=>s.dayKey+'-'+s.name===key))data.workspace.extraShifts.push({dayKey,name:row.shiftName,start:row.start,end:row.end});
      if(row.caregiverId!=='Open'&&!people.has(row.caregiverId))missing.add(row.caregiverId);
      data.scheduleAssignments[key]=people.has(row.caregiverId)?row.caregiverId:'Open';
      data.shiftTimeOverrides[dayKey+'__'+row.shiftName]={start:row.start,end:row.end};
      if(row.note)data.workspace.shiftNotes[key]=row.note;else delete data.workspace.shiftNotes[key];
      keys.push(key);
    }
    // Applied slots are independent of a previous recurring series.
    const changed=new Set(keys);
    data.workspace.series=data.workspace.series.map(s=>({...s,keys:s.keys.filter(k=>!changed.has(k))})).filter(s=>s.keys.length);
    return {data:validateBackup(data),keys,replaced,missing:[...missing],first,last:rules.addDays(first,pattern.days*cycles-1)};
  }
  function changes(before,after) {
    if(!before)return [{type:'workspace',text:'Created the first saved workspace.'}];
    const keys=new Set([...Object.keys(before.scheduleAssignments),...Object.keys(after.scheduleAssignments),...Object.keys(before.shiftTimeOverrides).map(k=>k.slice(0,10)+'-'+k.slice(12)),...Object.keys(after.shiftTimeOverrides).map(k=>k.slice(0,10)+'-'+k.slice(12)),...Object.keys(before.workspace.shiftNotes||{}),...Object.keys(after.workspace.shiftNotes||{}),...before.workspace.extraShifts.map(s=>s.dayKey+'-'+s.name),...after.workspace.extraShifts.map(s=>s.dayKey+'-'+s.name)]);
    const describe=(data,key)=>{
      const day=key.slice(0,10),name=key.slice(11),template=templates(data).find(s=>s.name===name)||data.workspace.extraShifts.find(s=>s.dayKey===day&&s.name===name);
      if(!template)return null;
      const time=data.shiftTimeOverrides[day+'__'+name]||template,id=data.scheduleAssignments[key]||'Open';
      return {caregiver:id==='Open'?'Open':data.caregivers.find(p=>p.id===id)?.name||id,start:time.start,end:time.end,note:data.workspace.shiftNotes?.[key]||''};
    };
    const result=[];
    for(const key of [...keys].sort()){const a=describe(before,key),b=describe(after,key);if(JSON.stringify(a)!==JSON.stringify(b))result.push({type:'shift',key,before:a,after:b});}
    if(before.shiftStyle!==after.shiftStyle)result.push({type:'settings',text:'Shift style: '+before.shiftStyle+' → '+after.shiftStyle});
    for(const field of ['caregivers','caregiverRules','caregiverMaxHours','shiftTimes','customShifts'])if(JSON.stringify(before[field])!==JSON.stringify(after[field]))result.push({type:'settings',text:({caregivers:'Caregiver profiles',caregiverRules:'Availability, time off or caregiver rules',caregiverMaxHours:'Weekly hour limits',shiftTimes:'Template times',customShifts:'Custom templates'})[field]+' changed.'});
    for(const field of ['patterns','care','calendarTimeZone'])if(JSON.stringify(before.workspace[field])!==JSON.stringify(after.workspace[field]))result.push({type:'settings',text:({patterns:'Saved patterns',care:'Required care coverage',calendarTimeZone:'Calendar time zone'})[field]+' changed.'});
    return result;
  }
  return {validateBackup,templates,model,occurrences,coverageGaps,recurrence,validTime,caregiverBriefs,changeStyle,capturePattern,applyPattern,changes};
});
