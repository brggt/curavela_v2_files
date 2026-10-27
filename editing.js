let workspaceState = {extraShifts:[],series:[],care:{enabled:false,start:"00:00",end:"00:00",count:1},shiftNotes:{},patterns:[],calendarTimeZone:"",history:[]};
function getWorkspaceSnapshot() {
  return {app:"Curavela",version:7,...JSON.parse(captureScheduleState()),workspace:JSON.parse(JSON.stringify(workspaceState)),scheduleBriefs:JSON.parse(JSON.stringify(scheduleBriefs)),
    scheduleView:scheduleViewSelect.value,weekStart:weekStartSelect.value,month:monthPicker.value,weekStartDate:weekStartDateInput.value};
}
function applyWorkspaceSnapshot(state) {
  customShifts=state.customShifts;caregivers=state.caregivers;caregiverMaxHours=state.caregiverMaxHours;
  caregiverRules=state.caregiverRules;scheduleAssignments=state.scheduleAssignments;shiftTimes=state.shiftTimes;
  shiftTimeOverrides=state.shiftTimeOverrides;scheduleBriefs=state.scheduleBriefs||{};
  workspaceState=state.workspace||{extraShifts:[],series:[],care:{enabled:false,start:"00:00",end:"00:00",count:1},shiftNotes:{},patterns:[],calendarTimeZone:"",history:[]};
  shiftStyleSelect.value=state.shiftStyle;weekStartSelect.value=state.weekStart||"Sunday";
  scheduleViewSelect.value=state.scheduleView||"weekly";monthPicker.value=state.month||"";weekStartDateInput.value=state.weekStartDate||"";
}
// A schedule render can access many dates. Index dated shifts once per render
// instead of scanning up to 20,000 additional shifts for every calendar cell.
let renderExtraShiftsByDay = null;
function withIndexedExtraShifts(callback) {
  const previous = renderExtraShiftsByDay;
  const byDay = new Map();
  for (const shift of workspaceState.extraShifts) {
    if (!byDay.has(shift.dayKey)) byDay.set(shift.dayKey, []);
    byDay.get(shift.dayKey).push(shift);
  }
  renderExtraShiftsByDay = byDay;
  try { return callback(); }
  finally { renderExtraShiftsByDay = previous; }
}
function getShiftsForDay(dayKey, shifts) {
  const extras = renderExtraShiftsByDay
    ? (renderExtraShiftsByDay.get(dayKey) || [])
    : workspaceState.extraShifts.filter(function (shift) { return shift.dayKey===dayKey; });
  return (shifts || getActiveShifts()).concat(extras);
}
/* Dated shift editing and reversible schedule changes. */
const scheduleUndoStack = [];
const scheduleRedoStack = [];
let lastSavedScheduleState = null;
let restoringScheduleState = false;
let occurrenceSourceKey = null;
const dialogReturnFocus = new WeakMap();
const occurrenceModal = document.querySelector("#occurrence-modal");
const occurrenceForm = document.querySelector("#occurrence-form");
const occurrenceDate = document.querySelector("#occurrence-date");
const occurrenceShift = document.querySelector("#occurrence-shift");
const occurrenceCaregiver = document.querySelector("#occurrence-caregiver");
const occurrenceStart = document.querySelector("#occurrence-start");
const occurrenceEnd = document.querySelector("#occurrence-end");
const occurrenceError = document.querySelector("#occurrence-error");
const scheduleUndoButton = document.querySelector("#undo-schedule-button");
const scheduleRedoButton = document.querySelector("#redo-schedule-button");
const scheduleNotice = document.querySelector("#schedule-notice");

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
  });
}

function getSchedulingModel(activeShifts) {
  return {
    shifts: activeShifts || getActiveShifts(),
    extraShifts: workspaceState.extraShifts,
    assignments: scheduleAssignments,
    overrides: shiftTimeOverrides,
    caregivers,
    rules: caregiverRules,
    maxHours: caregiverMaxHours,
    weekStart: weekStartSelect.value,
  };
}

