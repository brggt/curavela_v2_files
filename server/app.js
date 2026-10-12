'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const {DatabaseSync}=require('node:sqlite');
const W=require('../workspace.js');
const R=require('../scheduling.js');
const scrypt=promisify(crypto.scrypt);
const digest=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const token=()=>crypto.randomBytes(32).toString('base64url');
const now=()=>new Date().toISOString();
const emailValid=value=>typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
function failure(status,message){const error=new Error(message);error.status=status;throw error;}
async function hashPassword(password,salt){if(typeof password!=='string'||password.length<12||password.length>256)failure(400,'Use a password between 12 and 256 characters.');return Buffer.from(await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024})).toString('hex');}
function createApplication(options={}) {
  const db=new DatabaseSync(options.dbPath||':memory:');
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('manager','caregiver')),caregiver_id TEXT,salt TEXT NOT NULL,password TEXT NOT NULL,email_enabled INTEGER NOT NULL DEFAULT 0,reminders INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS invites(hash TEXT PRIMARY KEY,email TEXT NOT NULL,role TEXT NOT NULL,caregiver_id TEXT,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1),draft TEXT,revision INTEGER NOT NULL DEFAULT 0,published TEXT NOT NULL DEFAULT '[]',published_version INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO workspace(id) VALUES(1);
    CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,at TEXT NOT NULL,action TEXT NOT NULL,details TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS snapshots(revision INTEGER PRIMARY KEY,data TEXT NOT NULL,at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',at TEXT NOT NULL,decision TEXT);
    CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),event_key TEXT NOT NULL UNIQUE,message TEXT NOT NULL,at TEXT NOT NULL,is_read INTEGER NOT NULL DEFAULT 0,email_state TEXT NOT NULL DEFAULT 'disabled',attempts INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS acknowledgments(user_id TEXT NOT NULL REFERENCES users(id),shift_key TEXT NOT NULL,fingerprint TEXT NOT NULL,at TEXT NOT NULL,PRIMARY KEY(user_id,shift_key));`);
  const origin=options.origin||'http://localhost:3000', secure=origin.startsWith('https:'),timeZone=options.timeZone||'UTC';
  const limits=new Map();
  function tx(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
  function audit(user,action,details={}){db.prepare('INSERT INTO history(actor,at,action,details) VALUES(?,?,?,?)').run(user.id,now(),action,JSON.stringify(details));}
  function notify(userId,event,message){const user=db.prepare('SELECT * FROM users WHERE id=?').get(userId);if(!user)return;db.prepare('INSERT OR IGNORE INTO notifications(id,user_id,event_key,message,at,email_state) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),userId,event,message,now(),user.email_enabled&&options.sendEmail?'queued':'disabled');}
  function document(){const row=db.prepare('SELECT * FROM workspace WHERE id=1').get();return {...row,draft:row.draft?JSON.parse(row.draft):null,published:JSON.parse(row.published)};}
  function manager(user){if(user.role!=='manager')failure(403,'Manager access is required.');}
  function requireRevision(body,doc){if(!Number.isInteger(body.revision)||body.revision!==doc.revision)failure(409,'The team draft changed on another device. Export your draft, then load the latest version before trying again.');}
  function persistDraft(user,data,revision,action){db.prepare('UPDATE workspace SET draft=?,revision=revision+1 WHERE id=1').run(JSON.stringify(data));db.prepare('INSERT OR REPLACE INTO snapshots(revision,data,at) VALUES(?,?,?)').run(revision+1,JSON.stringify(data),now());db.prepare('DELETE FROM snapshots WHERE revision < ?').run(Math.max(0,revision-100));audit(user,action,{revision:revision+1});}
  function matchesDraft(doc,row) {
    const current=W.occurrences(doc.draft,row.dayKey,row.dayKey).find(s=>s.key===row.key);
    return current && JSON.stringify(current)===JSON.stringify(row);
  }
  function swapFits(doc,source,target) {
    if(!target || target.caregiverId==='Open' || target.caregiverId===source.caregiverId || !matchesDraft(doc,source) || !matchesDraft(doc,target))return false;
    const model=W.model(doc.draft);model.assignments={...model.assignments,[source.key]:target.caregiverId,[target.key]:source.caregiverId};
    return [[source,target.caregiverId],[target,source.caregiverId]].every(([row,id])=>R.evaluate(model,{dayKey:row.dayKey,shiftName:row.shiftName,caregiverId:id,start:row.startTime,end:row.endTime})?.safe);
  }
  function userView(user){return {id:user.id,name:user.name,email:user.email,role:user.role,caregiverId:user.caregiver_id,emailEnabled:Boolean(user.email_enabled),reminders:Boolean(user.reminders)};}
  function validateMembership(email,role,caregiverId){
    if(role==='caregiver'){
      if(!document().draft?.caregivers.some(p=>p.id===caregiverId))failure(400,'Choose an existing caregiver profile.');
      if(db.prepare('SELECT id FROM users WHERE caregiver_id=? AND email<>?').get(caregiverId,email))failure(409,'That caregiver profile is already linked to another account.');
      const existing=db.prepare('SELECT role FROM users WHERE email=?').get(email);
      if(existing?.role==='manager'&&db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='manager'").get().count<=1)failure(409,'Keep at least one manager account.');
    }
  }
  function authenticate(req){const cookie=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('curavela_session='));if(!cookie)return null;return db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.hash=? AND sessions.expires>?').get(digest(cookie.slice(17)),Date.now());}
  function setSession(res,user){const secret=token();db.prepare('INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)').run(digest(secret),user.id,Date.now()+12*60*60*1000);res.setHeader('Set-Cookie','curavela_session='+secret+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200'+(secure?'; Secure':''));}
  function rateLimit(req){const key=req.socket.remoteAddress||'unknown',time=Date.now();let entry=limits.get(key);if(!entry||entry.until<time){entry={count:0,until:time+15*60*1000};limits.set(key,entry);}if(++entry.count>30)failure(429,'Too many sign-in attempts. Try again in 15 minutes.');if(limits.size>10000)for(const [k,v] of limits)if(v.until<time)limits.delete(k);}
  async function readBody(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4*1024*1024)failure(413,'The request is too large.');}try{return JSON.parse(raw||'{}');}catch{failure(400,'Invalid JSON request.');}}
  function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
  function createInvite(email,role,caregiverId){if(!emailValid(email)||!['manager','caregiver'].includes(role))failure(400,'Choose a valid email and role.');email=email.toLowerCase();validateMembership(email,role,caregiverId);const secret=token();db.prepare('UPDATE invites SET used=1 WHERE email=?').run(email);db.prepare('INSERT INTO invites(hash,email,role,caregiver_id,expires) VALUES(?,?,?,?,?)').run(digest(secret),email,role,role==='caregiver'?caregiverId:null,Date.now()+72*60*60*1000);return origin+'/#invite='+secret;}
  async function api(req,res,url) {
    const method=req.method;
    if(method!=='GET'&&(req.headers.origin!==origin||req.headers['x-curavela-request']!=='1'))failure(403,'This request must come from the Curavela app.');
    const body=method==='GET'?{}:await readBody(req);
    if(url.pathname==='/api/login'&&method==='POST'){
      rateLimit(req);const email=String(body.email||'').toLowerCase();const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
      const hash=await hashPassword(body.password,user?.salt||'invalid-account-salt');
      if(!user||!crypto.timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(user.password,'hex')))failure(401,'Email or password is incorrect.');
      setSession(res,user);return send(res,200,{user:userView(user)});
    }
    if(url.pathname==='/api/accept-invite'&&method==='POST'){
      rateLimit(req);const invitation=db.prepare('SELECT * FROM invites WHERE hash=? AND used=0 AND expires>?').get(digest(body.token),Date.now());
      if(!invitation)failure(400,'This invitation has expired or has already been used.');
      if(typeof body.name!=='string'||!body.name.trim()||body.name.length>200)failure(400,'Enter your name.');
      const salt=token(),hash=await hashPassword(body.password,salt);
      const user=tx(()=>{
        const current=db.prepare('SELECT * FROM invites WHERE hash=? AND used=0 AND expires>?').get(digest(body.token),Date.now());if(!current)failure(400,'Invitation no longer available.');
        validateMembership(current.email,current.role,current.caregiver_id);
        const existing=db.prepare('SELECT * FROM users WHERE email=?').get(current.email),id=existing?.id||crypto.randomUUID();
        db.prepare('INSERT INTO users(id,email,name,role,caregiver_id,salt,password) VALUES(?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,caregiver_id=excluded.caregiver_id,salt=excluded.salt,password=excluded.password').run(id,current.email,body.name.trim(),current.role,current.caregiver_id,salt,hash);
        db.prepare('UPDATE invites SET used=1 WHERE hash=?').run(digest(body.token));db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);return db.prepare('SELECT * FROM users WHERE id=?').get(id);
      });setSession(res,user);return send(res,200,{user:userView(user)});
    }
    const user=authenticate(req);
    if(url.pathname==='/api/session'&&method==='GET')return send(res,200,{user:user?userView(user):null,timeZone,emailConfigured:Boolean(options.sendEmail)});
    if(!user)failure(401,'Please sign in.');
    if(url.pathname==='/api/logout'&&method==='POST'){db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);res.setHeader('Set-Cookie','curavela_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+(secure?'; Secure':''));return send(res,200,{ok:true});}
    if(url.pathname==='/api/preferences'&&method==='POST'){db.prepare('UPDATE users SET email_enabled=?,reminders=? WHERE id=?').run(body.emailEnabled===true?1:0,body.reminders===true?1:0,user.id);return send(res,200,{ok:true});}
    if(url.pathname==='/api/invitations'&&method==='POST'){manager(user);const link=createInvite(body.email,body.role,body.caregiverId);audit(user,'Create invitation',{email:body.email,role:body.role});return send(res,201,{link});}
    if(url.pathname==='/api/members'&&method==='GET'){manager(user);return send(res,200,{members:db.prepare('SELECT id,name,email,role,caregiver_id FROM users').all()});}
    if(url.pathname==='/api/draft'&&method==='GET'){manager(user);const doc=document();return send(res,200,{snapshot:doc.draft,revision:doc.revision,publishedVersion:doc.published_version});}
    if(url.pathname==='/api/draft'&&method==='PUT'){manager(user);const data=W.validateBackup(body.snapshot);const revision=tx(()=>{const doc=document();requireRevision(body,doc);persistDraft(user,data,doc.revision,'Save team draft');return doc.revision+1;});return send(res,200,{revision});}
    if(url.pathname==='/api/publish'&&method==='POST'){
      manager(user);if(!Number.isFinite(R.dateNumber(body.first))||!Number.isFinite(R.dateNumber(body.last))||body.last<body.first||R.dateNumber(body.last)-R.dateNumber(body.first)>366*1440)failure(400,'Choose a publication range of up to one year.');
      const result=tx(()=>{const doc=document();requireRevision(body,doc);if(!doc.draft)failure(400,'Sync a draft first.');const warnings=R.getWarnings(W.model(doc.draft),body.first,body.last);
        if(warnings.some(w=>w.blocking))failure(400,'Resolve blocking conflicts before publishing: '+warnings.filter(w=>w.blocking).map(w=>w.text).join(' '));
        if(warnings.length&&body.confirmWarnings!==true)return {warnings};
        const next=W.occurrences(doc.draft,body.first,body.last),old=new Map(doc.published.map(s=>[s.key,s]));
        const rows=doc.published.filter(s=>s.dayKey<body.first||s.dayKey>body.last).concat(next),version=doc.published_version+1;
        db.prepare('UPDATE workspace SET published=?,published_version=? WHERE id=1').run(JSON.stringify(rows),version);
        const nextKeys=new Set(next.map(row=>row.key));
        const removed=doc.published.filter(row=>row.dayKey>=body.first&&row.dayKey<=body.last&&!nextKeys.has(row.key));
        for(const row of removed){const recipient=db.prepare('SELECT id FROM users WHERE caregiver_id=?').get(row.caregiverId);if(recipient)notify(recipient.id,'removed:'+version+':'+row.key+':'+recipient.id,'Shift removed: '+row.dayKey+' '+row.shiftName+'. Check My shifts for the current schedule.');}
        for(const row of next){const before=old.get(row.key);if(JSON.stringify(before)===JSON.stringify(row))continue;for(const id of new Set([before?.caregiverId,row.caregiverId])){const recipient=db.prepare('SELECT id FROM users WHERE caregiver_id=?').get(id||'');if(recipient)notify(recipient.id,'publish:'+version+':'+row.key+':'+recipient.id,'Schedule updated: '+row.dayKey+' '+row.shiftName+'. Check My shifts and acknowledge the current assignment.');}}
        audit(user,'Publish schedule',{first:body.first,last:body.last,version,rows:next.map(row=>({key:row.key,before:old.get(row.key)||null,after:row})).concat(removed.map(row=>({key:row.key,before:row,after:null})))});return {version,count:next.length};
      });return send(res,200,result);
    }
    if(url.pathname==='/api/my-shifts'&&method==='GET'){
      const doc=document(),acks=db.prepare('SELECT * FROM acknowledgments WHERE user_id=?').all(user.id);
      const own=doc.published.filter(s=>s.caregiverId===user.caregiver_id).map(s=>({...s,acknowledged:acks.some(a=>a.shift_key===s.key&&a.fingerprint===digest(JSON.stringify(s)))}));
      const open=doc.published.filter(s=>s.caregiverId==='Open').map(s=>{const candidate=doc.draft&&R.evaluate(W.model(doc.draft),{dayKey:s.dayKey,shiftName:s.shiftName,caregiverId:user.caregiver_id,start:s.startTime,end:s.endTime});return {...s,eligible:Boolean(candidate?.safe)};}).filter(s=>s.eligible);
      return send(res,200,{shifts:own,open,version:doc.published_version,timeZone});
    }
    if(url.pathname==='/api/acknowledge'&&method==='POST'){const row=document().published.find(s=>s.key===body.key&&s.caregiverId===user.caregiver_id);if(!row)failure(404,'That published shift is not assigned to you.');db.prepare('INSERT INTO acknowledgments(user_id,shift_key,fingerprint,at) VALUES(?,?,?,?) ON CONFLICT(user_id,shift_key) DO UPDATE SET fingerprint=excluded.fingerprint,at=excluded.at').run(user.id,row.key,digest(JSON.stringify(row)),now());return send(res,200,{ok:true});}
    if(url.pathname==='/api/acknowledgments'&&method==='GET'){manager(user);const doc=document();return send(res,200,{shifts:doc.published.filter(s=>s.caregiverId!=='Open').map(s=>{const ack=db.prepare('SELECT a.* FROM acknowledgments a JOIN users u ON u.id=a.user_id WHERE u.caregiver_id=? AND a.shift_key=?').get(s.caregiverId,s.key);return {...s,acknowledged:Boolean(ack&&ack.fingerprint===digest(JSON.stringify(s)))};})});}
    if(url.pathname==='/api/requests'&&method==='GET'){const list=user.role==='manager'?db.prepare('SELECT requests.*,users.name FROM requests JOIN users ON users.id=requests.user_id ORDER BY at DESC').all():db.prepare('SELECT * FROM requests WHERE user_id=? ORDER BY at DESC').all(user.id);return send(res,200,{requests:list.map(r=>({...r,payload:JSON.parse(r.payload)}))});}
    if(url.pathname==='/api/swap-options'&&method==='GET'){
      const doc=document(),source=doc.published.find(s=>s.key===url.searchParams.get('key')&&s.caregiverId===user.caregiver_id);
      if(!source||!doc.draft)failure(404,'That shift is not assigned to you.');
      const candidates=doc.published.filter(s=>s.caregiverId!=='Open'&&s.caregiverId!==source.caregiverId&&s.dayKey>=new Date().toISOString().slice(0,10)).slice(0,500);
      return send(res,200,{shifts:candidates.filter(s=>swapFits(doc,source,s)&&db.prepare('SELECT id FROM users WHERE caregiver_id=?').get(s.caregiverId)).map(s=>({...s,caregiverName:doc.draft.caregivers.find(c=>c.id===s.caregiverId)?.name||'Caregiver'}))});
    }
    if(url.pathname==='/api/requests'&&method==='POST'){
      if(user.role!=='caregiver'||!user.caregiver_id)failure(403,'A linked caregiver account is required.');
      if(!['time-off','claim','release','swap'].includes(body.kind))failure(400,'Unknown request type.');
      const doc=document(),payload={};
      if(body.kind==='time-off'){if(!R.timeOffInterval(body))failure(400,'Choose valid time-off dates.');payload.startDate=body.startDate;payload.endDate=body.endDate;}
      else {const row=doc.published.find(s=>s.key===body.key);if(!row||(body.kind==='claim'?row.caregiverId!=='Open':row.caregiverId!==user.caregiver_id))failure(400,'That shift is no longer available for this request.');payload.key=row.key;payload.fingerprint=digest(JSON.stringify(row));if(body.kind==='swap'){
        const other=doc.published.find(s=>s.key===body.targetKey),target=other&&db.prepare('SELECT id,caregiver_id FROM users WHERE caregiver_id=? AND role=\'caregiver\'').get(other.caregiverId);
        if(!target||target.id===user.id||!swapFits(doc,row,other))failure(400,'That swap is no longer compatible with the schedule.');
        payload.targetId=target.id;payload.targetCaregiver=target.caregiver_id;payload.targetKey=other.key;payload.targetFingerprint=digest(JSON.stringify(other));
      }}
      const id=crypto.randomUUID();db.prepare('INSERT INTO requests(id,user_id,kind,payload,at) VALUES(?,?,?,?,?)').run(id,user.id,body.kind,JSON.stringify(payload),now());
      db.prepare('SELECT id FROM users WHERE role=\'manager\'').all().forEach(m=>notify(m.id,'request:'+id+':'+m.id,user.name+' submitted a '+body.kind+' request.'));
      if(payload.targetId)notify(payload.targetId,'offer:'+id,'A coworker requested that you cover a shift. Contact your manager to confirm before approval.');
      return send(res,201,{id});
    }
    if(url.pathname==='/api/requests/decide'&&method==='POST'){
      manager(user);if(!['approved','declined'].includes(body.decision))failure(400,'Choose approve or decline.');
      const result=tx(()=>{const request=db.prepare('SELECT * FROM requests WHERE id=? AND status=\'pending\'').get(body.id);if(!request)failure(409,'This request has already been handled.');const doc=document();requireRevision(body,doc);const person=db.prepare('SELECT * FROM users WHERE id=?').get(request.user_id),payload=JSON.parse(request.payload);
        if(body.decision==='approved'){
          if(!doc.draft)failure(400,'No team draft exists.');const data=doc.draft;
          if(request.kind==='time-off'){const rule=data.caregiverRules[person.caregiver_id];if(!rule)failure(400,'The caregiver profile no longer exists.');rule.timeOff=(rule.timeOff||[]).concat({startDate:payload.startDate,endDate:payload.endDate});}
          else {
            const published=doc.published.find(s=>s.key===payload.key);
            if(!published||digest(JSON.stringify(published))!==payload.fingerprint||!matchesDraft(doc,published))failure(409,'The requested shift has changed. Ask for a new request.');
            const recipient=request.kind==='release'?'Open':request.kind==='swap'?payload.targetCaregiver:person.caregiver_id;
            if(request.kind==='swap'){
              if(body.coworkerConfirmed!==true)failure(400,'Confirm the other caregiver has agreed before approving the swap.');
              const other=doc.published.find(s=>s.key===payload.targetKey);
              if(!other||digest(JSON.stringify(other))!==payload.targetFingerprint||!swapFits(doc,published,other))failure(409,'The other shift changed or the swap now conflicts.');
              data.scheduleAssignments[other.key]=person.caregiver_id;
              notify(payload.targetId,'swap-approved:'+request.id,'Your manager approved a shift swap in the draft. Wait for the published update.');
            }
            if(recipient!=='Open'){
              const candidate=R.evaluate(W.model(data),{dayKey:published.dayKey,shiftName:published.shiftName,caregiverId:recipient,start:published.startTime,end:published.endTime});
              if(!candidate||!candidate.safe)failure(400,'This request conflicts with caregiver availability or scheduling rules.');
            }
            data.scheduleAssignments[payload.key]=recipient;
          }

          persistDraft(user,W.validateBackup(data),doc.revision,'Approve '+request.kind+' request');
        }
        db.prepare('UPDATE requests SET status=?,decision=? WHERE id=?').run(body.decision,user.id,request.id);audit(user,'Decide request',{id:request.id,decision:body.decision});notify(person.id,'decision:'+request.id,'Your '+request.kind+' request was '+body.decision+(body.decision==='approved'?'. The manager must publish schedule changes before they appear in My shifts.':'.'));return {revision:document().revision};
      });return send(res,200,result);
    }
    if(url.pathname==='/api/notifications'&&method==='GET'){return send(res,200,{notifications:db.prepare('SELECT id,message,at,is_read,email_state FROM notifications WHERE user_id=? ORDER BY at DESC LIMIT 100').all(user.id)});}
    if(url.pathname==='/api/notifications/read'&&method==='POST'){db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(body.id,user.id);return send(res,200,{ok:true});}
    if(url.pathname==='/api/history'&&method==='GET'){manager(user);return send(res,200,{history:db.prepare('SELECT history.*,users.name FROM history LEFT JOIN users ON users.id=history.actor ORDER BY history.id DESC LIMIT 100').all().map(h=>({...h,details:JSON.parse(h.details)}))});}
    failure(404,'Not found.');
  }
  const assets=new Set(['index.html','style.css','enhancements.css','responsive.css','scheduling.js','workspace.js','editing.js','timeoff.js','script.js','workspace-ui.js','team.js']);
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try{
      const url=new URL(req.url,origin);
      if(url.pathname.startsWith('/api/'))return await api(req,res,url);
      const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
      if(!assets.has(file)||!['GET','HEAD'].includes(req.method))failure(404,'Not found.');
      const content=fs.readFileSync(path.join(__dirname,'..',file));res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);
    }catch(error){if(!res.headersSent)send(res,error.status||400,{error:error.status?error.message:'The request could not be completed. '+(options.testing?error.message:'Check your entries and try again.')});else res.end();}
  });
  async function processNotifications(){
    const doc=document();
    for(const row of doc.published){const users=db.prepare('SELECT * FROM users WHERE caregiver_id=? AND reminders=1').all(row.caregiverId);const starts=new Date(row.dayKey+'T'+row.startTime+':00').getTime();if(starts<Date.now()||starts>Date.now()+60*60*1000)continue;for(const user of users)notify(user.id,'reminder:'+digest(JSON.stringify(row))+':'+user.id,'Your '+row.shiftName+' shift starts at '+row.startTime+' on '+row.dayKey+' ('+timeZone+').');}
    if(!options.sendEmail)return;
    for(const notification of db.prepare('SELECT n.*,u.email,u.email_enabled FROM notifications n JOIN users u ON u.id=n.user_id WHERE n.email_state IN (\'queued\',\'failed\') AND n.attempts<3').all()){
      if(!notification.email_enabled){db.prepare('UPDATE notifications SET email_state=\'disabled\' WHERE id=?').run(notification.id);continue;}
      try{await options.sendEmail(notification.email,notification.message,notification.id);db.prepare('UPDATE notifications SET email_state=\'accepted\',attempts=attempts+1 WHERE id=?').run(notification.id);}catch{db.prepare('UPDATE notifications SET email_state=\'failed\',attempts=attempts+1 WHERE id=?').run(notification.id);}
    }
  }
  return {server,db,createInvite,processNotifications,close(){db.close();}};
}
module.exports={createApplication};
