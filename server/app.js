'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const {DatabaseSync}=require('node:sqlite');
const W=require('../workspace.js');
const R=require('../scheduling.js');
const C=require('../calendar.js');
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
  db.exec(`CREATE TABLE IF NOT EXISTS swap_responses(request_id TEXT PRIMARY KEY REFERENCES requests(id),user_id TEXT NOT NULL REFERENCES users(id),decision TEXT NOT NULL CHECK(decision IN ('accepted','declined')),at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS calendar_tokens(user_id TEXT PRIMARY KEY REFERENCES users(id),hash TEXT UNIQUE NOT NULL,at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS calendar_removals(user_id TEXT NOT NULL REFERENCES users(id),shift_key TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(user_id,shift_key));
    CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);

  db.exec(`CREATE TABLE IF NOT EXISTS team_messages(
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL CHECK(channel IN ('caregiver','schedule')),
    request_id TEXT REFERENCES requests(id),
    sender_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    at TEXT NOT NULL,
    CHECK((channel='caregiver' AND request_id IS NULL) OR (channel='schedule' AND request_id IS NOT NULL))
  );
  CREATE INDEX IF NOT EXISTS team_messages_channel_time ON team_messages(channel,at);
  CREATE INDEX IF NOT EXISTS team_messages_request_time ON team_messages(request_id,at);`);
  const origin=options.origin||'http://localhost:3000', secure=origin.startsWith('https:'),timeZone=options.timeZone||'UTC';
  const limits=new Map();
  function tx(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
  function audit(user,action,details={}){db.prepare('INSERT INTO history(actor,at,action,details) VALUES(?,?,?,?)').run(user.id,now(),action,JSON.stringify(details));}
  function notify(userId,event,message){const user=db.prepare('SELECT * FROM users WHERE id=?').get(userId);if(!user)return;db.prepare('INSERT OR IGNORE INTO notifications(id,user_id,event_key,message,at,email_state) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),userId,event,message,now(),user.email_enabled&&options.sendEmail?'queued':'disabled');}
  function document(){const row=db.prepare('SELECT * FROM workspace WHERE id=1').get();return {...row,draft:row.draft?JSON.parse(row.draft):null,published:JSON.parse(row.published)};}
  function manager(user){if(user.role!=='manager')failure(403,'Manager access is required.');}
  function requireRevision(body,doc){if(!Number.isInteger(body.revision)||body.revision!==doc.revision)failure(409,'The team draft changed on another device. Export your draft, then load the latest version before trying again.');}
  function persistDraft(user,data,revision,action){
    const before=document().draft,changes=W.changes(before,data);
    db.prepare('UPDATE workspace SET draft=?,revision=revision+1 WHERE id=1').run(JSON.stringify(data));
    db.prepare('INSERT OR REPLACE INTO snapshots(revision,data,at) VALUES(?,?,?)').run(revision+1,JSON.stringify(data),now());
    db.prepare('DELETE FROM snapshots WHERE revision < ?').run(Math.max(0,revision-98));
    audit(user,action,{revision:revision+1,changes:changes.slice(0,500),changeCount:changes.length});
  }
  function matchesDraft(doc,row) {
    const current=W.occurrences(doc.draft,row.dayKey,row.dayKey).find(s=>s.key===row.key);
    return current && ['key','dayKey','shiftName','startTime','endTime','caregiverId','note'].every(key=>(current[key]||'')===(row[key]||''));
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
        db.prepare('UPDATE invites SET used=1 WHERE hash=?').run(digest(body.token));db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);db.prepare('DELETE FROM calendar_tokens WHERE user_id=?').run(id);return db.prepare('SELECT * FROM users WHERE id=?').get(id);
      });setSession(res,user);return send(res,200,{user:userView(user)});
    }
    if(url.pathname.startsWith('/api/calendar/')&&method==='GET'){
      const secret=url.pathname.slice('/api/calendar/'.length).replace(/\.ics$/,'');
      if(!/^[A-Za-z0-9_-]{43}$/.test(secret))failure(404,'Calendar link unavailable.');
      const owner=db.prepare("SELECT users.* FROM calendar_tokens JOIN users ON users.id=calendar_tokens.user_id WHERE calendar_tokens.hash=? AND users.role='caregiver'").get(digest(secret));
      if(!owner||!owner.caregiver_id)failure(404,'Calendar link unavailable.');
      const doc=document(),rows=doc.published.filter(row=>row.caregiverId===owner.caregiver_id);
      const removed=db.prepare('SELECT data FROM calendar_removals WHERE user_id=?').all(owner.id).map(row=>({...JSON.parse(row.data),cancelled:true}));
      const calendar=C.serialize(rows.concat(removed),{timeZone,scope:origin+':'+owner.id,name:'Curavela shifts',sequence:doc.published_version,updatedAt:db.prepare("SELECT value FROM metadata WHERE key='published_at'").get()?.value||'2026-01-01T00:00:00Z'});
      res.writeHead(200,{'Content-Type':'text/calendar; charset=utf-8','Cache-Control':'no-store','Content-Disposition':'inline; filename="curavela-shifts.ics"'});res.end(calendar);return;
    }
    const user=authenticate(req);
    if(url.pathname==='/api/session'&&method==='GET')return send(res,200,{user:user?userView(user):null,timeZone,emailConfigured:Boolean(options.sendEmail)});
    if(!user)failure(401,'Please sign in.');
    if(url.pathname==='/api/logout'&&method==='POST'){db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);res.setHeader('Set-Cookie','curavela_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+(secure?'; Secure':''));return send(res,200,{ok:true});}
    if(url.pathname==='/api/preferences'&&method==='POST'){db.prepare('UPDATE users SET email_enabled=?,reminders=? WHERE id=?').run(body.emailEnabled===true?1:0,body.reminders===true?1:0,user.id);return send(res,200,{ok:true});}
    if(url.pathname==='/api/calendar-link'&&method==='POST'){
      if(user.role!=='caregiver'||!user.caregiver_id)failure(403,'A linked caregiver account is required.');
      const secret=token();db.prepare('INSERT INTO calendar_tokens(user_id,hash,at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET hash=excluded.hash,at=excluded.at').run(user.id,digest(secret),now());
      audit(user,'Rotate private calendar link');return send(res,200,{link:origin+'/api/calendar/'+secret+'.ics'});
    }
    if(url.pathname==='/api/calendar-link'&&method==='DELETE'){db.prepare('DELETE FROM calendar_tokens WHERE user_id=?').run(user.id);audit(user,'Revoke private calendar link');return send(res,200,{ok:true});}
    if(url.pathname==='/api/snapshots'&&method==='GET'){manager(user);return send(res,200,{snapshots:db.prepare('SELECT revision,at FROM snapshots ORDER BY revision DESC LIMIT 100').all(),revision:document().revision});}
    if(url.pathname==='/api/snapshots/preview'&&method==='POST'){
      manager(user);const doc=document();requireRevision(body,doc);const saved=db.prepare('SELECT data,at FROM snapshots WHERE revision=?').get(body.targetRevision);if(!saved)failure(404,'That saved revision is no longer available.');
      const data=W.validateBackup(JSON.parse(saved.data)),changes=W.changes(doc.draft,data);
      return send(res,200,{revision:doc.revision,targetRevision:body.targetRevision,at:saved.at,changes:changes.slice(0,500),changeCount:changes.length});
    }
    if(url.pathname==='/api/snapshots/restore'&&method==='POST'){
      manager(user);const revision=tx(()=>{const doc=document();requireRevision(body,doc);const saved=db.prepare('SELECT data FROM snapshots WHERE revision=?').get(body.targetRevision);if(!saved)failure(404,'That saved revision is no longer available.');persistDraft(user,W.validateBackup(JSON.parse(saved.data)),doc.revision,'Restore draft revision '+body.targetRevision);return doc.revision+1;});return send(res,200,{revision});
    }
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
        // Validate DST edge cases before publishing or notifying caregivers.
        C.serialize(next,{timeZone,scope:origin});
        const rows=doc.published.filter(s=>s.dayKey<body.first||s.dayKey>body.last).concat(next),version=doc.published_version+1;
        db.prepare('UPDATE workspace SET published=?,published_version=? WHERE id=1').run(JSON.stringify(rows),version);
        db.prepare("INSERT INTO metadata(key,value) VALUES('published_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(now());
        const nextByKey=new Map(next.map(row=>[row.key,row]));
        for(const previous of doc.published.filter(row=>row.dayKey>=body.first&&row.dayKey<=body.last)){
          if(previous.caregiverId==='Open'||nextByKey.get(previous.key)?.caregiverId===previous.caregiverId)continue;
          const owner=db.prepare('SELECT id FROM users WHERE caregiver_id=?').get(previous.caregiverId);
          if(owner)db.prepare('INSERT INTO calendar_removals(user_id,shift_key,data) VALUES(?,?,?) ON CONFLICT(user_id,shift_key) DO UPDATE SET data=excluded.data').run(owner.id,previous.key,JSON.stringify(previous));
        }
        for(const row of next){const owner=db.prepare('SELECT id FROM users WHERE caregiver_id=?').get(row.caregiverId);if(owner)db.prepare('DELETE FROM calendar_removals WHERE user_id=? AND shift_key=?').run(owner.id,row.key);}
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
      const open=doc.published.filter(s=>s.caregiverId==='Open').map(s=>{const candidate=doc.draft&&R.evaluate(W.model(doc.draft),{dayKey:s.dayKey,shiftName:s.shiftName,caregiverId:user.caregiver_id,start:s.startTime,end:s.endTime});const {note,...publicSlot}=s;return {...publicSlot,eligible:Boolean(candidate?.safe)};}).filter(s=>s.eligible);
      return send(res,200,{shifts:own,open,version:doc.published_version,timeZone});
    }
    if(url.pathname==='/api/acknowledge'&&method==='POST'){const row=document().published.find(s=>s.key===body.key&&s.caregiverId===user.caregiver_id);if(!row)failure(404,'That published shift is not assigned to you.');db.prepare('INSERT INTO acknowledgments(user_id,shift_key,fingerprint,at) VALUES(?,?,?,?) ON CONFLICT(user_id,shift_key) DO UPDATE SET fingerprint=excluded.fingerprint,at=excluded.at').run(user.id,row.key,digest(JSON.stringify(row)),now());return send(res,200,{ok:true});}
    if(url.pathname==='/api/acknowledgments'&&method==='GET'){manager(user);const doc=document();return send(res,200,{shifts:doc.published.filter(s=>s.caregiverId!=='Open').map(s=>{const ack=db.prepare('SELECT a.* FROM acknowledgments a JOIN users u ON u.id=a.user_id WHERE u.caregiver_id=? AND a.shift_key=?').get(s.caregiverId,s.key);return {...s,acknowledged:Boolean(ack&&ack.fingerprint===digest(JSON.stringify(s)))};})});}
    // Only authenticated teammates may read/write messages. Schedule threads
    // belong to a specific coverage request; arbitrary shift IDs grant no access.
    if(url.pathname==='/api/messages' && ['GET','POST'].includes(method)){
      const channel=method==='GET'?url.searchParams.get('channel'):body.channel;
      if(!['caregiver','schedule'].includes(channel))failure(400,'Choose Caregiver Chat or a Schedule request.');
      const requestId=method==='GET'?url.searchParams.get('requestId'):body.requestId;
      let related=null;
      if(channel==='schedule'){
        if(typeof requestId!=='string'||requestId.length>100)failure(400,'Choose a valid schedule request.');
        related=db.prepare('SELECT * FROM requests WHERE id=?').get(requestId);
        if(!related || !['claim','release','swap'].includes(related.kind))failure(404,'Schedule conversation unavailable.');
        const details=JSON.parse(related.payload);
        if(user.role!=='manager' && related.user_id!==user.id && details.targetId!==user.id)failure(403,'This conversation is private to its participants.');
      }else if(requestId)failure(400,'Caregiver Chat does not accept request IDs.');
      if(method==='GET'){
        const rows=channel==='caregiver'
          ?db.prepare("SELECT m.id,m.channel,m.request_id AS requestId,m.body,m.at,m.sender_id AS senderId,u.name AS senderName FROM team_messages m JOIN users u ON u.id=m.sender_id WHERE m.channel='caregiver' ORDER BY m.at DESC,m.rowid DESC LIMIT 100").all()
          :db.prepare("SELECT m.id,m.channel,m.request_id AS requestId,m.body,m.at,m.sender_id AS senderId,u.name AS senderName FROM team_messages m JOIN users u ON u.id=m.sender_id WHERE m.channel='schedule' AND m.request_id=? ORDER BY m.at DESC,m.rowid DESC LIMIT 100").all(requestId);
        return send(res,200,{messages:rows.reverse(),status:related?.status||null});
      }
      if(typeof body.text!=='string'||!body.text.trim()||body.text.trim().length>2000)failure(400,'Write a message between 1 and 2000 characters.');
      if(related?.status!=='pending' && channel==='schedule')failure(409,'This request is closed. Its conversation is read-only.');
      const messageId=crypto.randomUUID();
      db.prepare('INSERT INTO team_messages(id,channel,request_id,sender_id,body,at) VALUES(?,?,?,?,?,?)')
        .run(messageId,channel,channel==='schedule'?requestId:null,user.id,body.text.trim(),now());
      audit(user,'Send team message',{channel,requestId:channel==='schedule'?requestId:null,messageId});
      if(related){
        const payload=JSON.parse(related.payload);
        const recipients=new Set([related.user_id,payload.targetId]);
        if(user.role==='manager'){}else db.prepare("SELECT id FROM users WHERE role='manager'").all().forEach(row=>recipients.add(row.id));
        recipients.delete(user.id);
        for(const id of recipients)if(id)notify(id,'message:'+messageId+':'+id,'New message in a schedule request. Open Team Communications.');
      }
      return send(res,201,{id:messageId});
    }
    if(url.pathname==='/api/requests'&&method==='GET'){
      const list=db.prepare('SELECT requests.*,users.name FROM requests JOIN users ON users.id=requests.user_id ORDER BY at DESC').all().map(r=>({...r,payload:JSON.parse(r.payload)})).filter(r=>user.role==='manager'||r.user_id===user.id||r.payload.targetId===user.id);
      return send(res,200,{requests:list.map(r=>({...r,consent:db.prepare('SELECT decision,at FROM swap_responses WHERE request_id=?').get(r.id)||null,incoming:r.payload.targetId===user.id}))});
    }
    if(url.pathname==='/api/requests/respond'&&method==='POST'){
      if(!['accepted','declined'].includes(body.decision))failure(400,'Choose accept or decline.');
      tx(()=>{
        const request=db.prepare("SELECT * FROM requests WHERE id=? AND kind='swap' AND status='pending'").get(body.id);
        if(!request)failure(409,'This swap is no longer pending.');const payload=JSON.parse(request.payload);
        if(payload.targetId!==user.id||user.role!=='caregiver'||payload.targetCaregiver!==user.caregiver_id)failure(403,'Only the requested coworker can respond.');
        if(db.prepare('SELECT request_id FROM swap_responses WHERE request_id=?').get(request.id))failure(409,'You already responded to this swap.');
        const doc=document(),source=doc.published.find(s=>s.key===payload.key),target=doc.published.find(s=>s.key===payload.targetKey);
        if(body.decision==='accepted'&&(!source||!target||digest(JSON.stringify(source))!==payload.fingerprint||digest(JSON.stringify(target))!==payload.targetFingerprint||!swapFits(doc,source,target)))failure(409,'These shifts changed or now conflict. Ask for a new swap request.');
        db.prepare('INSERT INTO swap_responses(request_id,user_id,decision,at) VALUES(?,?,?,?)').run(request.id,user.id,body.decision,now());
        if(body.decision==='declined')db.prepare("UPDATE requests SET status='declined',decision=? WHERE id=?").run(user.id,request.id);
        audit(user,'Respond to shift swap',{id:request.id,decision:body.decision});
        notify(request.user_id,'swap-response:'+request.id,'Your coworker '+body.decision+' the swap.'+(body.decision==='accepted'?' Manager approval and publication are still required.':''));
        db.prepare("SELECT id FROM users WHERE role='manager'").all().forEach(m=>notify(m.id,'swap-response:'+request.id+':'+m.id,'A coworker '+body.decision+' a pending swap.'));
      });return send(res,200,{ok:true});
    }
    if(url.pathname==='/api/swap-options'&&method==='GET'){
      const doc=document(),source=doc.published.find(s=>s.key===url.searchParams.get('key')&&s.caregiverId===user.caregiver_id);
      if(!source||!doc.draft)failure(404,'That shift is not assigned to you.');
      const candidates=doc.published.filter(s=>s.caregiverId!=='Open'&&s.caregiverId!==source.caregiverId&&s.dayKey>=new Date().toISOString().slice(0,10)).slice(0,500);
      return send(res,200,{shifts:candidates.filter(s=>swapFits(doc,source,s)&&db.prepare('SELECT id FROM users WHERE caregiver_id=?').get(s.caregiverId)).map(s=>{const {note,...publicSlot}=s;return {...publicSlot,caregiverName:doc.draft.caregivers.find(c=>c.id===s.caregiverId)?.name||'Caregiver'};})});
    }
    if(url.pathname==='/api/requests'&&method==='POST'){
      if(user.role!=='caregiver'||!user.caregiver_id)failure(403,'A linked caregiver account is required.');
      if(!['time-off','claim','release','swap'].includes(body.kind))failure(400,'Unknown request type.');
      const doc=document(),payload={};
      if(body.kind==='time-off'){if(!R.timeOffInterval(body))failure(400,'Choose valid time-off dates.');payload.startDate=body.startDate;payload.endDate=body.endDate;if(body.allDay===false||body.startTime!==undefined||body.endTime!==undefined){payload.allDay=false;payload.startTime=body.startTime;payload.endTime=body.endTime;}}
      else {const row=doc.published.find(s=>s.key===body.key);if(!row||(body.kind==='claim'?row.caregiverId!=='Open':row.caregiverId!==user.caregiver_id))failure(400,'That shift is no longer available for this request.');payload.key=row.key;payload.fingerprint=digest(JSON.stringify(row));if(body.kind==='swap'){
        const other=doc.published.find(s=>s.key===body.targetKey),target=other&&db.prepare('SELECT id,caregiver_id FROM users WHERE caregiver_id=? AND role=\'caregiver\'').get(other.caregiverId);
        if(!target||target.id===user.id||!swapFits(doc,row,other))failure(400,'That swap is no longer compatible with the schedule.');
        payload.targetId=target.id;payload.targetCaregiver=target.caregiver_id;payload.targetKey=other.key;payload.targetFingerprint=digest(JSON.stringify(other));
      }}
      const id=crypto.randomUUID();db.prepare('INSERT INTO requests(id,user_id,kind,payload,at) VALUES(?,?,?,?,?)').run(id,user.id,body.kind,JSON.stringify(payload),now());
      db.prepare('SELECT id FROM users WHERE role=\'manager\'').all().forEach(m=>notify(m.id,'request:'+id+':'+m.id,user.name+' submitted a '+body.kind+' request.'));
      if(payload.targetId)notify(payload.targetId,'offer:'+id,'A coworker requested a shift swap. Open Team to accept or decline; your manager must then approve and publish it.');
      return send(res,201,{id});
    }
    if(url.pathname==='/api/requests/decide'&&method==='POST'){
      manager(user);if(!['approved','declined'].includes(body.decision))failure(400,'Choose approve or decline.');
      const result=tx(()=>{const request=db.prepare('SELECT * FROM requests WHERE id=? AND status=\'pending\'').get(body.id);if(!request)failure(409,'This request has already been handled.');const doc=document();requireRevision(body,doc);const person=db.prepare('SELECT * FROM users WHERE id=?').get(request.user_id),payload=JSON.parse(request.payload);
        if(body.decision==='approved'){
          if(!doc.draft)failure(400,'No team draft exists.');const data=doc.draft;
          if(request.kind==='time-off'){const rule=data.caregiverRules[person.caregiver_id];if(!rule)failure(400,'The caregiver profile no longer exists.');const span=R.timeOffInterval(payload);if(!span||R.getTimeOffConflicts(rule,span).length)failure(400,'The requested time off overlaps existing time off.');rule.timeOff=(rule.timeOff||[]).concat(payload);}
          else {
            const published=doc.published.find(s=>s.key===payload.key);
            if(!published||digest(JSON.stringify(published))!==payload.fingerprint||!matchesDraft(doc,published))failure(409,'The requested shift has changed. Ask for a new request.');
            const recipient=request.kind==='release'?'Open':request.kind==='swap'?payload.targetCaregiver:person.caregiver_id;
            if(request.kind==='swap'){
              const consent=db.prepare("SELECT * FROM swap_responses WHERE request_id=? AND user_id=? AND decision='accepted'").get(request.id,payload.targetId);if(!consent)failure(400,'The requested coworker must accept this swap from their own account first.');const coworker=db.prepare("SELECT * FROM users WHERE id=? AND role='caregiver'").get(payload.targetId);if(!coworker||coworker.caregiver_id!==payload.targetCaregiver)failure(409,'The coworker account changed. Ask for a new swap request.');
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
  const assets=new Set(['index.html','style.css','enhancements.css','responsive.css','scheduling.js','workspace.js','editing.js','timeoff.js','script.js','workspace-ui.js','team.js','calendar.js','planning-ui.js','pwa.js','sw.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png']);
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try{
      const url=new URL(req.url,origin);
      if(url.pathname.startsWith('/api/'))return await api(req,res,url);
      const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
      if(!assets.has(file)||!['GET','HEAD'].includes(req.method))failure(404,'Not found.');
      const content=fs.readFileSync(path.join(__dirname,'..',file));res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);
    }catch(error){if(!res.headersSent)send(res,error.status||400,{error:error.status?error.message:'The request could not be completed. '+(options.testing?error.message:'Check your entries and try again.')});else res.end();}
  });
  async function processNotifications(){
    const doc=document();
    for(const row of doc.published){const users=db.prepare('SELECT * FROM users WHERE caregiver_id=? AND reminders=1').all(row.caregiverId);const starts=C.toInstant(row.dayKey,row.startTime,timeZone);if(starts<Date.now()||starts>Date.now()+60*60*1000)continue;for(const user of users)notify(user.id,'reminder:'+digest(JSON.stringify(row))+':'+user.id,'Your '+row.shiftName+' shift starts at '+row.startTime+' on '+row.dayKey+' ('+timeZone+').');}
    if(!options.sendEmail)return;
    for(const notification of db.prepare('SELECT n.*,u.email,u.email_enabled FROM notifications n JOIN users u ON u.id=n.user_id WHERE n.email_state IN (\'queued\',\'failed\') AND n.attempts<3').all()){
      if(!notification.email_enabled){db.prepare('UPDATE notifications SET email_state=\'disabled\' WHERE id=?').run(notification.id);continue;}
      try{await options.sendEmail(notification.email,notification.message,notification.id);db.prepare('UPDATE notifications SET email_state=\'accepted\',attempts=attempts+1 WHERE id=?').run(notification.id);}catch{db.prepare('UPDATE notifications SET email_state=\'failed\',attempts=attempts+1 WHERE id=?').run(notification.id);}
    }
  }
  return {server,db,createInvite,processNotifications,close(){db.close();}};
}
module.exports={createApplication};
