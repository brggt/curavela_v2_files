const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(execFile);
test('consistent backup includes committed WAL data and refuses to replace an existing backup',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'curavela-backup-')),source=path.join(directory,'curavela.sqlite'),destination=path.join(directory,'backup.sqlite');
 const db=new DatabaseSync(source);t.after(()=>{db.close();fs.rmSync(directory,{recursive:true,force:true});});
 db.exec('PRAGMA journal_mode=WAL; CREATE TABLE sample(id INTEGER PRIMARY KEY,value TEXT); INSERT INTO sample(value) VALUES(\'saved draft\');');
 const script=path.join(__dirname,'..','server','backup.js'),options={env:{...process.env,CURAVELA_DATA_DIR:directory}};
 await run(process.execPath,[script,destination],options);
 const backup=new DatabaseSync(destination,{readOnly:true});assert.equal(backup.prepare('SELECT value FROM sample').get().value,'saved draft');backup.close();
 assert.equal(fs.statSync(destination).mode&0o777,0o600);
 await assert.rejects(run(process.execPath,[script,destination],options),/existing files will not be replaced/);
});