function showScheduleNotice(message, isError) {
  scheduleNotice.textContent = message;
  scheduleNotice.classList.toggle("is-error", Boolean(isError));
}

function captureScheduleState() {
  return JSON.stringify({
    customShifts, caregivers, caregiverMaxHours, caregiverRules,
    scheduleAssignments, shiftTimes, shiftTimeOverrides,
    shiftStyle: shiftStyleSelect.value,
    workspace: {extraShifts:workspaceState.extraShifts,series:workspaceState.series,care:workspaceState.care,shiftNotes:workspaceState.shiftNotes||{},patterns:workspaceState.patterns||[],calendarTimeZone:workspaceState.calendarTimeZone||""},
  });
}

function updateHistoryControls() {
  scheduleUndoButton.disabled = scheduleUndoStack.length === 0;
  scheduleRedoButton.disabled = scheduleRedoStack.length === 0;
  scheduleUndoButton.title = scheduleUndoStack.length
    ? "Undo: " + scheduleUndoStack[scheduleUndoStack.length - 1].label : "Nothing to undo";
  scheduleRedoButton.title = scheduleRedoStack.length
    ? "Redo: " + scheduleRedoStack[scheduleRedoStack.length - 1].label : "Nothing to redo";
}

function resetScheduleHistory() {
  scheduleUndoStack.length = 0;
  scheduleRedoStack.length = 0;
  lastSavedScheduleState = captureScheduleState();
  updateHistoryControls();
}

function recordScheduleChange(label) {
  if (restoringScheduleState || lastSavedScheduleState === null) return;
  const current = captureScheduleState();
  if (current === lastSavedScheduleState) return;
  scheduleUndoStack.push({ state: lastSavedScheduleState, label: label || "schedule change" });
  if (scheduleUndoStack.length > 30) scheduleUndoStack.shift();
  scheduleRedoStack.length = 0;
  lastSavedScheduleState = current;
  updateHistoryControls();
  showScheduleNotice("Saved on this device. Undo is available.");
}

function restoreScheduleState(serialized) {
  const state = JSON.parse(serialized);
  customShifts = state.customShifts;
  caregivers = state.caregivers;
  caregiverMaxHours = state.caregiverMaxHours;
  caregiverRules = state.caregiverRules;
  scheduleAssignments = state.scheduleAssignments;
  shiftTimes = state.shiftTimes;
  shiftTimeOverrides = state.shiftTimeOverrides;
  shiftStyleSelect.value = state.shiftStyle;
  if (state.workspace) workspaceState = {...workspaceState,...state.workspace};
  restoringScheduleState = true;
  try {
    saveData();
    lastSavedScheduleState = captureScheduleState();
    updateCustomShiftVisibility();
    renderShiftList();
    renderCaregiverList();
    renderShiftTimeList();
    renderSchedule();
  } finally {
    restoringScheduleState = false;
    updateHistoryControls();
  }
}

function changeScheduleHistory(fromStack, toStack, action) {
  if (!fromStack.length) return;
  const entry = fromStack.pop();
  toStack.push({ state: captureScheduleState(), label: entry.label });
  restoreScheduleState(entry.state);
  showScheduleNotice(action + ": " + entry.label + ". Saved on this device.");
}

function preserveAssignedShiftTimes(shiftName) {
  const shift = getActiveShifts().find(function (item) { return item.name === shiftName; });
  if (!shift) return;
  Object.entries(scheduleAssignments).forEach(function (pair) {
    const key = pair[0], caregiverId = pair[1];
    if (key.slice(11) !== shiftName || caregiverId === "Open") return;
    const overrideKey = getShiftOverrideKey(key.slice(0, 10), shiftName);
    if (!shiftTimeOverrides[overrideKey]) {
      shiftTimeOverrides[overrideKey] = { start: shift.start, end: shift.end };
    }
  });
}

