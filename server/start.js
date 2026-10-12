'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createApplication}=require('./app.js');
const port=Number(process.env.PORT||3000),origin=process.env.PUBLIC_URL||'http://localhost:'+port;
const url=new URL(origin);
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&url.protocol!=='https:')throw new Error('PUBLIC_URL must use HTTPS for a hosted team server.');
const timeZone=process.env.CARE_TIME_ZONE||'UTC';new Intl.DateTimeFormat('en',{timeZone}).format();process.env.TZ=timeZone;
const dataDirectory=process.env.CURAVELA_DATA_DIR||path.join(__dirname,'..','data');fs.mkdirSync(dataDirectory,{recursive:true,mode:0o700});
const relay=process.env.EMAIL_RELAY_URL,relayToken=process.env.EMAIL_RELAY_TOKEN;
if(relay&&(!relay.startsWith('https://')||!relayToken))throw new Error('Email relay requires an HTTPS endpoint and EMAIL_RELAY_TOKEN.');
const sendEmail=relay?async(to,message,id)=>{
  const response=await fetch(relay,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+relayToken,'Idempotency-Key':id},body:JSON.stringify({to,subject:'Curavela schedule update',text:message+'\n\n'+origin,id}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Email relay rejected notification.');
}:undefined;
const app=createApplication({dbPath:path.join(dataDirectory,'curavela.sqlite'),origin,timeZone,sendEmail});
if(!app.db.prepare('SELECT id FROM users WHERE role=\'manager\'').get()){
  const email=process.env.BOOTSTRAP_EMAIL;
  if(!email)throw new Error('Set BOOTSTRAP_EMAIL to create the first manager invitation.');
  console.log('First manager invitation (keep private): '+app.createInvite(email,'manager'));
}
app.server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log('Curavela listening on '+origin));
let processing=false;
const timer=setInterval(async()=>{if(processing)return;processing=true;try{await app.processNotifications();}catch(error){console.error('Notification processing failed.');}finally{processing=false;}},60000);
function shutdown(){clearInterval(timer);app.server.close(()=>{app.close();process.exit(0);});}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
