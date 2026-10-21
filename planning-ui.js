/* Patterns, readable recovery, and local calendar export. Uses the existing dialogs. */
function appendChangeDetails(container,changes,total) {
  if(!changes.length)return;
  const details=document.createElement('details'),summary=document.createElement('summary');
  summary.textContent=(total||changes.length)+' change(s)';details.append(summary);
  const list=document.createElement('ul');
  changes.slice(0,100).forEach(change=>{
    const item=document.createElement('li');
    const describe=value=>value?value.caregiver+' · '+value.start+'–'+value.end:'No shift';
    item.textContent=change.type==='shift'?change.key+': '+describe(change.before)+' → '+describe(change.after):change.text;
    if(change.type==='shift'&&(change.before?.note||'')!==(change.after?.note||'')){
      const note=document.createElement('p');note.className='shift-note';note.textContent='Notes: '+(change.before?.note||'(none)')+' → '+(change.after?.note||'(none)');item.append(note);
    }
    list.append(item);
  });
  details.append(list);
  if(total>100){const p=document.createElement('p');p.textContent='Showing the first 100 changes. Export a backup to inspect the full schedule.';details.append(p);}
  container.append(details);
}
function renderAvailabilityWindows(rules) {
  const container=document.querySelector('#availability-windows');container.replaceChildren();
  allWeekDays.forEach(day=>{
    const row=document.createElement('div');row.className='availability-window';row.dataset.day=day;
    const saved=rules.availabilityWindows?.[day];
    row.innerHTML='<label class="checkbox-label"><input type="checkbox" '+(saved?'checked':'')+' />'+day+'</label><label>From<input type="time" data-bound="start" aria-label="'+day+' available from" /></label><label>Until<input type="time" data-bound="end" aria-label="'+day+' available until" /></label>';
    const checkbox=row.querySelector('input[type=checkbox]'),start=row.querySelector('[data-bound=start]'),end=row.querySelector('[data-bound=end]');
    start.value=saved?.start||'09:00';end.value=saved?.end||'17:00';
    function update(){start.disabled=end.disabled=!checkbox.checked;start.required=end.required=checkbox.checked;}
    checkbox.addEventListener('change',update);update();container.append(row);
  });
}
function readAvailabilityWindows() {
  const windows={};
  for(const row of document.querySelectorAll('.availability-window')){
    if(!row.querySelector('input[type=checkbox]').checked)continue;
    const start=row.querySelector('[data-bound=start]'),end=row.querySelector('[data-bound=end]');
    for(const input of [start,end])if(!input.checkValidity()){input.reportValidity();return null;}
    windows[row.dataset.day]={start:start.value,end:end.value};
  }
  return windows;
}
(function initializePlanningUI(){
  const open=document.createElement('button');open.type='button';open.textContent='Saved patterns';open.id='open-patterns';document.querySelector('#more-actions-menu').prepend(open);
  const modal=document.createElement('div');modal.className='modal-backdrop hidden';modal.id='patterns-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','patterns-title');
  modal.innerHTML='<div class="modal-card workspace-form"><h2 id="patterns-title">Saved schedule patterns</h2><p>Save a standard week or a 2- or 4-week rotation. Applying it replaces matching slots and keeps other shifts. Times, extra shifts and notes travel with the pattern.</p><form id="save-pattern-form" class="workspace-form"><label>Pattern name<input name="name" maxlength="100" required /></label><label>Capture starting<input name="first" type="date" required /></label><label>Length<select name="days"><option value="7">1 week</option><option value="14">2 weeks</option><option value="28">4 weeks</option></select></label><button>Save this pattern</button></form><hr /><form id="apply-pattern-form" class="workspace-form"><label>Saved pattern<select name="pattern" required></select></label><label>Apply starting<input name="first" type="date" required /></label><label>Number of cycles<input name="cycles" type="number" min="1" max="12" value="1" required /></label><div class="workspace-tools"><button>Preview changes</button><button id="delete-pattern" type="button">Delete pattern</button></div></form><div id="pattern-preview" aria-live="polite"></div><p id="pattern-message" role="status"></p><div class="modal-actions"><button type="button" id="close-patterns">Close</button><button type="button" id="confirm-pattern" hidden>Apply previewed changes</button></div></div>';
  document.body.append(modal);
  const save=modal.querySelector('#save-pattern-form'),apply=modal.querySelector('#apply-pattern-form'),preview=modal.querySelector('#pattern-preview'),message=modal.querySelector('#pattern-message'),confirmButton=modal.querySelector('#confirm-pattern');
  let proposal=null,baseline=null;
  function clearPreview(){proposal=null;baseline=null;preview.replaceChildren();confirmButton.hidden=true;}
  function renderPatterns(selected){apply.elements.pattern.replaceChildren();(workspaceState.patterns||[]).forEach(pattern=>{const option=document.createElement('option');option.value=pattern.id;option.textContent=pattern.name+' · '+pattern.days/7+' week(s)';apply.elements.pattern.append(option);});if(selected)apply.elements.pattern.value=selected;apply.querySelector('button').disabled=!(workspaceState.patterns||[]).length;modal.querySelector('#delete-pattern').disabled=!(workspaceState.patterns||[]).length;}
  open.addEventListener('click',()=>{moreActionsMenu.classList.add('hidden');moreActionsButton.setAttribute('aria-expanded','false');clearPreview();message.textContent='';save.elements.first.value=apply.elements.first.value=selectedDays()[0].key;renderPatterns();openManagedDialog(modal);dialogReturnFocus.set(modal,moreActionsButton);});
  modal.querySelector('#close-patterns').addEventListener('click',()=>closeManagedDialog(modal));
  apply.addEventListener('input',clearPreview);
  save.addEventListener('submit',event=>{event.preventDefault();try{
    const data=CuravelaWorkspace.validateBackup(getWorkspaceSnapshot()),pattern=CuravelaWorkspace.capturePattern(data,save.elements.first.value,Number(save.elements.days.value),save.elements.name.value.trim(),createStableId('pattern'));
    data.workspace.patterns.push(pattern);applyWorkspaceSnapshot(CuravelaWorkspace.validateBackup(data));saveData('save schedule pattern');renderPatterns(pattern.id);clearPreview();message.textContent='Pattern saved on this workspace.';
  }catch(error){message.textContent=error.message;}});
  modal.querySelector('#delete-pattern').addEventListener('click',()=>{const pattern=workspaceState.patterns.find(p=>p.id===apply.elements.pattern.value);if(!pattern||!confirm('Delete '+pattern.name+'? Existing scheduled shifts are kept.'))return;workspaceState.patterns=workspaceState.patterns.filter(p=>p.id!==pattern.id);saveData('delete schedule pattern');renderPatterns();clearPreview();message.textContent='Pattern deleted. Undo is available after closing.';});
  apply.addEventListener('submit',event=>{event.preventDefault();clearPreview();try{
    const pattern=workspaceState.patterns.find(p=>p.id===apply.elements.pattern.value);if(!pattern)throw new Error('Save or choose a pattern first.');
    baseline=captureScheduleState();proposal=CuravelaWorkspace.applyPattern(getWorkspaceSnapshot(),pattern,apply.elements.first.value,Number(apply.elements.cycles.value));
    const p=document.createElement('p');p.textContent=proposal.first+'–'+proposal.last+': '+proposal.keys.length+' slots; '+proposal.replaced+' currently assigned slots will be replaced.'+(proposal.missing.length?' '+proposal.missing.length+' removed caregiver(s) will become Open.':'');preview.append(p);
    const changes=CuravelaWorkspace.changes(getWorkspaceSnapshot(),proposal.data);appendChangeDetails(preview,changes,changes.length);
    const warnings=CuravelaScheduling.getWarnings(CuravelaWorkspace.model(proposal.data),proposal.first,proposal.last).filter(w=>w.keys.length?w.keys.some(k=>proposal.keys.includes(k)):w.code!=='near-hours');
    warnings.forEach(w=>{const p=document.createElement('p');p.textContent=w.text;p.className=w.blocking?'workspace-error':'muted';preview.append(p);});
    confirmButton.hidden=warnings.some(w=>w.blocking)||!proposal.keys.length;message.textContent=confirmButton.hidden?'Resolve the conflicts before applying.':'Review these changes, then apply. The entire action can be undone.';
  }catch(error){message.textContent=error.message;}});
  confirmButton.addEventListener('click',()=>{try{if(!proposal||baseline!==captureScheduleState())throw new Error('The schedule changed. Preview again before applying.');if(commitScheduleBatch(proposal.data,proposal.keys,'apply saved pattern')){clearPreview();message.textContent='Pattern applied. Close this window to review the schedule or Undo.';}}catch(error){message.textContent=error.message;}});

  const reports=document.querySelector('#reports-workspace-panel');
  const recovery=document.createElement('details');recovery.innerHTML='<summary>Restore a previous local version</summary><p>Up to 10 copies from before recent edits on this browser. Restoring is a new edit; published team schedules are unchanged. Use Team for server revisions.</p><label>Recovery copy<select id="recovery-copy"></select></label><button type="button" id="preview-recovery">Preview recovery</button><div id="recovery-preview" aria-live="polite"></div><button type="button" id="apply-recovery" hidden>Restore this local copy</button>';
  reports.append(recovery);let restoreCandidate=null,restoreBaseline=null;
  recovery.addEventListener('toggle',()=>{if(!recovery.open)return;const select=recovery.querySelector('select');select.replaceChildren();recovery.querySelector('#apply-recovery').hidden=true;recovery.querySelector('#recovery-preview').replaceChildren();try{const copies=JSON.parse(localStorage.getItem('curavelaRecoveryV1')||'[]');copies.slice().reverse().forEach((copy,i)=>{const option=document.createElement('option');option.value=String(copies.length-1-i);option.textContent=new Date(copy.at).toLocaleString()+' · before '+copy.label;select.append(option);});if(!copies.length)recovery.querySelector('#recovery-preview').textContent='No local recovery copies yet.';}catch{recovery.querySelector('#recovery-preview').textContent='Could not read recovery copies. Your current schedule is unchanged.';}});
  recovery.querySelector('select').addEventListener('change',()=>{restoreCandidate=null;recovery.querySelector('#apply-recovery').hidden=true;recovery.querySelector('#recovery-preview').replaceChildren();});
  recovery.querySelector('#preview-recovery').addEventListener('click',()=>{const output=recovery.querySelector('#recovery-preview');output.replaceChildren();try{
    if(typeof CuravelaTeam!=='undefined'&&CuravelaTeam.isConnected())throw new Error('Use Team revision history to restore a team draft. Sign out to restore local copies.');
    const copy=JSON.parse(localStorage.getItem('curavelaRecoveryV1')||'[]')[Number(recovery.querySelector('select').value)];if(!copy)throw new Error('Choose an available recovery copy.');
    restoreCandidate=CuravelaWorkspace.validateBackup(copy.snapshot);restoreBaseline=captureScheduleState();appendChangeDetails(output,CuravelaWorkspace.changes(getWorkspaceSnapshot(),restoreCandidate));recovery.querySelector('#apply-recovery').hidden=false;
  }catch(error){output.textContent=error.message;}});
  recovery.querySelector('#apply-recovery').addEventListener('click',()=>{const output=recovery.querySelector('#recovery-preview');if(!restoreCandidate||restoreBaseline!==captureScheduleState()||CuravelaTeam.isConnected()){output.textContent='The workspace changed. Preview recovery again.';return;}if(!confirm('Restore this local version? The current schedule will become a recovery copy.'))return;restoreCandidate.workspace.history=workspaceState.history;applyWorkspaceSnapshot(restoreCandidate);saveData('restore local version');refreshWorkspace();output.textContent='Local version restored. Undo is available.';recovery.querySelector('#apply-recovery').hidden=true;});

  const calendar=document.createElement('details');calendar.innerHTML='<summary>Export to Apple, Google or Outlook Calendar</summary><form id="calendar-export-form" class="workspace-form"><p>A downloaded calendar is a snapshot of the selected schedule dates. For updates automatically, sign into Team and create a private subscription from your caregiver account.</p><label>Caregiver<select name="caregiver"></select></label><label>Care location time zone<input name="zone" placeholder="America/Chicago" required aria-describedby="calendar-zone-help" /></label><p id="calendar-zone-help">Use an IANA time zone, such as America/Chicago. Confirm the care location, even when your device is in another zone. Notes are excluded.</p><button>Download calendar (.ics)</button><p id="calendar-export-status" role="status"></p></form>';
  reports.append(calendar);const calendarForm=calendar.querySelector('form');
  calendar.addEventListener('toggle',()=>{if(!calendar.open)return;const select=calendarForm.elements.caregiver;select.replaceChildren();caregivers.forEach(p=>{const option=document.createElement('option');option.value=p.id;option.textContent=p.name;select.append(option);});calendarForm.elements.zone.value=workspaceState.calendarTimeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';});
  calendarForm.addEventListener('submit',event=>{event.preventDefault();const status=calendarForm.querySelector('#calendar-export-status');try{const id=calendarForm.elements.caregiver.value;if(!caregiverIdExists(id))throw new Error('Choose a caregiver.');const zone=calendarForm.elements.zone.value.trim();const text=CuravelaCalendar.serialize(visibleOccurrences().filter(s=>s.caregiverId===id),{timeZone:zone,scope:location.origin+location.pathname+':'+id,name:'Curavela · '+getCaregiverName(id)});workspaceState.calendarTimeZone=zone;saveData('calendar time zone');exportTextFile('curavela-shifts.ics',text,'text/calendar;charset=utf-8');status.textContent='Calendar downloaded. Import it in your calendar app. It will not update automatically.';}catch(error){status.textContent=error.message;}});
})();
