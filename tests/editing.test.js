/* Application state tests with DOM/storage stubs. These do not replace browser
 * visual, focus, or touch testing. No real schedules or browser storage are used.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function app() {
  const nodes = new Map(), saved = new Map(), alerts = [], confirmations = [];
  function element() {
    return {
      value: "", textContent: "", innerHTML: "", disabled: false, dataset: {},
      isConnected: true, tabIndex: 0, children: [], listeners: {}, style: { setProperty() {} },
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      get options() { return this.children; },
      setAttribute() {}, removeAttribute() {}, focus() {}, checkValidity() { return true; },
      reportValidity() { return true; },
      addEventListener(event, callback) { this.listeners[event] = callback; },
      querySelector() { return element(); }, querySelectorAll() { return []; },
    };
  }
  const context = vm.createContext({
    console,
    document: {
      querySelector(selector) {
        if (!nodes.has(selector)) nodes.set(selector, element());
        return nodes.get(selector);
      },
      querySelectorAll() { return []; },
      createElement: element, addEventListener() {}, activeElement: element(),
    },
    localStorage: {
      getItem(key) { return saved.get(key) || null; },
      setItem(key, value) { saved.set(key, value); },
      removeItem(key) { saved.delete(key); },
    },
    alert(message) { alerts.push(message); },
    confirm(message) { confirmations.push(message); return context.allowConfirm; },
    allowConfirm: true,
  });
  function run(code) { return vm.runInContext(code, context); }
  for (const file of ["scheduling.js", "workspace.js", "editing.js", "timeoff.js", "script.js", "workspace-ui.js"]) {
    let source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    if (file === "script.js") source = source.split("/* event listeners */")[0];
    if (file === "workspace-ui.js") source = source.split("(function initializeWorkspaceUI()")[0];
    run(source);
  }
  run([
    'weekStartSelect.value = "Sunday";',
    'weekStartDateInput.value = "2026-10-04";',
    'monthPicker.value = "2026-10";',
    'scheduleViewSelect.value = "weekly";',
    'shiftStyleSelect.value = "three";',
    'caregivers = [{id:"alex",name:"Alex"},{id:"sam",name:"Sam"}];',
    'caregiverMaxHours = {alex:50,sam:50};',
    'caregiverRules = {alex:getDefaultCaregiverRules(),sam:getDefaultCaregiverRules()};',
    'renderSchedule = function() {};',
    'renderShiftList = function() {};',
    'renderCaregiverList = function() {};',
    'renderShiftTimeList = function() {};',
    'renderCaregiverInsights = function() {};',
    'refreshWorkspace = function() {};',
    'resetScheduleHistory();',
  ].join("\n"));
  return {
    run, context, nodes, saved, alerts, confirmations,
    data() { return JSON.parse(run("captureScheduleState()")); },
    edit(fields) {
      const proposal = {dayKey:"2026-10-04",shiftName:"Morning",caregiverId:"alex",start:"06:30",end:"13:00",...fields};
      return run("commitOccurrenceChange(" + JSON.stringify(proposal) + ")");
    },
  };
}

test("individual time editing is dated and leaves template times alone", function () {
  const fixture = app();
  assert.equal(fixture.edit({start:"08:00",end:"12:00"}), true);
  const state = fixture.data();
  assert.deepEqual(state.shiftTimeOverrides["2026-10-04__Morning"], {start:"08:00",end:"12:00"});
  assert.deepEqual(state.shiftTimes.Morning, {start:"06:30",end:"13:00"});
  assert.equal(fixture.run("scheduleUndoStack.length"), 1);
});

test("a conflicting direct assignment does not save or create undo history", function () {
  const fixture = app();
  fixture.run('scheduleAssignments["2026-10-03-Night"]="alex"; resetScheduleHistory();');
  const before = fixture.data();
  assert.equal(fixture.edit({}), false);
  assert.deepEqual(fixture.data(), before);
  assert.equal(fixture.run("scheduleUndoStack.length"), 0);
  assert.match(fixture.nodes.get("#schedule-notice").textContent, /overlapping/);
});

test("coverage assignments use the same conflict check", function () {
  const fixture = app();
  fixture.run('scheduleAssignments["2026-10-03-Night"]="alex"; resetScheduleHistory();');
  assert.equal(fixture.run('assignCoverageShift("2026-10-04","Morning","alex")'), false);
  assert.equal(fixture.data().scheduleAssignments["2026-10-04-Morning"], undefined);
});

