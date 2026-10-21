/* Full-day and timed caregiver time off, kept with caregiver rules for backups and undo. */
let activeTimeOffCaregiverId = "";
let editingTimeOffIndex = -1;
const caregiverTimeOffModal = document.querySelector("#caregiver-time-off-modal");
const timeOffForm = document.querySelector("#time-off-form");
const timeOffStart = document.querySelector("#time-off-start");
const timeOffEnd = document.querySelector("#time-off-end");
const timeOffError = document.querySelector("#time-off-error");
const timeOffStatus = document.querySelector("#time-off-status");
const timeOffSave = document.querySelector("#save-time-off-button");
const timeOffCancelEdit = document.querySelector("#cancel-time-off-edit");

function getCaregiverTimeOff(caregiverId) {
  const records = getCaregiverRules(caregiverId).timeOff;
  return Array.isArray(records) ? records.filter(function (record) {
    return CuravelaScheduling.timeOffInterval(record);
  }) : [];
}

function saveCaregiverTimeOff(caregiverId, startDate, endDate, index = -1, times = null) {
  if (!caregiverIdExists(caregiverId)) return { error: "Choose an existing caregiver." };
  const record = times ? {startDate,endDate,allDay:false,startTime:times.startTime,endTime:times.endTime} : { startDate, endDate };
  const span = CuravelaScheduling.timeOffInterval(record);
  if (!span) return { error: "Choose valid dates and times. Timed time off must end after it starts; use the next date for overnight time off." };
  const records = getCaregiverTimeOff(caregiverId).slice();
  if (!Number.isInteger(index) || index < -1 || index >= records.length) {
    return { error: "This time-off period is no longer available. Reopen Time off and try again." };
  }
  if (records.some(function (saved, savedIndex) {
    const other = CuravelaScheduling.timeOffInterval(saved);
    return savedIndex !== index && span.start < other.end && span.end > other.start;
  })) return { error: "These dates or times overlap an existing time-off period. Edit that period instead." };
  if (index === -1) records.push(record);
  else records[index] = record;
  records.sort(function (a, b) { return a.startDate.localeCompare(b.startDate); });
  caregiverRules[caregiverId] = { ...getCaregiverRules(caregiverId), timeOff: records };
  saveData(index === -1 ? "add time off" : "edit time off");
  renderCaregiverList();
  renderSchedule();
  return { saved: true };
}

function removeCaregiverTimeOff(caregiverId, index) {
  if (!caregiverIdExists(caregiverId)) return false;
  const records = getCaregiverTimeOff(caregiverId).slice();
  if (!Number.isInteger(index) || index < 0 || index >= records.length) return false;
  records.splice(index, 1);
  caregiverRules[caregiverId] = { ...getCaregiverRules(caregiverId), timeOff: records };
  saveData("remove time off");
  renderCaregiverList();
  renderSchedule();
  return true;
}

function validateTimeOffBackup(backup) {
  const rules = Object.values(backup.caregiverRules || {}).concat(
    (Array.isArray(backup.caregivers) ? backup.caregivers : []).map(function (caregiver) {
      return caregiver && caregiver.rules;
    }),
  );
  if (rules.some(function (rule) {
    return rule && rule.timeOff !== undefined && (!Array.isArray(rule.timeOff) ||
      rule.timeOff.some(function (record) { return !CuravelaScheduling.timeOffInterval(record); }));
  })) throw new Error("The backup contains invalid caregiver time-off dates.");
}

function formatTimeOffRange(record) {
  function formatDate(key) {
    return new Date(key + "T12:00:00").toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }
  if(record.startTime)return formatDate(record.startDate)+' '+formatTime(record.startTime)+' – '+formatDate(record.endDate)+' '+formatTime(record.endTime);
  return formatDate(record.startDate) + (record.startDate === record.endDate ? "" : " – " + formatDate(record.endDate));
}

function resetTimeOffForm() {
  editingTimeOffIndex = -1;
  document.querySelector('#time-off-all-day').checked=true;
  updateTimeOffFields();
  timeOffStart.value = "";
  timeOffEnd.value = "";
  timeOffEnd.removeAttribute("min");
  timeOffError.textContent = "";
  timeOffSave.textContent = "Add time off";
  timeOffCancelEdit.hidden = true;
}