function isVisibleDialogControl(element) {
  return !element.disabled && element.tabIndex >= 0 && !element.hidden && element.type !== 'hidden' && !element.closest('[hidden], .hidden') && element.getClientRects().length > 0;
}
function openManagedDialog(modal) {
  dialogReturnFocus.set(modal, document.activeElement);
  modal.classList.remove("hidden");
  document.querySelector(".app-shell").inert = true;
  const focusTarget = Array.from(modal.querySelectorAll("input, select, textarea, button")).find(isVisibleDialogControl);
  if (focusTarget) focusTarget.focus();
}

function closeManagedDialog(modal) {
  modal.classList.add("hidden");
  document.querySelector(".app-shell").inert = Boolean(document.querySelector(".modal-backdrop:not(.hidden)"));
  const previous = dialogReturnFocus.get(modal);
  if (previous && previous.isConnected) previous.focus();
  else if (quickAddShiftButton) quickAddShiftButton.focus();
}

function updateOccurrenceDuration() {
  const span = CuravelaScheduling.interval(occurrenceDate.value, occurrenceStart.value, occurrenceEnd.value);
  document.querySelector("#occurrence-duration").textContent = span
    ? formatHours(span.hours) + (occurrenceEnd.value <= occurrenceStart.value ? " · ends the next day" : "")
    : "Choose a date and valid start and end times.";
}

function loadOccurrenceFields() {
  const shift = getShiftsForDay(occurrenceDate.value).find(function (item) { return item.name === occurrenceShift.value; });
  if (!shift) return;
  const times = getShiftForDay(occurrenceDate.value, shift);
  occurrenceStart.value = times.start;
  occurrenceEnd.value = times.end;
  occurrenceCaregiver.value = scheduleAssignments[occurrenceDate.value + "-" + shift.name] || "Open";
  const note=document.querySelector('#occurrence-note');
  if(note)note.value=workspaceState.shiftNotes?.[occurrenceDate.value+'-'+shift.name]||'';
  updateOccurrenceDuration();
}

function openOccurrenceEditor(dayKey, shiftName) {
  const days = scheduleViewSelect.value === "monthly" ? getDaysInSelectedMonth() : getDaysInSelectedWeek();
  const activeShifts = getShiftsForDay(dayKey || getTodayDateValue());
  if (!activeShifts.length) {
    showScheduleNotice("Add a shift template in Settings first.", true);
    return;
  }
  const today = getTodayDateValue();
  occurrenceSourceKey = dayKey && shiftName ? dayKey + "-" + shiftName : null;
  occurrenceDate.value = dayKey || (days.some(function (day) { return day.key === today; }) ? today : days[0].key);
  occurrenceShift.replaceChildren();
  activeShifts.forEach(function (shift) {
    const option = document.createElement("option");
    option.value = shift.name;
    option.textContent = shift.name;
    occurrenceShift.append(option);
  });
  occurrenceShift.value = shiftName || activeShifts[0].name;
  occurrenceShift.disabled = Boolean(occurrenceSourceKey);
  occurrenceCaregiver.replaceChildren();
  [{ id: "Open", name: "Open — needs coverage" }].concat(caregivers).forEach(function (person) {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = person.name;
    occurrenceCaregiver.append(option);
  });
  document.querySelector("#occurrence-title").textContent = occurrenceSourceKey ? "Edit this shift" : "Schedule a shift";
  occurrenceError.textContent = "";
  const scope = document.querySelector("#occurrence-scope");
  if (scope) scope.value = "one";
  loadOccurrenceFields();
  openManagedDialog(occurrenceModal);
}