test("declining a rest warning does not mutate state", function () {
  const fixture = app();
  fixture.run('scheduleAssignments["2026-10-04-Morning"]="alex"; caregiverRules.alex.minRestHours=8; resetScheduleHistory();');
  fixture.context.allowConfirm = false;
  const before = fixture.data();
  assert.equal(fixture.edit({shiftName:"Night",start:"19:00",end:"07:00"}), false);
  assert.deepEqual(fixture.data(), before);
  assert.match(fixture.confirmations[0], /6 hours off/);
});

test("an explicit warning override saves while retaining the warning", function () {
  const fixture = app();
  fixture.run('caregiverRules.alex.availableDays=["Monday"]; resetScheduleHistory();');
  assert.equal(fixture.edit({}), true);
  assert.equal(fixture.confirmations.length, 1);
  assert.equal(fixture.run('getCaregiverRuleWarnings(getDaysInSelectedWeek(),getActiveShifts())[0].code'), "unavailable");
});

test("a moved shift opens its old slot and undo restores both dates and times", function () {
  const fixture = app();
  fixture.edit({start:"08:00",end:"12:00"});
  const before = fixture.data();
  fixture.edit({dayKey:"2026-10-05",start:"09:00",end:"14:00",sourceKey:"2026-10-04-Morning"});
  assert.equal(fixture.data().scheduleAssignments["2026-10-04-Morning"], "Open");
  assert.equal(fixture.data().scheduleAssignments["2026-10-05-Morning"], "alex");
  fixture.run('changeScheduleHistory(scheduleUndoStack,scheduleRedoStack,"Undid")');
  assert.deepEqual(fixture.data(), before);
  fixture.run('changeScheduleHistory(scheduleRedoStack,scheduleUndoStack,"Redid")');
  assert.equal(fixture.data().scheduleAssignments["2026-10-05-Morning"], "alex");
});

test("declining replacement of a populated destination preserves both assignments", function () {
  const fixture = app();
  fixture.run('scheduleAssignments={"2026-10-04-Morning":"alex","2026-10-05-Morning":"sam"}; resetScheduleHistory();');
  const before = fixture.data();
  fixture.context.allowConfirm = false;
  assert.equal(fixture.edit({dayKey:"2026-10-05",sourceKey:"2026-10-04-Morning"}), false);
  assert.deepEqual(fixture.data(), before);
});

test("template editing freezes legacy assignments and undo restores the old template", function () {
  const fixture = app();
  fixture.run('scheduleAssignments["2026-09-01-Morning"]="alex"; resetScheduleHistory();');
  fixture.run([
    'activeTimeEdit={mode:"default",shift:getActiveShifts()[0]};',
    'setPrettyStartTime("09:00"); setPrettyEndTime("17:00");',
    'saveEditedShiftTime();',
  ].join("\n"));
  assert.deepEqual(fixture.data().shiftTimes.Morning, {start:"09:00",end:"17:00"});
  assert.deepEqual(fixture.data().shiftTimeOverrides["2026-09-01__Morning"], {start:"06:30",end:"13:00"});
  fixture.run('changeScheduleHistory(scheduleUndoStack,scheduleRedoStack,"Undid")');
  assert.deepEqual(fixture.data().shiftTimes.Morning, {start:"06:30",end:"13:00"});
});

test("copy and paste carry dated times, and the paste is one undo step", function () {
  const fixture = app();
  fixture.edit({start:"08:00",end:"12:00"});
  fixture.run('copySelectedWeek(); weekStartDateInput.value="2026-10-11"; pasteCopiedWeek();');
  assert.deepEqual(fixture.data().shiftTimeOverrides["2026-10-11__Morning"], {start:"08:00",end:"12:00"});
  assert.equal(fixture.data().scheduleAssignments["2026-10-11-Morning"], "alex");
  fixture.run('changeScheduleHistory(scheduleUndoStack,scheduleRedoStack,"Undid")');
  assert.equal(fixture.data().scheduleAssignments["2026-10-11-Morning"], undefined);
  assert.equal(fixture.run("weekStartDateInput.value"), "2026-10-11");
});