function renderCaregiverTimeOff() {
  const records = getCaregiverTimeOff(activeTimeOffCaregiverId);
  const list = document.querySelector("#time-off-list");
  list.replaceChildren();
  document.querySelector("#time-off-empty").hidden = records.length > 0;
  records.forEach(function (record, index) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    const range = formatTimeOffRange(record);
    label.textContent = range + (record.endDate < getTodayDateValue() ? " · Past" : record.startTime ? "" : " · All day");
    const actions = document.createElement("div");
    actions.classList.add("time-off-item-actions");
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit";
    edit.setAttribute("aria-label", "Edit time off " + range);
    edit.addEventListener("click", function () {
      editingTimeOffIndex = index;
      timeOffStart.value = record.startDate;
      timeOffEnd.value = record.endDate;
      document.querySelector('#time-off-all-day').checked=!record.startTime;
      document.querySelector('#time-off-start-time').value=record.startTime||'09:00';
      document.querySelector('#time-off-end-time').value=record.endTime||'17:00';
      updateTimeOffFields();
      timeOffEnd.min = record.startDate;
      timeOffError.textContent = "";
      timeOffStatus.textContent = "Editing " + range + ".";
      timeOffSave.textContent = "Save time off";
      timeOffCancelEdit.hidden = false;
      timeOffStart.focus();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.classList.add("ghost-button");
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", "Remove time off " + range);
    remove.addEventListener("click", function () {
      if (!removeCaregiverTimeOff(activeTimeOffCaregiverId, index)) return;
      resetTimeOffForm();
      renderCaregiverTimeOff();
      timeOffStatus.textContent = "Time off removed. Close this window to use Undo.";
      timeOffStart.focus();
    });
    actions.append(edit, remove);
    item.append(label, actions);
    list.append(item);
  });

  const conflicts = CuravelaScheduling.buildEntries(getSchedulingModel()).filter(function (entry) {
    return entry.caregiverId === activeTimeOffCaregiverId && !entry.invalid &&
      CuravelaScheduling.getTimeOffConflicts(getCaregiverRules(activeTimeOffCaregiverId), entry).length;
  }).sort(function (a, b) { return a.start - b.start; });
  const conflictSection = document.querySelector("#time-off-conflicts");
  const conflictList = document.querySelector("#time-off-conflict-list");
  conflictSection.hidden = !conflicts.length;
  conflictList.replaceChildren();
  document.querySelector("#time-off-conflict-summary").textContent = conflicts.length +
    " assigned shift" + (conflicts.length === 1 ? " overlaps" : "s overlap") +
    " time off. Assignments are kept until you change them.";
  conflicts.forEach(function (entry) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = entry.dayKey + " · " + entry.shiftName + " · " + formatTime(entry.startTime) +
      "–" + formatTime(entry.endTime);
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Review shift";
    edit.setAttribute("aria-label", "Review " + entry.shiftName + " on " + entry.dayKey);
    edit.addEventListener("click", function () {
      closeCaregiverTimeOffModal();
      openOccurrenceEditor(entry.dayKey, entry.shiftName);
    });
    item.append(label, edit);
    conflictList.append(item);
  });
}

function openCaregiverTimeOffModal(caregiverId) {
  const caregiver = getCaregiverById(caregiverId);
  if (!caregiver) return;
  activeTimeOffCaregiverId = caregiverId;
  document.querySelector("#caregiver-time-off-title").textContent = caregiver.name + " · Time off";
  resetTimeOffForm();
  timeOffStatus.textContent = "";
  renderCaregiverTimeOff();
  openManagedDialog(caregiverTimeOffModal);
  timeOffStart.focus();
}

function closeCaregiverTimeOffModal() {
  closeManagedDialog(caregiverTimeOffModal);
  activeTimeOffCaregiverId = "";
  resetTimeOffForm();
}

timeOffStart.addEventListener("change", function () {
  timeOffEnd.min = timeOffStart.value;
  if (!timeOffEnd.value) timeOffEnd.value = timeOffStart.value;
});
timeOffForm.addEventListener("submit", function (event) {
  event.preventDefault();
  timeOffError.textContent = "";
  const result = saveCaregiverTimeOff(activeTimeOffCaregiverId, timeOffStart.value, timeOffEnd.value, editingTimeOffIndex, document.querySelector('#time-off-all-day').checked?null:{startTime:document.querySelector('#time-off-start-time').value,endTime:document.querySelector('#time-off-end-time').value});
  if (result.error) { timeOffError.textContent = result.error; return; }
  resetTimeOffForm();
  renderCaregiverTimeOff();
  timeOffStatus.textContent = "Time off saved. Close this window to use Undo.";
  timeOffStart.focus();
});
timeOffCancelEdit.addEventListener("click", function () {
  resetTimeOffForm();
  timeOffStatus.textContent = "Edit canceled.";
  timeOffStart.focus();
});
document.querySelectorAll("[data-close-time-off]").forEach(function (button) {
  button.addEventListener("click", closeCaregiverTimeOffModal);
});
caregiverTimeOffModal.addEventListener("click", function (event) {
  if (event.target === caregiverTimeOffModal) closeCaregiverTimeOffModal();
});

function updateTimeOffFields(){
  const allDay=document.querySelector('#time-off-all-day').checked;
  document.querySelector('#time-off-times').hidden=allDay;
  for(const id of ['time-off-start-time','time-off-end-time']){const input=document.querySelector('#'+id);input.required=!allDay;input.disabled=allDay;}
}
document.querySelector('#time-off-all-day').addEventListener('change',updateTimeOffFields);
