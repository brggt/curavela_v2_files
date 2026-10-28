/* Bump VERSION with every app release. Cache only this explicit static shell.
   No API, calendar feeds, invitations, user data, third-party assets or writes. */
const VERSION='curavela-shell-3.1.0-mobile-nav-1';
const FILES=['./','index.html','style.css','enhancements.css','responsive.css','scheduling.js','workspace.js','calendar.js','editing.js','timeoff.js','script.js','team.js','workspace-ui.js','planning-ui.js','mobile-nav.js','pwa.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png'];
const ROOT=new URL('./',self.location.href);
const ALLOWED=new Set(FILES.map(file=>new URL(file,ROOT).href));
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(FILES)));});
// Wait naturally for every old tab to close; never discard an open draft.
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('curavela-shell-')&&key!==VERSION).map(key=>caches.delete(key)))));});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==ROOT.origin||url.search||!ALLOWED.has(url.href))return;
  event.respondWith(caches.open(VERSION).then(async cache=>{
    const cached=await cache.match(request);return cached||fetch(request);
  }));
});