test("paste detects overnight conflicts with the preceding week", function () {
  const fixture = app();
  fixture.edit({});
  fixture.run('copySelectedWeek(); weekStartDateInput.value="2026-10-11"; scheduleAssignments["2026-10-10-Night"]="alex"; resetScheduleHistory();');
  const before = fixture.data();
  fixture.run("pasteCopiedWeek()");
  assert.deepEqual(fixture.data(), before);
  assert.match(fixture.alerts[fixture.alerts.length - 1], /cannot be pasted/);
});

test("clearing a week can be undone after navigating to a different week", function () {
  const fixture = app();
  fixture.edit({});
  const before = fixture.data();
  fixture.run('clearSelectedWeek(); weekStartDateInput.value="2026-10-11"; changeScheduleHistory(scheduleUndoStack,scheduleRedoStack,"Undid");');
  assert.deepEqual(fixture.data(), before);
  assert.equal(fixture.run("weekStartDateInput.value"), "2026-10-11");
});

test("new changes after undo invalidate redo; navigation alone does not", function () {
  const fixture = app();
  fixture.edit({});
  fixture.run('changeScheduleHistory(scheduleUndoStack,scheduleRedoStack,"Undid"); weekStartDateInput.value="2026-10-11"; saveData();');
  assert.equal(fixture.run("scheduleRedoStack.length"), 1);
  fixture.edit({caregiverId:"sam"});
  assert.equal(fixture.run("scheduleRedoStack.length"), 0);
});

test("monthly summary displays the same weekly limit warning as weekly summary", function () {
  const fixture = app();
  fixture.run('for(let day=4;day<=9;day++)scheduleAssignments["2026-10-0"+day+"-Night"]="alex";');
  fixture.run("renderCoverageSummary(getDaysInSelectedWeek(),getActiveShifts())");
  const weeklyCount = fixture.nodes.get("#warning-count").textContent;
  fixture.run('scheduleViewSelect.value="monthly"; renderCoverageSummary(getDaysInSelectedMonth(),getActiveShifts());');
  assert.equal(fixture.nodes.get("#warning-count").textContent, weeklyCount);
  assert.equal(weeklyCount, 1);
});

test("HTML-like names are rendered as text in assignment options", function () {
  const fixture = app();
  fixture.run('caregivers[0].name="<img src=x onerror=alert(1)>";');
  const options = fixture.run('buildCaregiverOptions("alex")');
  assert.ok(options.includes("&lt;img"));
  assert.ok(!options.includes("<img"));
});


