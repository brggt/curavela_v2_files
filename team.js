/* Same-origin team service. GitHub Pages continues to operate in local mode. */
const CuravelaTeam = (function(){
  let user=null,revision=0,connected=false,dirty=false,localCopy=null,serverAvailable=false,timeZone='UTC',emailConfigured=false;
  const panel=document.createElement('section');panel.id='team-workspace-panel';panel.className='workspace-panel';panel.hidden=true;
  document.querySelector('.main-content').append(panel);
  async function api(route,method='GET',body){
    const response=await fetch('api/'+route,{method,credentials:'same-origin',headers:method==='GET'?{}:{'Content-Type':'application/json','X-Curavela-Request':'1'},body:body===undefined?undefined:JSON.stringify(body)});
    const result=await response.json().catch(()=>({error:'Team service is unavailable on this host.'}));
    if(!response.ok)throw new Error(result.error||'The request failed.');return result;
  }
  function status(message,error){const node=document.querySelector('#team-status');if(node){node.textContent=message;node.classList.toggle('workspace-error',Boolean(error));}}
  function button(text,handler){const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',async()=>{b.disabled=true;try{await handler();}catch(error){status(error.message,true);}finally{b.disabled=false;}});return b;}
  function isConnected(){return connected&&user?.role==='manager';}
  function markDirty(){dirty=true;status('Unsynced team changes. Sync draft before publishing.');}
  function applyTeam(data){applyWorkspaceSnapshot(data);resetScheduleHistory();refreshWorkspace();const picker=panel.querySelector('select[name="caregiverId"]');if(picker)picker.innerHTML=buildCaregiverOptions('Open');}
  async function sync(){if(!user||user.role!=='manager')throw new Error('Manager sign-in is required.');if(!connected&&!confirm('Upload this workspace as the team draft? This sends the current caregivers, assignments, and notes to your team server.'))return false;const result=await api('draft','PUT',{revision,snapshot:getWorkspaceSnapshot()});revision=result.revision;connected=true;dirty=false;status('Team draft synced. Revision '+revision+'.');return true;}
  async function load(){if(dirty&&!confirm('Discard unsynced team edits and load the latest server draft? Export a backup first if you need to keep them.'))return;const result=await api('draft');revision=result.revision;if(!result.snapshot){status('No team draft yet. Use Sync draft to upload your current workspace.');return;}if(!localCopy)localCopy=getWorkspaceSnapshot();connected=true;dirty=false;applyTeam(CuravelaWorkspace.validateBackup(result.snapshot));status('Loaded team draft revision '+revision+'.');}
  async function publish(){if(dirty||!connected){if(!await sync())return;}const days=selectedDays();const body={revision,first:days[0].key,last:days[days.length-1].key};if(!confirm('Publish '+body.first+' through '+body.last+' to caregivers? Changes will appear in My shifts and notifications.'))return;let result=await api('publish','POST',body);if(result.warnings){if(!confirm(result.warnings.map(w=>w.text).join('\n')+'\n\nPublish despite these warnings?'))return;result=await api('publish','POST',{...body,confirmWarnings:true});}status('Published '+result.count+' shifts. Version '+result.version+'.');await refresh();}
  function card(container,title,text){const section=document.createElement('article');section.className='request-card';const strong=document.createElement('strong');strong.textContent=title;const p=document.createElement('p');p.textContent=text;section.append(strong,p);container.append(section);return section;}
  async function refresh(){
    if(!user)return;
    const notifications=await api('notifications');const inbox=document.querySelector('#team-notifications');inbox.replaceChildren();
    if(!notifications.notifications.length)inbox.textContent='No notifications yet.';
    notifications.notifications.forEach(n=>{const row=card(inbox,n.is_read?'Read':'New',n.message+' · '+new Date(n.at).toLocaleString()+' · Email: '+n.email_state);if(!n.is_read)row.append(button('Mark read',async()=>{await api('notifications/read','POST',{id:n.id});await refresh();}));});
    const requests=await api('requests');const list=document.querySelector('#team-requests');list.replaceChildren();
    if(!requests.requests.length)list.textContent='No requests yet.';
    requests.requests.forEach(r=>{const row=card(list,(r.name?r.name+' · ':'')+r.kind+' · '+r.status,r.kind==='time-off'?r.payload.startDate+' – '+r.payload.endDate:r.payload.key+(r.payload.targetKey?' ⇄ '+r.payload.targetKey:''));
      if(user.role==='manager'&&r.status==='pending'){
        row.append(button('Approve',async()=>{if(dirty)throw new Error('Sync your draft before deciding requests.');let consent=false;if(r.kind==='swap'){consent=confirm('Has the other caregiver agreed to this swap?');if(!consent)return;}const result=await api('requests/decide','POST',{id:r.id,decision:'approved',revision,coworkerConfirmed:consent});revision=result.revision;await load();status('Request approved in draft. Review conflicts and publish the affected dates.');await refresh();}),button('Decline',async()=>{await api('requests/decide','POST',{id:r.id,decision:'declined',revision});await refresh();}));
      }
    });
    if(user.role==='caregiver'){
      const data=await api('my-shifts');const shifts=document.querySelector('#my-shifts');shifts.replaceChildren();
      if(!data.shifts.length)shifts.textContent='No published shifts assigned to you.';
      data.shifts.forEach(s=>{const row=card(shifts,s.dayKey+' · '+s.shiftName,s.startTime+'–'+s.endTime+(s.endTime<=s.startTime?' · ends next day':'')+' · '+(s.acknowledged?'Acknowledged':'Needs acknowledgment'));
        if(!s.acknowledged)row.append(button('Acknowledge',async()=>{await api('acknowledge','POST',{key:s.key});await refresh();}));
        row.append(button('Request cover / call out',async()=>{if(!confirm('Ask your manager to find coverage? You remain assigned until the schedule is changed and published.'))return;await api('requests','POST',{kind:'release',key:s.key});status('Coverage request sent.');await refresh();}),button('Request a swap',async()=>{const options=await api('swap-options?key='+encodeURIComponent(s.key));const chooser=document.createElement('select');chooser.setAttribute('aria-label','Choose a shift to swap with');options.shifts.forEach(other=>{const option=document.createElement('option');option.value=other.key;option.textContent=other.dayKey+' '+other.shiftName+' · '+other.caregiverName;chooser.append(option);});if(!options.shifts.length){status('No compatible shifts are available to swap.');return;}row.append(chooser,button('Send swap request',async()=>{await api('requests','POST',{kind:'swap',key:s.key,targetKey:chooser.value});status('Swap requested. Your manager will confirm agreement and review it.');await refresh();}));}));
      });
      const open=document.querySelector('#my-open-shifts');open.replaceChildren();if(!data.open.length)open.textContent='No eligible published open shifts.';
      data.open.forEach(s=>card(open,s.dayKey+' · '+s.shiftName,s.startTime+'–'+s.endTime).append(button('Request this shift',async()=>{await api('requests','POST',{kind:'claim',key:s.key});status('Request submitted for manager approval.');await refresh();})));
    }else{
      const [history,acks]=await Promise.all([api('history'),api('acknowledgments')]);
      const list=document.querySelector('#team-history');list.replaceChildren();history.history.forEach(h=>{const li=document.createElement('li');li.textContent=new Date(h.at).toLocaleString()+' · '+(h.name||'Manager')+' · '+h.action;const detail=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Change details';const pre=document.createElement('pre');pre.textContent=JSON.stringify(h.details,null,2);detail.append(summary,pre);li.append(detail);list.append(li);});
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
    const actions=document.createElement('div');actions.className='workspace-tools';actions.append(button('Refresh',refresh),button('Sign out',async()=>{if(dirty&&!confirm('Sign out and discard unsynced team changes? Export a backup first if needed.'))return;await api('logout','POST',{});user=null;connected=false;dirty=false;if(localCopy){applyTeam(localCopy);localCopy=null;}document.querySelectorAll('.side-nav-link').forEach(link=>link.hidden=false);render();}));panel.append(actions);
    if(user.role==='manager'){
      actions.prepend(button('Load latest draft',load),button('Sync draft',sync),button('Publish selected dates',publish));
      const form=document.createElement('form');form.className='workspace-form';form.innerHTML='<h3>Invite a team member</h3><label>Email<input name="email" type="email" required /></label><label>Role<select name="role"><option value="caregiver">Caregiver</option><option value="manager">Manager</option></select></label><label>Caregiver profile<select name="caregiverId">'+buildCaregiverOptions('Open')+'</select></label><button type="submit">Create invitation link</button><p id="invitation-result"></p>';
      form.addEventListener('submit',async event=>{event.preventDefault();try{if(dirty)throw new Error('Sync caregiver profiles before inviting someone.');const fields=new FormData(form),result=await api('invitations','POST',Object.fromEntries(fields));const output=document.querySelector('#invitation-result');output.textContent='Share this one-use link only with that person: '+result.link;}catch(e){status(e.message,true);}});panel.append(form);
      status('Load the team draft or sync this workspace. Nothing is published until you choose Publish selected dates.');
    }else{
      document.querySelectorAll('.side-nav-link').forEach(link=>link.hidden=!['team','help'].includes(link.dataset.view));setAppView('team');
      const form=document.createElement('form');form.className='workspace-form';form.innerHTML='<h3>Request time off</h3><label>First day<input name="startDate" type="date" required /></label><label>Last day<input name="endDate" type="date" required /></label><button>Request time off</button>';
      form.addEventListener('submit',async event=>{event.preventDefault();try{await api('requests','POST',{kind:'time-off',...Object.fromEntries(new FormData(form))});status('Time-off request submitted.');await refresh();}catch(e){status(e.message,true);}});panel.append(form);
    }
    const preferences=document.createElement('form');preferences.className='workspace-form';preferences.innerHTML='<h3>Notification preferences</h3><label class="checkbox-label"><input name="emailEnabled" type="checkbox" '+(user.emailEnabled?'checked':'')+' '+(!emailConfigured?'disabled':'')+' />Email alerts'+(!emailConfigured?' (not configured on this server)':'')+'</label><label class="checkbox-label"><input name="reminders" type="checkbox" '+(user.reminders?'checked':'')+' />One-hour shift reminders</label><button>Save preferences</button>';
    preferences.addEventListener('submit',async event=>{event.preventDefault();try{await api('preferences','POST',{emailEnabled:preferences.elements.emailEnabled.checked,reminders:preferences.elements.reminders.checked});status('Notification preferences saved.');}catch(e){status(e.message,true);}});panel.append(preferences);
    const sections=user.role==='manager'?[['Requests','team-requests'],['Acknowledgments','team-acknowledgments'],['Notifications','team-notifications'],['Team history','team-history']]:[['My shifts','my-shifts'],['Open shifts','my-open-shifts'],['My requests','team-requests'],['Notifications','team-notifications']];
    sections.forEach(([label,id])=>{const heading=document.createElement('h3');heading.textContent=label;const list=document.createElement(id==='team-history'?'ul':'div');list.id=id;panel.append(heading,list);});
  }
  async function init(){try{const data=await api('session');serverAvailable=true;user=data.user;timeZone=data.timeZone;emailConfigured=data.emailConfigured;}catch{serverAvailable=false;}render();if(user){localCopy=getWorkspaceSnapshot();await refresh().catch(e=>status(e.message,true));}if(location.hash.startsWith('#invite='))setAppView('team');}
  // Initialization runs after the workspace UI has mounted.
  window.addEventListener('load',init);
  setInterval(()=>{if(user)refresh().catch(()=>status('Team connection unavailable. Your unsynced draft is still here.',true));},60000);
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  return {isConnected,markDirty};
})();