// Saving a shift rebuilds the care map. Keep the scheduler at the same scroll position.
function renderScheduleWithoutLosingPosition() {
  // Node.js regression tests do not provide browser globals.
  if (typeof window === "undefined" || typeof document === "undefined") {
    renderSchedule();
    return;
  }
  const pageY = window.scrollY;
  const content = typeof mainContent !== "undefined" ? mainContent : null;
  const contentY = content ? content.scrollTop : 0;
  const contentX = content ? content.scrollLeft : 0;
  const mapScroller = document.querySelector(".care-map-scroll, .schedule-scroll");
  const mapX = mapScroller ? mapScroller.scrollLeft : 0;

  renderSchedule();

  function restorePosition() {
    if (content) {
      content.scrollTop = contentY;
      content.scrollLeft = contentX;
    }
    window.scrollTo({ top: pageY, behavior: "instant" });
    const nextMap = document.querySelector(".care-map-scroll, .schedule-scroll");
    if (nextMap) nextMap.scrollLeft = mapX;
  }
  restorePosition();
  // Dialog focus restoration can scroll after the save handler has returned.
  requestAnimationFrame(restorePosition);
}

function commitOccurrenceChange(proposal, reportError) {
  const fail = reportError || function (message) { showScheduleNotice(message, true); };
  if (proposal.scope === "future" && typeof commitFutureSeries === "function") return commitFutureSeries(proposal, fail);
  const shift = getShiftsForDay(proposal.dayKey).find(function (item) { return item.name === proposal.shiftName; }) || getShiftsForDay((proposal.sourceKey || "").slice(0,10)).find(function (item) { return item.name === proposal.shiftName; });
  const span = CuravelaScheduling.interval(proposal.dayKey, proposal.start, proposal.end);
  if (!shift || !span || (proposal.caregiverId !== "Open" && !caregiverIdExists(proposal.caregiverId))) {
    fail("Choose a valid date, shift, caregiver, and start and end time.");
    return false;
  }
  if(proposal.note!==undefined&&(typeof proposal.note!=='string'||proposal.note.length>2000)){fail('Keep shift notes to 2,000 characters.');return false;}
  const targetKey = proposal.dayKey + "-" + proposal.shiftName;
  if (proposal.caregiverId !== "Open") {
    const candidate = CuravelaScheduling.evaluate(getSchedulingModel(), proposal);
    if (!candidate || candidate.blocked) {
      fail(candidate ? candidate.conflicts.join("\n") : "This assignment could not be checked.");
      return false;
    }
    if (candidate.conflicts.length && !confirm(candidate.conflicts.join("\n") + "\n\nSave this assignment despite these warnings?")) return false;
  }
  const existing = scheduleAssignments[targetKey];
  if (proposal.sourceKey !== targetKey && existing && existing !== "Open") {
    if (!confirm("Replace " + getCaregiverName(existing) + "'s " + proposal.shiftName +
      " assignment on " + proposal.dayKey + "?")) return false;
  }
  if (proposal.sourceKey && proposal.sourceKey !== targetKey) {
    const extra = workspaceState.extraShifts.find(function (s) { return s.dayKey + "-" + s.name === proposal.sourceKey; });
    if (extra && getShiftsForDay(proposal.dayKey).some(function (s) { return s.name === extra.name; })) {
      fail("A shift with that name already exists on the destination date.");
      return false;
    }
    scheduleAssignments[proposal.sourceKey] = "Open";
    const oldNote=workspaceState.shiftNotes?.[proposal.sourceKey];
    if(proposal.note===undefined&&oldNote)proposal.note=oldNote;
    if(workspaceState.shiftNotes)delete workspaceState.shiftNotes[proposal.sourceKey];
    delete shiftTimeOverrides[getShiftOverrideKey(proposal.sourceKey.slice(0,10),proposal.shiftName)];
    if (extra) {
      extra.dayKey = proposal.dayKey;
      delete scheduleAssignments[proposal.sourceKey];
    }
    workspaceState.series.forEach(function (series) {
      series.keys = series.keys.map(function (key) { return key === proposal.sourceKey ? targetKey : key; });
    });
  }
  workspaceState.shiftNotes=workspaceState.shiftNotes||{};
  if(proposal.note!==undefined){if(proposal.note.trim())workspaceState.shiftNotes[targetKey]=proposal.note.trim();else delete workspaceState.shiftNotes[targetKey];}
  scheduleAssignments[targetKey] = proposal.caregiverId;
  shiftTimeOverrides[getShiftOverrideKey(proposal.dayKey, proposal.shiftName)] = { start: proposal.start, end: proposal.end };
  saveData(proposal.sourceKey && proposal.sourceKey !== targetKey ? "move shift" : "edit shift");
  renderScheduleWithoutLosingPosition();
  return true;
}