test("time off add/edit/remove is preserved by rules and reversible", function () {
  const f=app();
  assert.equal(f.run('saveCaregiverTimeOff("alex","2026-10-05","2026-10-06").saved'),true);
  assert.equal(f.data().caregiverRules.alex.timeOff.length,1);
  assert.equal(f.run('saveCaregiverTimeOff("alex","2026-10-06","2026-10-07").saved'),undefined);
  assert.equal(f.run('saveCaregiverTimeOff("alex","2026-10-07","2026-10-07",0).saved'),true);
  f.run('removeCaregiverTimeOff("alex",0);changeScheduleHistory(scheduleUndoStack,scheduleRedoStack,"Undid")');
  assert.equal(f.data().caregiverRules.alex.timeOff[0].startDate,"2026-10-07");
});
test("time off blocks direct assignment and coverage assignment without warning override", function () {
  const f=app();f.run('saveCaregiverTimeOff("alex","2026-10-04","2026-10-04")');
  assert.equal(f.edit({}),false);assert.equal(f.run('assignCoverageShift("2026-10-04","Morning","alex")'),false);
  assert.equal(f.confirmations.length,0);
});
test("recurring batch validates all dates before making any changes", function () {
  const f=app();f.run('saveCaregiverTimeOff("alex","2026-10-11","2026-10-11")');const before=f.data();
  assert.throws(()=>f.run('createShiftSeries({date:"2026-10-04",until:"2026-10-18",repeat:1,name:"Morning",additional:false,caregiver:"alex",start:"08:00",end:"12:00"})'),/time off/);
  assert.deepEqual(f.data(),before);
});
test("a recurring series and future edits are each a single undo step",function(){
 const f=app();f.run('createShiftSeries({date:"2026-10-04",until:"2026-10-18",repeat:1,name:"Morning",additional:false,caregiver:"alex",start:"08:00",end:"12:00"})');
 assert.equal(f.run('scheduleUndoStack.length'),1);
 assert.equal(f.edit({dayKey:"2026-10-11",sourceKey:"2026-10-11-Morning",scope:"future",start:"09:00",end:"12:00",caregiverId:"sam"}),true);
 assert.equal(f.data().scheduleAssignments['2026-10-04-Morning'],'alex');assert.equal(f.data().scheduleAssignments['2026-10-18-Morning'],'sam');
 f.run('changeScheduleHistory(scheduleUndoStack,scheduleRedoStack,"Undid")');assert.equal(f.data().scheduleAssignments['2026-10-18-Morning'],'alex');
});
test("splitting an overnight shift preserves total hours and dates",function(){
 const f=app();f.edit({shiftName:'Night',start:'19:00',end:'07:00'});
 assert.equal(f.run('splitOccurrence("2026-10-04","Night","02:00")'),true);
 const state=f.data();assert.equal(state.workspace.extraShifts[0].dayKey,'2026-10-05');assert.equal(state.shiftTimeOverrides['2026-10-04__Night'].end,'02:00');
 assert.equal(f.run('CuravelaScheduling.buildEntries(getSchedulingModel()).reduce((n,e)=>n+e.hours,0)'),12);
});
test("a failed local save retains the in-memory draft and gives recovery instructions",function(){
 const f=app();f.context.localStorage.setItem=()=>{throw new Error('Quota exceeded');};assert.equal(f.edit({}),true);
 assert.equal(f.data().scheduleAssignments['2026-10-04-Morning'],'alex');assert.match(f.nodes.get('#schedule-notice').textContent,/Could not save/);
});
test("atomic storage survives reload and preserves time off and additional shifts",function(){
 const f=app();f.run('saveCaregiverTimeOff("alex","2026-10-07","2026-10-07");createShiftSeries({date:"2026-10-04",name:"Extra care",additional:true,caregiver:"sam",start:"09:00",end:"11:00"})');
 const before=f.data();f.run('scheduleAssignments={};workspaceState.extraShifts=[];loadData()');assert.deepEqual(f.data(),before);
});
test("a rejected extra-shift move leaves the source and history unchanged",function(){
 const f=app();
 f.run('createShiftSeries({date:"2026-10-04",name:"Extra",additional:true,caregiver:"alex",start:"09:00",end:"11:00"});createShiftSeries({date:"2026-10-05",name:"Extra",additional:true,caregiver:"sam",start:"09:00",end:"11:00"})');
 const before=f.data(),undo=f.run('scheduleUndoStack.length');
 assert.equal(f.edit({dayKey:'2026-10-05',shiftName:'Extra',sourceKey:'2026-10-04-Extra',start:'09:00',end:'11:00'}),false);
 assert.deepEqual(f.data(),before);assert.equal(f.run('scheduleUndoStack.length'),undo);
});
test("moving an extra occurrence updates its recurrence membership",function(){
 const f=app();f.run('createShiftSeries({date:"2026-10-04",until:"2026-10-11",repeat:1,name:"Extra",additional:true,caregiver:"alex",start:"09:00",end:"11:00"})');
 assert.equal(f.edit({dayKey:'2026-10-05',shiftName:'Extra',sourceKey:'2026-10-04-Extra',start:'09:00',end:'11:00'}),true);
 assert.deepEqual(f.data().workspace.series[0].keys,['2026-10-05-Extra','2026-10-11-Extra']);
});
test("an unreadable saved workspace is not silently overwritten by later edits",function(){
 const f=app();f.saved.set('curavelaWorkspaceV6','{broken');f.run('loadData()');
 f.edit({});assert.equal(f.saved.get('curavelaWorkspaceV6'),'{broken');
 assert.match(f.nodes.get('#schedule-notice').textContent,/Could not save/);
});
test("automatic briefs follow edit and undo while written notes stay intact",function(){
 const f=app();
 f.run('scheduleBriefs["2026-10-04"]={focus:"Keep this written note",updates:[],followUps:[]};renderSchedule=function(){renderScheduleBrief();};');
 f.edit({start:'09:00',end:'12:00'});
 assert.match(f.nodes.get('#automatic-brief-status').textContent,/3 hrs/);
 assert.match(f.nodes.get('#automatic-caregiver-briefs').children[0].children[1].textContent,/Alex has 1 shift/);
 f.edit({caregiverId:'sam',start:'09:00',end:'13:00'});
 assert.match(f.nodes.get('#automatic-caregiver-briefs').children[0].children[1].textContent,/no shifts/);
 assert.match(f.nodes.get('#automatic-caregiver-briefs').children[1].children[1].textContent,/4 hrs/);
 f.run('changeScheduleHistory(scheduleUndoStack,scheduleRedoStack,"Undid")');
 assert.match(f.nodes.get('#automatic-caregiver-briefs').children[0].children[1].textContent,/3 hrs/);
 assert.equal(f.run('scheduleBriefs["2026-10-04"].focus'),'Keep this written note');
});

