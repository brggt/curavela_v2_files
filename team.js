/* Same-origin team service. GitHub Pages continues to operate in local mode. */
const CuravelaTeam = (function(){
  let user=null,revision=0,connected=false,dirty=false,localCopy=null,serverAvailable=false,timeZone='UTC',emailConfigured=false,reachable=true;
  const panel=document.createElement('section');panel.id='team-workspace-panel';panel.className='workspace-panel';panel.hidden=true;
  document.querySelector('.main-content').append(panel);
  const communicationsPanel=document.createElement('section');
  communicationsPanel.id='communications-workspace-panel';
  communicationsPanel.className='workspace-panel';
  communicationsPanel.hidden=true;
  document.querySelector('.main-content').append(communicationsPanel);
  let chatChannel='caregiver',chatRequestId=null,communicationsRenderVersion=0;
  async function api(route,method='GET',body){
    if(navigator.onLine===false)throw new Error('Offline. Reconnect before using team actions; nothing has been submitted.');
    let response;try{response=await fetch('api/'+route,{method,credentials:'same-origin',headers:method==='GET'?{}:{'Content-Type':'application/json','X-Curavela-Request':'1'},body:body===undefined?undefined:JSON.stringify(body)});reachable=true;}catch(error){reachable=false;renderConnectionStatusIfReady();throw new Error('Team connection unavailable. Nothing was confirmed; refresh before retrying.');}
    renderConnectionStatusIfReady();
    const result=await response.json().catch(()=>({error:'Team service is unavailable on this host.'}));
    if(!response.ok)throw new Error(result.error||'The request failed.');return result;
  }
  function renderConnectionStatusIfReady(){if(typeof renderConnectionStatus==='function')renderConnectionStatus();}
  function status(message,error){const node=document.querySelector('#team-status');if(node){node.textContent=message;node.classList.toggle('workspace-error',Boolean(error));}renderConnectionStatusIfReady();}
  function button(text,handler){const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',async()=>{b.disabled=true;try{await handler();}catch(error){status(error.message,true);const feedback=communicationsPanel.querySelector('[data-communications-status]');if(!communicationsPanel.hidden&&feedback)feedback.textContent=error.message;}finally{b.disabled=false;}});return b;}
  function isConnected(){return connected&&user?.role==='manager';}
  function markDirty(){dirty=true;status('Unsynced team changes. Sync draft before publishing.');}
  function applyTeam(data){applyWorkspaceSnapshot(data);resetScheduleHistory();refreshWorkspace();const picker=panel.querySelector('select[name="caregiverId"]');if(picker)picker.innerHTML=buildCaregiverOptions('Open');}
  async function sync(){if(!user||user.role!=='manager')throw new Error('Manager sign-in is required.');if(!connected&&!confirm('Upload this workspace as the team draft? This sends the current caregivers, assignments, and notes to your team server.'))return false;const result=await api('draft','PUT',{revision,snapshot:getWorkspaceSnapshot()});revision=result.revision;connected=true;dirty=false;status('Team draft synced. Revision '+revision+'.');return true;}
  async function load(){if(dirty&&!confirm('Discard unsynced team edits and load the latest server draft? Export a backup first if you need to keep them.'))return;const result=await api('draft');revision=result.revision;if(!result.snapshot){status('No team draft yet. Use Sync draft to upload your current workspace.');return;}if(!localCopy)localCopy=getWorkspaceSnapshot();connected=true;dirty=false;applyTeam(CuravelaWorkspace.validateBackup(result.snapshot));status('Loaded team draft revision '+revision+'.');}
  async function publish(){if(dirty||!connected){if(!await sync())return;}const days=selectedDays();const body={revision,first:days[0].key,last:days[days.length-1].key};if(!confirm('Publish '+body.first+' through '+body.last+' to caregivers? Changes will appear in My shifts and notifications.'))return;let result=await api('publish','POST',body);if(result.warnings){if(!confirm(result.warnings.map(w=>w.text).join('\n')+'\n\nPublish despite these warnings?'))return;result=await api('publish','POST',{...body,confirmWarnings:true});}status('Published '+result.count+' shifts. Version '+result.version+'.');await refresh();}
  function card(container,title,text){const section=document.createElement('article');section.className='request-card';const strong=document.createElement('strong');strong.textContent=title;const p=document.createElement('p');p.textContent=text;section.append(strong,p);container.append(section);return section;}

  function discussionButton(requestId){
    return button('Open discussion',async()=>{
      chatChannel='schedule';chatRequestId=requestId;
      setAppView('communications');
      await renderCommunications();
    });
  }
  async function renderCommunications(){
    const renderVersion=++communicationsRenderVersion;
    communicationsPanel.replaceChildren();
    const heading=document.createElement('h2');heading.textContent='Team Communications';
    const description=document.createElement('p');
    description.textContent='Scheduling-only messages. Do not share client identities, health records or other sensitive care information.';
    communicationsPanel.append(heading,description);
    const channels=document.createElement('div');channels.className='communications-channels';
    for(const [key,title,detail] of [
      ['caregiver','Caregiver Chat','Authenticated team-wide discussion'],
      ['schedule','Schedule','Private conversations linked to coverage requests'],
      ['health','Health Updates','Not available: protected health-data controls required'],
      ['family','Family','Not available: family roles and consent required']
    ]){
      const control=document.createElement('button');control.type='button';control.className='communications-channel';
      const label=document.createElement('strong');label.textContent=title;
      const summary=document.createElement('small');summary.textContent=detail;
      control.append(label,summary);
      control.disabled=key==='health'||key==='family';
      control.setAttribute('aria-pressed',String(chatChannel===key));
      if(!control.disabled)control.addEventListener('click',()=>{chatChannel=key;renderCommunications().catch(e=>status(e.message,true));});
      channels.append(control);
    }
    communicationsPanel.append(channels);
    const feedback=document.createElement('p');feedback.setAttribute('role','status');feedback.dataset.communicationsStatus='';communicationsPanel.append(feedback);
    if(!serverAvailable||!user){
      feedback.textContent='Real team messages require a signed-in team account on the secure Curavela server. Local mode cannot send messages.';
      return;
    }
    let request=null;
    if(chatChannel==='schedule'){
      const data=await api('requests');
      if(renderVersion!==communicationsRenderVersion)return;
      const available=data.requests.filter(r=>['claim','release','swap'].includes(r.kind));
      if(!available.length){feedback.textContent='No shift requests yet. Create a coverage request from Team to start a schedule conversation.';return;}
      if(!available.some(r=>r.id===chatRequestId))chatRequestId=available[0].id;
      const selector=document.createElement('select');selector.setAttribute('aria-label','Select shift request conversation');
      for(const item of available){
        const option=document.createElement('option');option.value=item.id;
        option.textContent=(item.name||'Caregiver')+' · '+item.kind+' · '+item.payload.key+' · '+item.status;
        selector.append(option);
      }
      selector.value=chatRequestId;
      selector.addEventListener('change',()=>{chatRequestId=selector.value;renderCommunications().catch(e=>status(e.message,true));});
      communicationsPanel.append(selector);
      request=available.find(r=>r.id===chatRequestId);
      const statusText=document.createElement('p');statusText.textContent='Request status: '+request.status+
        '. Approval updates the manager draft. Publishing is a separate action.';
      communicationsPanel.append(statusText);
    }
    const query='messages?channel='+encodeURIComponent(chatChannel)+(chatChannel==='schedule'?'&requestId='+encodeURIComponent(chatRequestId):'');
    const selectedChannel=chatChannel,selectedRequestId=chatChannel==='schedule'?chatRequestId:null;
    const result=await api(query);
    if(renderVersion!==communicationsRenderVersion)return;
    const list=document.createElement('div');list.className='communications-messages';
    list.setAttribute('role','log');list.setAttribute('aria-label',chatChannel==='schedule'?'Schedule request discussion':'Caregiver chat');
    if(!result.messages.length){const empty=document.createElement('p');empty.textContent='No messages yet.';list.append(empty);}
    for(const message of result.messages){
      const row=document.createElement('article');row.className='communication-message';
      const sender=document.createElement('strong');sender.textContent=message.senderName+(message.senderId===user.id?' (you)':'');
      const time=document.createElement('small');time.textContent=new Date(message.at).toLocaleString();
      const content=document.createElement('p');content.textContent=message.body;
      row.append(sender,time,content);list.append(row);
    }
    communicationsPanel.append(list);
    if(request && user.role==='manager' && request.status==='pending'){
      const decisions=document.createElement('div');decisions.className='workspace-tools';
      for(const decision of ['approved','declined']){
        decisions.append(button(decision==='approved'?'Approve for draft':'Decline request',async()=>{
          if(dirty||!connected)throw new Error('Load or sync the latest manager draft before approving.');
          if(request.kind==='swap' && request.consent?.decision!=='accepted')throw new Error('The other caregiver must accept the swap first.');
          if(decision==='approved'&&!confirm('Approve this shift request in the manager draft? The caregiver schedule will not change until you publish it.'))return;
          const response=await api('requests/decide','POST',{id:request.id,decision,revision});
          revision=response.revision;
          if(decision==='approved')await load();
          await refresh();
          await renderCommunications();
        }));
      }
      communicationsPanel.append(decisions);
    }
    if(chatChannel==='schedule' && request.status!=='pending'){
      feedback.textContent='This request is closed. Its conversation is read-only.';
      return;
    }
    const form=document.createElement('form');form.className='communications-compose';
    const label=document.createElement('label');label.textContent='Write a message';
    const input=document.createElement('textarea');input.rows=3;input.maxLength=2000;input.required=true;
    input.placeholder='Scheduling coordination only — no health or client details.';
    const submit=document.createElement('button');submit.type='submit';submit.textContent='Send message';
    label.append(input);form.append(label,submit);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      submit.disabled=true;
      try{
        await api('messages','POST',{channel:selectedChannel,requestId:selectedRequestId||undefined,text:input.value});
        if(renderVersion===communicationsRenderVersion)await renderCommunications();
      }catch(e){feedback.textContent=e.message;}finally{submit.disabled=false;}
    });
    communicationsPanel.append(form);
    const reload=button('Refresh messages',renderCommunications);communicationsPanel.append(reload);
  }
  async function refresh(){
    if(!user)return;
    const notifications=await api('notifications');const inbox=document.querySelector('#team-notifications');inbox.replaceChildren();
    if(!notifications.notifications.length)inbox.textContent='No notifications yet.';
    notifications.notifications.forEach(n=>{const row=card(inbox,n.is_read?'Read':'New',n.message+' · '+new Date(n.at).toLocaleString()+' · Email: '+n.email_state);if(!n.is_read)row.append(button('Mark read',async()=>{await api('notifications/read','POST',{id:n.id});await refresh();}));});
    const requests=await api('requests');const list=document.querySelector('#team-requests');list.replaceChildren();
    if(!requests.requests.length)list.textContent='No requests yet.';
    requests.requests.forEach(r=>{const row=card(list,(r.name?r.name+' · ':'')+r.kind+' · '+r.status,r.kind==='time-off'?r.payload.startDate+(r.payload.startTime?' '+r.payload.startTime:'')+' – '+r.payload.endDate+(r.payload.endTime?' '+r.payload.endTime:' · All day'):r.payload.key+(r.payload.targetKey?' ⇄ '+r.payload.targetKey:''));
      if(['claim','release','swap'].includes(r.kind))row.append(discussionButton(r.id));
      if(r.kind==='swap'){
        const state=document.createElement('p');state.textContent=r.consent?'Coworker '+r.consent.decision+' · '+new Date(r.consent.at).toLocaleString():'Awaiting coworker response';row.append(state);
        if(r.incoming&&r.status==='pending'&&!r.consent)row.append(button('Accept swap',async()=>{if(!confirm('Accept this exchange? Your manager must still approve and publish it.'))return;await api('requests/respond','POST',{id:r.id,decision:'accepted'});status('Swap accepted; waiting for manager approval.');await refresh();}),button('Decline swap',async()=>{await api('requests/respond','POST',{id:r.id,decision:'declined'});await refresh();}));
      }
      if(user.role==='manager'&&r.status==='pending'){
        row.append(button('Approve',async()=>{if(dirty)throw new Error('Sync your draft before deciding requests.');if(r.kind==='swap'&&r.consent?.decision!=='accepted')throw new Error('The requested coworker must accept from their own account first.');const result=await api('requests/decide','POST',{id:r.id,decision:'approved',revision});revision=result.revision;await load();status('Request approved in draft. Review conflicts and publish the affected dates.');await refresh();}),button('Decline',async()=>{await api('requests/decide','POST',{id:r.id,decision:'declined',revision});await refresh();}));
      }
    });
    if(user.role==='caregiver'){
      const data=await api('my-shifts');const shifts=document.querySelector('#my-shifts');shifts.replaceChildren();
      if(!data.shifts.length)shifts.textContent='No published shifts assigned to you.';
      data.shifts.forEach(s=>{const row=card(shifts,s.dayKey+' · '+s.shiftName,s.startTime+'–'+s.endTime+(s.endTime<=s.startTime?' · ends next day':'')+' · '+(s.acknowledged?'Acknowledged':'Needs acknowledgment'));
        if(s.note){const note=document.createElement('p');note.className='shift-note';note.textContent=s.note;row.append(note);}
        if(!s.acknowledged)row.append(button('Acknowledge',async()=>{await api('acknowledge','POST',{key:s.key});await refresh();}));
        row.append(button('Request cover / call out',async()=>{if(!confirm('Ask your manager to find coverage? You remain assigned until the schedule is changed and published.'))return;await api('requests','POST',{kind:'release',key:s.key});status('Coverage request sent.');await refresh();}),button('Request a swap',async()=>{const options=await api('swap-options?key='+encodeURIComponent(s.key));const chooser=document.createElement('select');chooser.setAttribute('aria-label','Choose a shift to swap with');options.shifts.forEach(other=>{const option=document.createElement('option');option.value=other.key;option.textContent=other.dayKey+' '+other.shiftName+' · '+other.caregiverName;chooser.append(option);});if(!options.shifts.length){status('No compatible shifts are available to swap.');return;}row.append(chooser,button('Send swap request',async()=>{await api('requests','POST',{kind:'swap',key:s.key,targetKey:chooser.value});status('Swap requested. Your coworker must accept, then your manager can approve and publish it.');await refresh();}));}));
      });
      const open=document.querySelector('#my-open-shifts');open.replaceChildren();if(!data.open.length)open.textContent='No eligible published open shifts.';
      data.open.forEach(s=>card(open,s.dayKey+' · '+s.shiftName,s.startTime+'–'+s.endTime).append(button('Request this shift',async()=>{await api('requests','POST',{kind:'claim',key:s.key});status('Request submitted for manager approval.');await refresh();})));
    }else{
      const [history,acks]=await Promise.all([api('history'),api('acknowledgments')]);
      const list=document.querySelector('#team-history');list.replaceChildren();history.history.forEach(h=>{const li=document.createElement('li');li.textContent=new Date(h.at).toLocaleString()+' · '+(h.name||'Manager')+' · '+h.action;const detail=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Change details';detail.append(summary);if(h.details.changes?.length){appendChangeDetails(detail,h.details.changes,h.details.changeCount);}else if(h.details.rows){appendChangeDetails(detail,h.details.rows.map(row=>({type:'shift',key:row.key,before:row.before?{caregiver:getCaregiverName(row.before.caregiverId),start:row.before.startTime,end:row.before.endTime,note:row.before.note}:null,after:row.after?{caregiver:getCaregiverName(row.after.caregiverId),start:row.after.startTime,end:row.after.endTime,note:row.after.note}:null})));}else{const p=document.createElement('p');p.textContent=Object.entries(h.details).map(([key,value])=>key+': '+String(value)).join(' · ');detail.append(p);}li.append(detail);list.append(li);});
      const ack=document.querySelector('#team-acknowledgments');ack.replaceChildren();acks.shifts.forEach(s=>{const p=document.createElement('p');p.textContent=s.dayKey+' '+s.shiftName+' · '+getCaregiverName(s.caregiverId)+' · '+(s.acknowledged?'Acknowledged':'Awaiting acknowledgment');ack.append(p);});
    }
  }
  function render(){
    panel.replaceChildren();const heading=document.createElement('h2');heading.textContent='Team workspace';panel.append(heading);
    const state=document.createElement('p');state.id='team-status';state.className='workspace-status';state.setAttribute('role','status');panel.append(state);
    if(!serverAvailable){status('This host runs local mode. Shared accounts require the Curavela server; your current schedule remains on this browser.');return;}
    if(!user){
      const invite=location.hash.startsWith('#invite=')?location.hash.slice(8):'';
      const form=document.createElement('form');form.className='workspace-form';form.innerHTML=(invite?'<p>Accept your team invitation. Links expire after 72 hours.</p><label>Your name<input name="name" autocomplete="name" required maxlength="200" /></label>':'<label>Email<input name="email" type="email" autocomplete="username" required /></label>')+'<label>Password<input name="password" type="password" autocomplete="'+(invite?'new-password':'current-password')+'" minlength="12" maxlength="256" required /></label><button type="submit">'+(invite?'Join team':'Sign in')+'</button><p>Need access or a password reset? Ask a manager for a new invitation.</p>';
      form.addEventListener('submit',async event=>{event.preventDefault();const submit=form.querySelector('button');submit.disabled=true;try{const fields=new FormData(form);const result=await api(invite?'accept-invite':'login','POST',invite?{token:invite,name:fields.get('name'),password:fields.get('password')}:{email:fields.get('email'),password:fields.get('password')});user=result.user;if(invite)history.replaceState(null,'',location.pathname+location.search);localCopy=getWorkspaceSnapshot();render();await refresh();}catch(e){status(e.message,true);}finally{submit.disabled=false;}});panel.append(form);return;
    }
    const intro=document.createElement('p');intro.textContent=user.name+' · '+user.role+' · Schedule times: '+timeZone;panel.append(intro);
    const actions=document.createElement('div');actions.className='workspace-tools';actions.append(button('Refresh',refresh),button('Sign out',async()=>{if(dirty&&!confirm('Sign out and discard unsynced team changes? Export a backup first if needed.'))return;await api('logout','POST',{});user=null;connected=false;dirty=false;communicationsRenderVersion++;communicationsPanel.replaceChildren();if(localCopy){applyTeam(localCopy);localCopy=null;}document.querySelectorAll('.side-nav-link').forEach(link=>link.hidden=false);render();}));panel.append(actions);
    if(user.role==='manager'){
      actions.prepend(button('Load latest draft',load),button('Sync draft',sync),button('Publish selected dates',publish));
      const form=document.createElement('form');form.className='workspace-form';form.innerHTML='<h3>Invite a team member</h3><label>Email<input name="email" type="email" required /></label><label>Role<select name="role"><option value="caregiver">Caregiver</option><option value="manager">Manager</option></select></label><label>Caregiver profile<select name="caregiverId">'+buildCaregiverOptions('Open')+'</select></label><button type="submit">Create invitation link</button><p id="invitation-result"></p>';
      form.addEventListener('submit',async event=>{event.preventDefault();try{if(dirty)throw new Error('Sync caregiver profiles before inviting someone.');const fields=new FormData(form),result=await api('invitations','POST',Object.fromEntries(fields));const output=document.querySelector('#invitation-result');output.textContent='Share this one-use link only with that person: '+result.link;}catch(e){status(e.message,true);}});panel.append(form);
      status('Load the team draft or sync this workspace. Nothing is published until you choose Publish selected dates.');
    }else{
      document.querySelectorAll('.side-nav-link').forEach(link=>link.hidden=!['team','communications','help'].includes(link.dataset.view));setAppView('team');
      const form=document.createElement('form');form.className='workspace-form';form.innerHTML='<h3>Request time off</h3><label>First day<input name="startDate" type="date" required /></label><label>Last day<input name="endDate" type="date" required /></label><label class="checkbox-label"><input name="allDay" type="checkbox" checked />All day</label><div id="team-time-off-times" hidden><label>Start time<input name="startTime" type="time" value="09:00" disabled /></label><label>End time<input name="endTime" type="time" value="17:00" disabled /></label><p>For overnight time off, choose the following date as the last day.</p></div><button>Request time off</button>';
      form.elements.allDay.addEventListener('change',()=>{const allDay=form.elements.allDay.checked;form.querySelector('#team-time-off-times').hidden=allDay;for(const name of ['startTime','endTime']){form.elements[name].disabled=allDay;form.elements[name].required=!allDay;}});
      form.addEventListener('submit',async event=>{event.preventDefault();try{await api('requests','POST',{kind:'time-off',...Object.fromEntries(new FormData(form)),allDay:form.elements.allDay.checked});status('Time-off request submitted.');await refresh();}catch(e){status(e.message,true);}});panel.append(form);
    }
    if(user.role==='caregiver'){
      const calendar=document.createElement('details');calendar.innerHTML='<summary>Calendar subscription</summary><p>Your private link includes only your published shifts, without handoff notes. Anyone with this link can read those times. Calendar apps choose their own refresh schedule, so check Curavela for urgent changes.</p><p>Apple Calendar: Add Subscription Calendar. Google Calendar on the web: Other calendars → From URL. Outlook on the web: Add calendar → Subscribe from web.</p><div class="workspace-tools"></div><label>Private calendar URL<input id="private-calendar-url" type="url" readonly placeholder="Create a link below" /></label><p id="calendar-link-status" role="status"></p>';
      const buttons=calendar.querySelector('.workspace-tools'),output=calendar.querySelector('input'),feedback=calendar.querySelector('#calendar-link-status');
      buttons.append(button('Create / replace private link',async()=>{if(!confirm('Create a private calendar link? This replaces and disables any previous link.'))return;const result=await api('calendar-link','POST',{});output.value=result.link;feedback.textContent='Link created. Copy it into your calendar subscription settings.';output.focus();output.select();}),button('Copy link',async()=>{if(!output.value)throw new Error('Create a private link first.');try{await navigator.clipboard.writeText(output.value);feedback.textContent='Private link copied.';}catch{output.focus();output.select();feedback.textContent='Select and copy the link above.';}}),button('Revoke link',async()=>{if(!confirm('Stop future calendar access through your private link? Your calendar app may retain previously downloaded events.'))return;await api('calendar-link','DELETE');output.value='';feedback.textContent='Link revoked. Remove the subscription from your calendar app as well.';}));panel.append(calendar);
    }else{
      const recovery=document.createElement('details');recovery.innerHTML='<summary>Restore a saved team draft</summary><p>Restoring creates a new draft revision. It does not change the published schedule until you publish those dates.</p><label>Saved revision<select></select></label><div class="workspace-tools"></div><div class="revision-preview" aria-live="polite"></div>';
      const select=recovery.querySelector('select'),output=recovery.querySelector('.revision-preview'),buttons=recovery.querySelector('.workspace-tools');let candidate=null;
      const restore=button('Restore previewed revision',async()=>{if(dirty||!candidate||candidate.revision!==revision)throw new Error('The draft changed. Sync or load, then preview again.');if(!confirm('Restore revision '+candidate.targetRevision+' as a new team draft? Published shifts stay unchanged.'))return;const result=await api('snapshots/restore','POST',{revision,targetRevision:candidate.targetRevision});revision=result.revision;candidate=null;restore.hidden=true;await load();await refresh();output.textContent='Draft restored as revision '+revision+'. Review and publish when ready.';});restore.hidden=true;
      select.addEventListener('change',()=>{candidate=null;restore.hidden=true;output.replaceChildren();});
      buttons.append(button('Load saved revisions',async()=>{const data=await api('snapshots');select.replaceChildren();data.snapshots.forEach(saved=>{const option=document.createElement('option');option.value=String(saved.revision);option.textContent='Revision '+saved.revision+' · '+new Date(saved.at).toLocaleString();select.append(option);});candidate=null;restore.hidden=true;output.textContent=data.snapshots.length?'Choose a revision, then preview.':'No saved team revisions yet.';}),button('Preview revision',async()=>{if(dirty||!connected)throw new Error('Sync or load the team draft before previewing a recovery.');candidate=await api('snapshots/preview','POST',{revision,targetRevision:Number(select.value)});output.replaceChildren();appendChangeDetails(output,candidate.changes,candidate.changeCount);if(!candidate.changes.length)output.textContent='No scheduling differences from the current draft.';restore.hidden=false;}),restore);panel.append(recovery);
    }
    const preferences=document.createElement('form');preferences.className='workspace-form';preferences.innerHTML='<h3>Notification preferences</h3><label class="checkbox-label"><input name="emailEnabled" type="checkbox" '+(user.emailEnabled?'checked':'')+' '+(!emailConfigured?'disabled':'')+' />Email alerts'+(!emailConfigured?' (not configured on this server)':'')+'</label><label class="checkbox-label"><input name="reminders" type="checkbox" '+(user.reminders?'checked':'')+' />One-hour shift reminders</label><button>Save preferences</button>';
    preferences.addEventListener('submit',async event=>{event.preventDefault();try{await api('preferences','POST',{emailEnabled:preferences.elements.emailEnabled.checked,reminders:preferences.elements.reminders.checked});status('Notification preferences saved.');}catch(e){status(e.message,true);}});panel.append(preferences);
    const sections=user.role==='manager'?[['Requests','team-requests'],['Acknowledgments','team-acknowledgments'],['Notifications','team-notifications'],['Team history','team-history']]:[['My shifts','my-shifts'],['Open shifts','my-open-shifts'],['My requests','team-requests'],['Notifications','team-notifications']];
    sections.forEach(([label,id])=>{const heading=document.createElement('h3');heading.textContent=label;const list=document.createElement(id==='team-history'?'ul':'div');list.id=id;panel.append(heading,list);});
  }
  document.querySelectorAll('.side-nav-link[data-view="communications"]').forEach(link=>
    link.addEventListener('click',()=>renderCommunications().catch(e=>{communicationsPanel.textContent=e.message;})));
  async function init(){try{const data=await api('session');serverAvailable=true;user=data.user;timeZone=data.timeZone;emailConfigured=data.emailConfigured;}catch{serverAvailable=false;}render();if(user){localCopy=getWorkspaceSnapshot();await refresh().catch(e=>status(e.message,true));}if(location.hash.startsWith('#invite='))setAppView('team');}
  // Initialization runs after the workspace UI has mounted.
  window.addEventListener('load',init);
  setInterval(()=>{if(user)refresh().catch(()=>status('Team connection unavailable. Your unsynced draft is still here.',true));},60000);
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  return {isConnected,markDirty,getStatus(){return {mode:connected?'team':user?'signed-in':'local',dirty,reachable,serverAvailable,role:user?.role||null};}};
})();
