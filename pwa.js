/* Installable app shell. Private team responses are never cached by the worker. */
function renderConnectionStatus(){
  const node=document.querySelector('#connection-status');if(!node)return;
  const team=typeof CuravelaTeam==='undefined'?{mode:'local'}:CuravelaTeam.getStatus();
  const offline=navigator.onLine===false;
  if(team.mode==='team')node.textContent=(offline?'Offline · ':!team.reachable?'Connection unavailable · ':'')+(team.dirty?'Team draft has unsynced edits. Keep this page open.':'Team draft synced. Publish to share changes.');
  else if(team.mode==='signed-in')node.textContent=(offline?'Offline · ':!team.reachable?'Connection unavailable · ':'')+(team.role==='caregiver'?'Published team schedule · Refresh for updates.':'Signed in · Load or sync a team draft.');
  else node.textContent=(offline?'Offline · ':'')+(lastLocalSaveFailed?'Not saved · Keep this page open and export a backup.':savedWorkspaceUnreadable?'Saved workspace needs recovery. Export current work.':'Local mode · Saved in this browser only.');
  node.classList.toggle('workspace-error',Boolean(offline||team.dirty||!team.reachable&&team.mode!=='local'||savedWorkspaceUnreadable||lastLocalSaveFailed));
}
(function initializeInstall(){
  const status=document.createElement('p');status.id='connection-status';status.className='connection-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  document.querySelector('.main-content').prepend(status);
  window.addEventListener('online',renderConnectionStatus);window.addEventListener('offline',renderConnectionStatus);renderConnectionStatus();
  const help=document.querySelector('#help-workspace-panel'),details=document.createElement('details');
  details.innerHTML='<summary>Install Curavela on your home screen</summary><p>On iPhone or iPad, open Curavela in Safari, tap Share, then Add to Home Screen. If your browser offers an Install button, you can use it below.</p><p>The app shell can open offline after a successful online visit. Local schedules stay in this browser; an installed app may have separate storage, so export a backup before switching. Team sign-in, sync, requests and calendar subscriptions require a connection. Unsynced team edits stay in this open page and are not stored for a later restart.</p><button type="button" id="install-curavela" hidden>Install Curavela</button><p id="install-status" role="status"></p>';
  help.append(details);const install=details.querySelector('button'),feedback=details.querySelector('#install-status');let prompt=null;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;install.hidden=false;});
  install.addEventListener('click',async()=>{if(!prompt)return;await prompt.prompt();const choice=await prompt.userChoice;feedback.textContent=choice.outcome==='accepted'?'Installation requested.':'You can install later from your browser menu.';prompt=null;install.hidden=true;});
  window.addEventListener('appinstalled',()=>{install.hidden=true;feedback.textContent='Curavela installed.';});
  if('serviceWorker' in navigator&&window.isSecureContext){
    navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(registration=>{
      function waiting(){if(registration.waiting)feedback.textContent='An app update is ready. Save or sync your work, then close every Curavela tab and reopen to use it.';}
      waiting();registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')waiting();});});
    }).catch(()=>{feedback.textContent='Offline setup is unavailable in this browser. The online app still works.';});
  }
})();