test('copy and paste retain additional shifts and handoff notes, with one-step undo',()=>{
 const f=app();f.run('workspaceState.extraShifts.push({dayKey:"2026-10-04",name:"Extra",start:"20:00",end:"22:00"});scheduleAssignments["2026-10-04-Extra"]="sam";workspaceState.shiftNotes["2026-10-04-Extra"]="Handoff reminder";resetScheduleHistory();copySelectedWeek();weekStartDateInput.value="2026-10-11";pasteCopiedWeek();');
 assert.equal(f.data().scheduleAssignments['2026-10-11-Extra'],'sam');assert.equal(f.data().workspace.shiftNotes['2026-10-11-Extra'],'Handoff reminder');assert.equal(f.data().workspace.extraShifts.length,2);
 f.run('changeScheduleHistory(scheduleUndoStack,scheduleRedoStack,"Undid")');assert.equal(f.data().workspace.extraShifts.length,1);assert.equal(f.data().workspace.shiftNotes['2026-10-11-Extra'],undefined);
});
test('notes move with a shift and undo restores both note locations',()=>{
 const f=app();f.edit({note:'Remind next caregiver'});f.edit({dayKey:'2026-10-05',sourceKey:'2026-10-04-Morning',note:'Moved reminder'});
 assert.equal(f.data().workspace.shiftNotes['2026-10-04-Morning'],undefined);assert.equal(f.data().workspace.shiftNotes['2026-10-05-Morning'],'Moved reminder');
 f.run('changeScheduleHistory(scheduleUndoStack,scheduleRedoStack,"Undid")');assert.equal(f.data().workspace.shiftNotes['2026-10-04-Morning'],'Remind next caregiver');
});
test('timed time off persists through save, reload and undo without becoming all day',()=>{
 const f=app();f.run('saveCaregiverTimeOff("alex","2026-10-04","2026-10-04",-1,{startTime:"14:00",endTime:"17:00"})');
 assert.equal(f.data().caregiverRules.alex.timeOff[0].startTime,'14:00');assert.equal(f.edit({start:'09:00',end:'12:00'}),true);assert.equal(f.edit({start:'13:00',end:'16:00'}),false);
 f.run('loadData()');assert.equal(f.data().caregiverRules.alex.timeOff[0].endTime,'17:00');
});
test('local recovery copies retain the previous schedule with bounded storage and readable history',()=>{
 const f=app();f.run('saveData()');f.edit({note:'First'});f.edit({start:'09:00',end:'12:00',note:'Second'});
 const copies=JSON.parse(f.saved.get('curavelaRecoveryV1'));assert.equal(copies.length,2);assert.equal(copies[1].snapshot.workspace.shiftNotes['2026-10-04-Morning'],'First');assert.equal(copies[1].snapshot.workspace.history.length,0);
 const history=JSON.parse(f.saved.get('curavelaWorkspaceV6')).workspace.history;assert.equal(history.at(-1).changes[0].after.note,'Second');
 for(let i=0;i<12;i++)f.edit({note:String(i)});assert.equal(JSON.parse(f.saved.get('curavelaRecoveryV1')).length,10);
});

test('workspace snapshots stay detached from later notes and pattern edits',()=>{
 const f=app();f.run('workspaceState.shiftNotes["2026-10-04-Morning"]="Original";const prior=getWorkspaceSnapshot();workspaceState.shiftNotes["2026-10-04-Morning"]="Later";');
 assert.equal(f.run('prior.workspace.shiftNotes["2026-10-04-Morning"]'),'Original');
});
