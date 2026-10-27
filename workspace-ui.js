/* Accessible local workspace tools. Team access is implemented in team.js. */
const workspaceFilters = {search:'',status:'all',date:''};
function refreshWorkspace() {
  updateCustomShiftVisibility(); updatePickerVisibility(); renderShiftList(); renderCaregiverList();
  renderShiftTimeList(); renderSchedule(); updateWeekDisplay(); updateMonthDisplay();
  const careEnabled=document.querySelector('#care-required-enabled');
  if(careEnabled){careEnabled.checked=workspaceState.care.enabled;document.querySelector('#care-required-start').value=workspaceState.care.start;document.querySelector('#care-required-end').value=workspaceState.care.end;document.querySelector('#care-required-count').value=workspaceState.care.count;}
}
function selectedDays() { return scheduleViewSelect.value === 'monthly' ? getDaysInSelectedMonth() : getDaysInSelectedWeek(); }
function visibleOccurrences() {
  const days=selectedDays(), data=getWorkspaceSnapshot();
  return CuravelaWorkspace.occurrences(data,days[0].key,days[days.length-1].key);
}
function renderAgendaSchedule(days) {
  scheduleSection.className='agenda-schedule'; scheduleSection.replaceChildren();
  const rows=CuravelaWorkspace.occurrences(getWorkspaceSnapshot(),days[0].key,days[days.length-1].key);
  const warnings=getCaregiverRuleWarnings(days,getActiveShifts());
  let total=0;
  days.forEach(day=>{
    const list=rows.filter(row=>{
      const person=getCaregiverById(row.caregiverId), warning=warnings.some(w=>w.keys.includes(row.key));
      return row.dayKey===day.key && (!workspaceFilters.date||row.dayKey===workspaceFilters.date) &&
        (workspaceFilters.status!=='open'||row.caregiverId==='Open') && (workspaceFilters.status!=='conflicts'||warning) &&
        (!workspaceFilters.search||(row.shiftName+' '+(person?person.name:'Open')).toLowerCase().includes(workspaceFilters.search));
    });
    if(!list.length)return;
    const section=document.createElement('section');section.className='agenda-day';
    const title=document.createElement('h3');title.textContent=day.label;section.append(title);
    list.forEach(row=>{
      total++;const card=document.createElement('article');card.className='agenda-card '+(row.caregiverId==='Open'?'coverage-open':'coverage-covered');
      const text=document.createElement('div'); const name=document.createElement('strong');
      name.textContent=row.shiftName+' · '+(row.caregiverId==='Open'?'Open shift':getCaregiverName(row.caregiverId));
      const time=document.createElement('span');time.textContent=formatTime(row.startTime)+'–'+formatTime(row.endTime)+(row.endTime<=row.startTime?' · ends next day':'');
      text.append(name,time);
      if(row.note){const note=document.createElement('span');note.className='shift-note';note.textContent=row.note;text.append(note);}
      warnings.filter(w=>w.keys.includes(row.key)).forEach(w=>{const note=document.createElement('span');note.className='is-conflict';note.textContent=w.text;text.append(note);});
      const edit=document.createElement('button');edit.type='button';edit.className='edit-occurrence-button';edit.dataset.day=row.dayKey;edit.dataset.shift=row.shiftName;edit.textContent='Edit shift';edit.setAttribute('aria-label','Edit '+row.shiftName+' on '+day.key);
      card.append(text,edit);section.append(card);
    });scheduleSection.append(section);
  });
  if(!total){const empty=document.createElement('p');empty.textContent='No shifts match these filters.';scheduleSection.append(empty);}
}
function commitScheduleBatch(data, keys, label) {
  const dates=keys.map(k=>k.slice(0,10)).sort();
  const warnings=CuravelaScheduling.getWarnings(CuravelaWorkspace.model(data),dates[0],dates[dates.length-1]);
  const related=warnings.filter(w=>w.keys.length?w.keys.some(k=>keys.includes(k)):w.code!=='near-hours');
  if(related.some(w=>w.blocking))throw new Error(related.filter(w=>w.blocking).map(w=>w.text).join('\n'));
  if(related.length&&!confirm(related.map(w=>w.text).join('\n')+'\n\nSave despite these rule warnings?'))return false;
  applyWorkspaceSnapshot(data);saveData(label);refreshWorkspace();return true;
}
function createShiftSeries(options) {
  const data=CuravelaWorkspace.validateBackup(getWorkspaceSnapshot());
  const dates=options.repeat?CuravelaWorkspace.recurrence(options.date,options.until,Number(options.repeat)):[options.date];
  if(!CuravelaScheduling.interval(options.date,options.start,options.end))throw new Error('Choose a valid date and shift times.');
  if(options.caregiver!=='Open'&&!caregiverIdExists(options.caregiver))throw new Error('Choose an existing caregiver.');
  if(!options.name.trim()||options.name.length>120)throw new Error('Enter a shift name of up to 120 characters.');
  const keys=[];let replace=0;
  dates.forEach(date=>{
    const key=date+'-'+options.name;
    if(options.additional){
      if(getShiftsForDay(date).some(s=>s.name===options.name))throw new Error('A shift named '+options.name+' already exists on '+date+'. Choose another name.');
      data.workspace.extraShifts.push({dayKey:date,name:options.name,start:options.start,end:options.end});
    }
    if(data.scheduleAssignments[key]&&data.scheduleAssignments[key]!=='Open')replace++;
    data.scheduleAssignments[key]=options.caregiver;data.shiftTimeOverrides[date+'__'+options.name]={start:options.start,end:options.end};keys.push(key);
  });
  if(replace&&!confirm('Replace '+replace+' existing assignment(s)? You can undo this entire action.'))return false;
  data.workspace.series=data.workspace.series.map(series=>({...series,keys:series.keys.filter(key=>!keys.includes(key))})).filter(series=>series.keys.length);
  if(dates.length>1)data.workspace.series.push({id:createStableId('series'),keys});
  return commitScheduleBatch(data,keys,dates.length>1?'create recurring shifts':'add dated shift');
}
function commitFutureSeries(proposal, reportError) {
  try {
    const data=CuravelaWorkspace.validateBackup(getWorkspaceSnapshot());
    const series=data.workspace.series.find(s=>s.keys.includes(proposal.sourceKey));
    if(!series)throw new Error('This shift is not part of a saved recurring series.');
    if(proposal.dayKey!==proposal.sourceKey.slice(0,10))throw new Error('For future-series edits, keep this date. Move individual occurrences separately.');
    const keys=series.keys.filter(k=>k.slice(0,10)>=proposal.dayKey);
    keys.forEach(key=>{data.scheduleAssignments[key]=proposal.caregiverId;data.shiftTimeOverrides[key.slice(0,10)+'__'+key.slice(11)]={start:proposal.start,end:proposal.end};if(proposal.note!==undefined){if(proposal.note.trim())data.workspace.shiftNotes[key]=proposal.note.trim();else delete data.workspace.shiftNotes[key];}});
    return commitScheduleBatch(data,keys,'edit future recurring shifts');
  }catch(error){reportError(error.message);return false;}
}
function splitOccurrence(dayKey,name,splitTime) {
  const data=CuravelaWorkspace.validateBackup(getWorkspaceSnapshot());
  const template=getShiftsForDay(dayKey).find(s=>s.name===name), times=getShiftForDay(dayKey,template);
  const span=CuravelaScheduling.interval(dayKey,times.start,times.end);
  if(!CuravelaWorkspace.validTime(splitTime))throw new Error('Choose the time where this shift should split.');
  let split=CuravelaScheduling.interval(dayKey,splitTime,splitTime).start;
  if(split<span.start)split+=1440;
  if(split<=span.start||split>=span.end)throw new Error('The split must fall inside the shift.');
  const date=new Date(split*60000).toISOString().slice(0,10),secondName=name+' (part 2)';
  if(getShiftsForDay(date).some(s=>s.name===secondName))throw new Error('A second part already exists on that date.');
  data.shiftTimeOverrides[dayKey+'__'+name]={start:times.start,end:splitTime};
  data.workspace.extraShifts.push({dayKey:date,name:secondName,start:splitTime,end:times.end});
  data.scheduleAssignments[date+'-'+secondName]=data.scheduleAssignments[dayKey+'-'+name]||'Open';
  if(data.workspace.shiftNotes[dayKey+'-'+name])data.workspace.shiftNotes[date+'-'+secondName]=data.workspace.shiftNotes[dayKey+'-'+name];
  return commitScheduleBatch(data,[dayKey+'-'+name,date+'-'+secondName],'split shift');
}
function exportTextFile(name,text,type) {
  const url=URL.createObjectURL(new Blob([text],{type:type||'text/plain'}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function csvCell(value) { const text=String(value);return '"'+(/^[=+@\-\t\r]/.test(text)?"'":'')+text.replace(/"/g,'""')+'"'; }
function formatWallMinute(minute) { const date=new Date(minute*60000).toISOString();return date.slice(0,10)+' '+date.slice(11,16); }
function renderWorkspaceExtras() {
  const panel=document.querySelector('#report-content');if(!panel)return;
  const days=selectedDays(),data=getWorkspaceSnapshot(),rows=visibleOccurrences();
  const warnings=getCaregiverRuleWarnings(days,getActiveShifts());
  const gaps=CuravelaWorkspace.coverageGaps(data,days[0].key,days[days.length-1].key);
  const total=rows.reduce((sum,row)=>sum+row.hours,0),open=rows.filter(r=>r.caregiverId==='Open').reduce((sum,row)=>sum+row.hours,0);
  panel.innerHTML='<p>'+escapeHTML(days[0].key+' – '+days[days.length-1].key)+'</p><p><strong>'+formatHours(total-open)+'</strong> assigned · <strong>'+formatHours(open)+'</strong> open · '+warnings.length+' warnings</p>';
  const table=document.createElement('table');table.innerHTML='<caption>Scheduled hours by caregiver</caption><thead><tr><th scope="col">Caregiver</th><th scope="col">Hours</th></tr></thead><tbody>'+caregivers.map(c=>'<tr><th scope="row">'+escapeHTML(c.name)+'</th><td>'+formatHours(rows.filter(r=>r.caregiverId===c.id).reduce((sum,r)=>sum+r.hours,0))+'</td></tr>').join('')+'</tbody>';
  panel.append(table);
  const gapPanel=document.querySelector('#care-gap-results');gapPanel.replaceChildren();
  const heading=document.createElement('p');heading.textContent=data.workspace.care.enabled?(gaps.length?gaps.length+' uncovered care interval(s).':'The required care intervals have enough assigned, available caregivers.'):'Set required care hours in Reports to measure gaps between shifts.';gapPanel.append(heading);
  gaps.slice(0,100).forEach(gap=>{const p=document.createElement('p');p.textContent=formatWallMinute(gap.start)+' – '+formatWallMinute(gap.end)+' · needs '+gap.missing+' more caregiver(s)';gapPanel.append(p);});
  const history=document.querySelector('#workspace-history');history.replaceChildren();
  [...workspaceState.history].reverse().slice(0,50).forEach(entry=>{const li=document.createElement('li');li.textContent=new Date(entry.at).toLocaleString()+' · '+entry.actor+' · '+entry.action;if(typeof appendChangeDetails==='function')appendChangeDetails(li,entry.changes||[],entry.changeCount);history.append(li);});
  const checklist=document.querySelector('#setup-progress');checklist.textContent=(caregivers.length?'✓ Caregivers added':'1. Add caregivers')+' · '+(Object.values(scheduleAssignments).some(id=>id!=='Open')?'✓ First shift assigned':'2. Assign a shift')+' · '+(workspaceState.care.enabled?'✓ Care requirements set':'3. Set required care hours in Reports');
}
(function initializeWorkspaceUI(){
  const main=document.querySelector('.main-content');
  const headline=document.querySelector('.hero-copy');
  let headlineHidden=false,scrollFrame=0;
  function updateHeadline(){
    scrollFrame=0;
    const distance=Math.max(window.scrollY||0,main.scrollTop||0);
    if(distance>24)headlineHidden=true;
    else if(distance<=2)headlineHidden=false;
    document.documentElement.classList.toggle('headline-collapsed',headlineHidden);
    main.classList.toggle('headline-scrolled',headlineHidden);
    if(headline)headline.setAttribute('aria-hidden',String(headlineHidden));
  }
  function queueHeadlineUpdate(){if(!scrollFrame)scrollFrame=window.requestAnimationFrame(updateHeadline);}
  window.addEventListener('scroll',queueHeadlineUpdate,{passive:true});
  main.addEventListener('scroll',queueHeadlineUpdate,{passive:true});
  updateHeadline();
  const tools=document.createElement('div');tools.className='workspace-tools';tools.id='schedule-filters';
  tools.innerHTML='<label class="schedule-search-field"><span class="schedule-control-label">Search this week</span><input id="schedule-search" type="search" placeholder="Caregiver or shift name" /></label><details class="schedule-filter-options"><summary>Filters</summary><div class="schedule-filter-fields"><label>Show<select id="schedule-status-filter"><option value="all">All shifts</option><option value="open">Open shifts</option><option value="conflicts">Conflicts</option></select></label><label>Specific date<input id="schedule-date-filter" type="date" /></label><button id="clear-schedule-filters" type="button">Clear filters</button></div></details><button id="open-batch-shifts" type="button">Add / repeat shifts</button>';
  document.querySelector('#schedule-area').insertBefore(tools,document.querySelector('#schedule'));
  ['schedule-search','schedule-status-filter','schedule-date-filter'].forEach(id=>document.querySelector('#'+id).addEventListener(id==='schedule-search'?'input':'change',()=>{workspaceFilters.search=document.querySelector('#schedule-search').value.trim().toLowerCase();workspaceFilters.status=document.querySelector('#schedule-status-filter').value;workspaceFilters.date=document.querySelector('#schedule-date-filter').value;if(workspaceFilters.date)weekStartDateInput.value=workspaceFilters.date;scheduleViewSelect.value='agenda';updatePickerVisibility();renderSchedule();}));
  document.querySelector('#clear-schedule-filters').addEventListener('click',()=>{workspaceFilters.search='';workspaceFilters.status='all';workspaceFilters.date='';document.querySelector('#schedule-search').value='';document.querySelector('#schedule-status-filter').value='all';document.querySelector('#schedule-date-filter').value='';renderSchedule();});
  const reports=document.createElement('section');reports.id='reports-workspace-panel';reports.className='workspace-panel';reports.hidden=true;
  reports.innerHTML='<h2>Schedule reports</h2><p>Uses the date range selected in Schedule. Hours are planned wall-clock hours, not payroll or attendance.</p><div id="report-content"></div><div class="workspace-tools"><button id="export-schedule-csv">Export schedule CSV</button><button id="print-report">Print report</button></div><h3>Required care coverage</h3><form id="care-requirements-form" class="workspace-form"><label class="checkbox-label"><input id="care-required-enabled" type="checkbox" />Measure care gaps every day</label><label>Care starts<input id="care-required-start" type="time" required value="00:00" /></label><label>Care ends<input id="care-required-end" type="time" required value="00:00" /></label><label>Caregivers required at once<input id="care-required-count" type="number" min="1" max="20" value="1" required /></label><p>Equal start and end times mean 24-hour care. Overnight intervals include the following day.</p><button>Save care requirements</button></form><div id="care-gap-results" role="status"></div><details><summary>Local change history</summary><ul id="workspace-history"></ul></details>';
  main.append(reports);
  document.querySelector('#care-required-enabled').checked=workspaceState.care.enabled;document.querySelector('#care-required-start').value=workspaceState.care.start;document.querySelector('#care-required-end').value=workspaceState.care.end;document.querySelector('#care-required-count').value=workspaceState.care.count;
  document.querySelector('#care-requirements-form').addEventListener('submit',event=>{event.preventDefault();workspaceState.care={enabled:document.querySelector('#care-required-enabled').checked,start:document.querySelector('#care-required-start').value,end:document.querySelector('#care-required-end').value,count:Number(document.querySelector('#care-required-count').value)};saveData('care requirements');renderWorkspaceExtras();});
  document.querySelector('#export-schedule-csv').addEventListener('click',()=>{const rows=[['Date','Shift','Starts','Ends','Caregiver','Scheduled hours'],...visibleOccurrences().map(r=>[r.dayKey,r.shiftName,r.startTime,r.endTime,r.caregiverId==='Open'?'Open':getCaregiverName(r.caregiverId),r.hours])];exportTextFile('curavela-schedule.csv',rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv');});
  document.querySelector('#print-report').addEventListener('click',()=>window.print());
  const help=document.createElement('section');help.id='help-workspace-panel';help.className='workspace-panel';help.hidden=true;
  help.innerHTML='<h2>Help & getting started</h2><p id="setup-progress" class="setup-banner"></p><ol class="help-steps"><li><strong>Build your team.</strong> Open Caregivers, add names, then use Manage for hour limits, rules, and time off.</li><li><strong>Plan coverage.</strong> Choose Schedule Shift for an existing slot, or Add / repeat shifts for additional or recurring shifts. Set actual required care hours in Reports.</li><li><strong>Check warnings.</strong> Overlaps and dated time off block assignments. Other preferences can be overridden explicitly. Review shift opens the affected assignment.</li><li><strong>Use your phone.</strong> Agenda shows readable shift cards. Filters search the selected week. Weekly and Monthly retain scrollable calendars.</li><li><strong>Keep a backup.</strong> More → Export Backup downloads your workspace. Import validates the file and asks before replacement. Undo lasts until reload. Reports keeps change details and up to 10 local recovery copies; export backups for long-term recovery.</li><li><strong>Share with your team.</strong> Team requires the hosted server. Local mode stays on this browser and does not send invitations, sync, or deliver alerts.</li></ol><div class="workspace-tools"><button id="restore-preimport">Restore pre-import copy</button><button id="download-diagnostics">Download support details</button><button id="load-sample-data">Try sample data</button></div><p>Support details include the app version, browser, and screen size—not names, schedules, or notes. Review the file before attaching it to a support request.</p><p><a href="https://github.com/brggt/curavela_v2_files/issues" target="_blank" rel="noopener noreferrer">Report a problem on GitHub</a> — describe the steps, expected result, and what happened. Avoid including private care information in public issues.</p><details><summary>What changed in version 3</summary><p>Agenda and accessible controls; time off; additional, split, and recurring shifts; care-gap reports; validated backups; local history; optional server-backed team workflows.</p></details><p>Known limits: recurrence supports weekly intervals; real iPhone/iPad and VoiceOver verification is pending. Scheduled hours are not actual hours worked.</p>';
  main.append(help);
  document.querySelector('#download-diagnostics').addEventListener('click',()=>exportTextFile('curavela-support.json',JSON.stringify({app:'Curavela',version:'3.1.0',browser:navigator.userAgent,viewport:{width:window.innerWidth,height:window.innerHeight},online:navigator.onLine,time:new Date().toISOString()},null,2),'application/json'));
  document.querySelector('#restore-preimport').addEventListener('click',()=>{try{const saved=localStorage.getItem('curavelaBeforeImport');if(!saved)throw new Error('No recovery copy is available.');const data=CuravelaWorkspace.validateBackup(JSON.parse(saved));if(!confirm('Restore the workspace saved before your last import?'))return;applyWorkspaceSnapshot(data);saveData('restore backup');resetScheduleHistory();refreshWorkspace();}catch(e){showScheduleNotice(e.message,true);}});
  document.querySelector('#load-sample-data').addEventListener('click',()=>{if(caregivers.length||Object.keys(scheduleAssignments).length){showScheduleNotice('Open Curavela in a private window to try sample data without replacing your workspace.',true);return;}caregivers=[{id:'sample-alex',name:'Alex (sample)'},{id:'sample-sam',name:'Sam (sample)'}];caregivers.forEach(c=>{caregiverRules[c.id]=getDefaultCaregiverRules();caregiverMaxHours[c.id]=40;});scheduleAssignments[getTodayDateValue()+'-Morning']='sample-alex';saveData('add sample data');refreshWorkspace();setAppView('schedule');});
  const batch=document.createElement('div');batch.id='batch-shifts-modal';batch.className='modal-backdrop hidden';batch.setAttribute('role','dialog');batch.setAttribute('aria-modal','true');batch.setAttribute('aria-labelledby','batch-title');
  batch.innerHTML='<form id="batch-shifts-form" class="modal-card workspace-form"><h2 id="batch-title">Add or repeat shifts</h2><label>Type<select id="batch-kind"><option value="additional">Additional dated shift</option><option value="template">Existing template</option></select></label><label id="batch-name-label">Shift name<input id="batch-name" maxlength="120" value="Additional care" /></label><label id="batch-template-label" hidden>Template<select id="batch-template"></select></label><label>First date<input id="batch-date" type="date" required /></label><label>Caregiver<select id="batch-caregiver"></select></label><div class="occurrence-fields"><label>Starts<input id="batch-start" type="time" value="09:00" required /></label><label>Ends<input id="batch-end" type="time" value="17:00" required /></label></div><label>Repeat<select id="batch-repeat"><option value="">Does not repeat</option><option value="1">Every week</option><option value="2">Every 2 weeks</option><option value="4">Every 4 weeks</option></select></label><label>Repeat through<input id="batch-until" type="date" /></label><p id="batch-error" role="alert" class="workspace-error"></p><div class="modal-actions"><button type="button" id="cancel-batch">Cancel</button><button type="submit">Save shifts</button></div></form>';
  document.body.append(batch);
  document.querySelector('#open-batch-shifts').addEventListener('click',()=>{document.querySelector('#batch-template').innerHTML=getActiveShifts().map(s=>'<option>'+escapeHTML(s.name)+'</option>').join('');document.querySelector('#batch-caregiver').innerHTML=buildCaregiverOptions('Open');document.querySelector('#batch-date').value=getTodayDateValue();document.querySelector('#batch-error').textContent='';openManagedDialog(batch);});
  document.querySelector('#batch-kind').addEventListener('change',()=>{const additional=document.querySelector('#batch-kind').value==='additional';document.querySelector('#batch-name-label').hidden=!additional;document.querySelector('#batch-template-label').hidden=additional;});
  document.querySelector('#cancel-batch').addEventListener('click',()=>closeManagedDialog(batch));
  batch.addEventListener('click',event=>{if(event.target===batch)closeManagedDialog(batch);});
  document.querySelector('#batch-shifts-form').addEventListener('submit',event=>{event.preventDefault();try{if(createShiftSeries({date:document.querySelector('#batch-date').value,name:document.querySelector('#batch-kind').value==='additional'?document.querySelector('#batch-name').value.trim():document.querySelector('#batch-template').value,additional:document.querySelector('#batch-kind').value==='additional',caregiver:document.querySelector('#batch-caregiver').value,start:document.querySelector('#batch-start').value,end:document.querySelector('#batch-end').value,repeat:document.querySelector('#batch-repeat').value,until:document.querySelector('#batch-until').value}))closeManagedDialog(batch);}catch(e){document.querySelector('#batch-error').textContent=e.message;}});
  const scope=document.createElement('label');scope.textContent='Apply changes to';const select=document.createElement('select');select.id='occurrence-scope';select.innerHTML='<option value="one">This occurrence</option><option value="future">This and future shifts in its series</option>';scope.append(select);document.querySelector('.occurrence-fields').append(scope);
  const split=document.createElement('div');split.className='workspace-tools';split.innerHTML='<label>Split existing shift at<input id="split-occurrence-time" type="time" /></label><button type="button" id="split-occurrence-button">Split shift</button>';occurrenceForm.insertBefore(split,document.querySelector('#occurrence-error'));
  document.querySelector('#split-occurrence-button').addEventListener('click',()=>{try{if(!occurrenceSourceKey)throw new Error('Open an existing shift with Edit shift before splitting.');if(splitOccurrence(occurrenceSourceKey.slice(0,10),occurrenceSourceKey.slice(11),document.querySelector('#split-occurrence-time').value))closeManagedDialog(occurrenceModal);}catch(e){occurrenceError.textContent=e.message;}});
  if(!localStorage.getItem('curavelaWorkspaceV6')&&window.matchMedia('(max-width: 700px)').matches)scheduleViewSelect.value='agenda';
  window.addEventListener('offline',()=>showScheduleNotice('Offline. Local edits can continue; team changes cannot sync until reconnected.',true));
  window.addEventListener('online',()=>showScheduleNotice('Connection restored. Check Team for unsynced changes.'));
  refreshWorkspace();
})();
