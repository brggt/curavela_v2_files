'use strict';
// SQLite-consistent backup, including active WAL transactions. Run on the host.
const {DatabaseSync,backup}=require('node:sqlite');
const fs=require('node:fs');
const path=require('node:path');
async function main(){
  const source=path.join(process.env.CURAVELA_DATA_DIR||'./data','curavela.sqlite');
  const destination=process.argv[2];
  if(!destination)throw new Error('Usage: node server/backup.js /private/path/curavela-backup.sqlite');
  if(fs.existsSync(destination))throw new Error('Choose a new backup filename; existing files will not be replaced.');
  process.umask(0o077);
  const db=new DatabaseSync(source,{readOnly:true});
  try{await backup(db,destination);fs.chmodSync(destination,0o600);console.log('Backup saved: '+path.resolve(destination));}finally{db.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