function attachOccurrenceEditListeners() {
  scheduleSection.querySelectorAll(".edit-occurrence-button").forEach(function (button) {
    button.addEventListener("click", function () {
      openOccurrenceEditor(button.dataset.day, button.dataset.shift);
    });
  });
}

occurrenceForm.addEventListener("submit", function (event) {
  event.preventDefault();
  occurrenceError.textContent = "";
  const saved = commitOccurrenceChange({
    dayKey: occurrenceDate.value, shiftName: occurrenceShift.value,
    caregiverId: occurrenceCaregiver.value, start: occurrenceStart.value, end: occurrenceEnd.value,
    sourceKey: occurrenceSourceKey,
    note: document.querySelector('#occurrence-note').value,
    scope: document.querySelector("#occurrence-scope")?.value || "one",
  }, function (message) { occurrenceError.textContent = message; });
  if (saved) closeManagedDialog(occurrenceModal);
});
occurrenceShift.addEventListener("change", loadOccurrenceFields);
occurrenceDate.addEventListener("change", function () {
  if (!occurrenceSourceKey) loadOccurrenceFields();
  else updateOccurrenceDuration();
});
[occurrenceStart, occurrenceEnd].forEach(function (input) {
  input.addEventListener("input", updateOccurrenceDuration);
});
document.querySelectorAll("[data-close-occurrence]").forEach(function (button) {
  button.addEventListener("click", function () { closeManagedDialog(occurrenceModal); });
});
occurrenceModal.addEventListener("click", function (event) {
  if (event.target === occurrenceModal) closeManagedDialog(occurrenceModal);
});
scheduleUndoButton.addEventListener("click", function () { changeScheduleHistory(scheduleUndoStack, scheduleRedoStack, "Undid"); });
scheduleRedoButton.addEventListener("click", function () { changeScheduleHistory(scheduleRedoStack, scheduleUndoStack, "Redid"); });

document.addEventListener("keydown", function (event) {
  const modal = document.querySelector(".modal-backdrop:not(.hidden)");
  if (modal) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (modal === occurrenceModal) closeManagedDialog(modal);
      else if (modal.id === "edit-time-modal") closeEditTimeModal();
      else if (modal.id === "caregiver-time-off-modal") closeCaregiverTimeOffModal();
      else if (modal.id === "caregiver-rules-modal") closeCaregiverRulesModal();
      else closeManagedDialog(modal);
    } else if (event.key === "Tab") {
      const controls = Array.from(modal.querySelectorAll("button, input, select, textarea, [tabindex]"))
        .filter(isVisibleDialogControl);
      const first = controls[0], last = controls[controls.length - 1];
      if(!first){event.preventDefault();return;}
      if(!controls.includes(document.activeElement)){event.preventDefault();first.focus();return;}
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return;
  }
  if (!(event.ctrlKey || event.metaKey) || event.altKey ||
      event.target.closest("input, textarea, select, [contenteditable=true]")) return;
  const key = event.key.toLowerCase();
  if (key === "z" && !event.shiftKey) {
    event.preventDefault();
    changeScheduleHistory(scheduleUndoStack, scheduleRedoStack, "Undid");
  } else if (key === "y" || (key === "z" && event.shiftKey)) {
    event.preventDefault();
    changeScheduleHistory(scheduleRedoStack, scheduleUndoStack, "Redid");
  }
}, true);
