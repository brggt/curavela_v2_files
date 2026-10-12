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

function openManagedDialog(modal) {
  dialogReturnFocus.set(modal, document.activeElement);
  modal.classList.remove("hidden");
  document.querySelector(".app-shell").inert = true;
  const focusTarget = modal.querySelector("input:not([disabled]), select:not([disabled]), textarea, button");
  if (focusTarget) focusTarget.focus();
}

function closeManagedDialog(modal) {
  modal.classList.add("hidden");
  document.querySelector(".app-shell").inert = false;
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
  const shift = getActiveShifts().find(function (item) { return item.name === occurrenceShift.value; });
  if (!shift) return;
  const times = getShiftForDay(occurrenceDate.value, shift);
  occurrenceStart.value = times.start;
  occurrenceEnd.value = times.end;
  occurrenceCaregiver.value = scheduleAssignments[occurrenceDate.value + "-" + shift.name] || "Open";
  updateOccurrenceDuration();
}

function openOccurrenceEditor(dayKey, shiftName) {
  const days = scheduleViewSelect.value === "monthly" ? getDaysInSelectedMonth() : getDaysInSelectedWeek();
  const activeShifts = getActiveShifts();
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
  loadOccurrenceFields();
  openManagedDialog(occurrenceModal);
}

function commitOccurrenceChange(proposal, reportError) {
  const fail = reportError || function (message) { showScheduleNotice(message, true); };
  const shift = getActiveShifts().find(function (item) { return item.name === proposal.shiftName; });
  const span = CuravelaScheduling.interval(proposal.dayKey, proposal.start, proposal.end);
  if (!shift || !span || (proposal.caregiverId !== "Open" && !caregiverIdExists(proposal.caregiverId))) {
    fail("Choose a valid date, shift, caregiver, and start and end time.");
    return false;
  }
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
  if (proposal.sourceKey && proposal.sourceKey !== targetKey) scheduleAssignments[proposal.sourceKey] = "Open";
  scheduleAssignments[targetKey] = proposal.caregiverId;
  shiftTimeOverrides[getShiftOverrideKey(proposal.dayKey, proposal.shiftName)] = { start: proposal.start, end: proposal.end };
  saveData(proposal.sourceKey && proposal.sourceKey !== targetKey ? "move shift" : "edit shift");
  renderSchedule();
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
      else closeCaregiverRulesModal();
    } else if (event.key === "Tab") {
      const controls = Array.from(modal.querySelectorAll("button, input, select, textarea, [tabindex]"))
        .filter(function (element) { return !element.disabled && element.tabIndex >= 0; });
      const first = controls[0], last = controls[controls.length - 1];
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
