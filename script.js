const allWeekDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

let customShifts = ["Morning", "Afternoon", "Night"];
let caregivers = [];
let scheduleAssignments = {};
let scheduleNote = "";
let shiftTimeOverrides = {};
let copiedWeekAssignments = null;
let draggedCaregiverName = null;
let caregiverRules = {};
let activeCaregiverRulesName = "";
let selectedCoverageShiftKey = "";
let scheduleMode = "all";

let caregiverMaxHours = {
  Brody: 50,
  Shelyn: 50,
  Raymundo: 50,
  Miguel: 50,
};

let activeTimeEdit = {
  mode: "date",
  dayKey: "",
  shift: null,
};

let shiftTimes = {
  "Full Day": { start: "00:00", end: "00:00" },
  Day: { start: "07:00", end: "19:00" },
  Night: { start: "19:00", end: "07:00" },
  Morning: { start: "06:30", end: "13:00" },
  Afternoon: { start: "13:00", end: "19:00" },
};

/* DOM */

const scheduleSection = document.querySelector("#schedule");

const customShiftInput = document.querySelector("#custom-shift-name");
const addShiftButton = document.querySelector("#add-shift-button");
const shiftList = document.querySelector("#shift-list");
const customShiftSection = document.querySelector("#custom-shift-section");

const caregiverInput = document.querySelector("#caregiver-name");
const addCaregiverButton = document.querySelector("#add-caregiver-button");
const caregiverList = document.querySelector("#caregiver-list");

const weekStartSelect = document.querySelector("#week-start");
const weekLabel = document.querySelector("#week-label");
const shiftStyleSelect = document.querySelector("#shift-style");

const scheduleViewSelect = document.querySelector("#schedule-view");
const monthPicker = document.querySelector("#month-picker");
const monthPickerSection = document.querySelector("#month-picker-section");

const weekStartDateInput = document.querySelector("#week-start-date");
const weekPickerSection = document.querySelector("#week-picker-section");

const previousWeekButton = document.querySelector("#previous-week-button");
const nextWeekButton = document.querySelector("#next-week-button");
const todayWeekButton = document.querySelector("#today-week-button");
const selectedWeekDisplay = document.querySelector("#selected-week-display");

const selectedWeekDisplayButton = document.querySelector(
  "#selected-week-display-button",
);

const weekDatePopover = document.querySelector("#week-date-popover");

const weekPickerTodayButton = document.querySelector("#week-picker-today");

const weekPickerNextButton = document.querySelector("#week-picker-next");

const scheduleNoteInput = document.querySelector("#schedule-note");
const clearScheduleButton = document.querySelector("#clear-schedule-button");

const exportDataButton = document.querySelector("#export-data-button");
const importDataButton = document.querySelector("#import-data-button");
const importDataInput = document.querySelector("#import-data-input");

const mainContent = document.querySelector(".main-content");
const heroSection = document.querySelector(".hero");
const statsStrip = document.querySelector(".stats-strip");
const scheduleArea = document.querySelector("#schedule-area");

const coverageArea = document.querySelector("#coverage-area");

const coverageWeekLabel = document.querySelector("#coverage-week-label");

const coveragePreviousWeekButton = document.querySelector(
  "#coverage-previous-week-button",
);

const coverageNextWeekButton = document.querySelector(
  "#coverage-next-week-button",
);

const coverageTodayButton = document.querySelector("#coverage-today-button");

const coverageOpenCount = document.querySelector("#coverage-open-count");

const coverageOpenHours = document.querySelector("#coverage-open-hours");

const coverageSafeCount = document.querySelector("#coverage-safe-count");

const coverageNoMatchCount = document.querySelector("#coverage-no-match-count");

const coverageOnlyNoMatch = document.querySelector("#coverage-only-no-match");

const coverageShiftsList = document.querySelector("#coverage-shifts-list");

const coverageComparisonPanel = document.querySelector(
  "#coverage-comparison-panel",
);

const coverageListCount = document.querySelector("#coverage-list-count");

const dashboardGrid = document.querySelector(".dashboard-grid");

const caregiverPanel = document.querySelector("#caregiver-panel");
const hoursPanel = document.querySelector("#hours-panel");
const openShiftsPanel = document.querySelector("#open-shifts-panel");
const warningsPanel = document.querySelector("#warnings-panel");
const reportsPanel = document.querySelector("#reports-panel");
const settingsPanel = document.querySelector("#settings-panel");

const sideNavLinks = document.querySelectorAll(".side-nav-link");

const printScheduleButton = document.querySelector("#print-schedule-button");
const copyWeekButton = document.querySelector("#copy-week-button");
const pasteWeekButton = document.querySelector("#paste-week-button");
const clearWeekButton = document.querySelector("#clear-week-button");
const clearMonthButton = document.querySelector("#clear-month-button");

const scheduleTitle = document.querySelector("#schedule-title");
const shiftTimeList = document.querySelector("#shift-time-list");

const previousMonthButton = document.querySelector("#previous-month-button");
const nextMonthButton = document.querySelector("#next-month-button");
const currentMonthButton = document.querySelector("#current-month-button");
const selectedMonthDisplay = document.querySelector("#selected-month-display");

const selectedMonthDisplayButton = document.querySelector(
  "#selected-month-display-button",
);

const monthDatePopover = document.querySelector("#month-date-popover");

const monthPickerCurrentButton = document.querySelector(
  "#month-picker-current",
);

const monthPickerNextButton = document.querySelector("#month-picker-next");

const totalHoursNeededElement = document.querySelector("#total-hours-needed");
const totalHoursCoveredElement = document.querySelector("#total-hours-covered");
const openHoursElement = document.querySelector("#open-hours");
const openShiftsCountElement = document.querySelector("#open-shifts-count");
const caregiverHoursList = document.querySelector("#caregiver-hours-list");
const caregiverHoursStatus = document.querySelector("#caregiver-hours-status");

const caregiverInsightHeadline = document.querySelector(
  "#caregiver-insight-headline",
);

const caregiverInsightMessage = document.querySelector(
  "#caregiver-insight-message",
);

const caregiverUpdateCount = document.querySelector("#caregiver-update-count");

const caregiverUpdateList = document.querySelector("#caregiver-update-list");
const availableShiftsList = document.querySelector("#available-shifts-list");

const coveragePercentElement = document.querySelector("#coverage-percent");
const coverageProgressFill = document.querySelector("#coverage-progress-fill");
const warningCountElement = document.querySelector("#warning-count");

const scheduleWarningStrip = document.querySelector("#schedule-warning-strip");

const scheduleWarningSummary = document.querySelector(
  "#schedule-warning-summary",
);

const scheduleWarningDetails = document.querySelector(
  "#schedule-warning-details",
);

const toastOpenShiftsCount = document.querySelector("#toast-open-shifts-count");

const availableShiftsBody = document.querySelector(
  "#open-shifts-panel .available-shifts-body",
);

const availableShiftsToast = document.querySelector(".available-shifts-toast");

const minimizeAvailableShiftsButton = document.querySelector(
  "#minimize-available-shifts-button",
);

const editTimeModal = document.querySelector("#edit-time-modal");
const editTimeTitle = document.querySelector("#edit-time-title");
const editTimeSubtitle = document.querySelector("#edit-time-subtitle");

const editStartHourSelect = document.querySelector("#edit-start-hour");
const editStartMinuteSelect = document.querySelector("#edit-start-minute");
const editStartPeriodSelect = document.querySelector("#edit-start-period");

const editEndHourSelect = document.querySelector("#edit-end-hour");
const editEndMinuteSelect = document.querySelector("#edit-end-minute");
const editEndPeriodSelect = document.querySelector("#edit-end-period");

const closeEditTimeButton = document.querySelector("#close-edit-time-button");

const cancelEditTimeButton = document.querySelector("#cancel-edit-time-button");

const saveEditTimeButton = document.querySelector("#save-edit-time-button");

const quickAddShiftButton = document.querySelector("#quick-add-shift-button");

const moreActionsButton = document.querySelector("#more-actions-button");

const moreActionsMenu = document.querySelector("#more-actions-menu");

/* caregiver rules modal */

const caregiverRulesModal = document.querySelector("#caregiver-rules-modal");

const caregiverRulesTitle = document.querySelector("#caregiver-rules-title");

const caregiverRuleDays = document.querySelector("#caregiver-rule-days");

const caregiverRuleShifts = document.querySelector("#caregiver-rule-shifts");

const caregiverMaxConsecutiveDaysInput = document.querySelector(
  "#caregiver-max-consecutive-days",
);

const caregiverNeedsTwoDaysOffInput = document.querySelector(
  "#caregiver-needs-two-days-off",
);

const caregiverRuleNoteInput = document.querySelector("#caregiver-rule-note");

const closeCaregiverRulesButton = document.querySelector(
  "#close-caregiver-rules-button",
);

const cancelCaregiverRulesButton = document.querySelector(
  "#cancel-caregiver-rules-button",
);

const saveCaregiverRulesButton = document.querySelector(
  "#save-caregiver-rules-button",
);

let availableShiftsScrollInterval;

/* storage */

function getSavedItem(newKey, oldKey) {
  return localStorage.getItem(newKey) || localStorage.getItem(oldKey);
}

function saveData() {
  localStorage.setItem("curavelaCustomShifts", JSON.stringify(customShifts));

  localStorage.setItem("curavelaCaregivers", JSON.stringify(caregivers));

  localStorage.setItem(
    "curavelaCaregiverMaxHours",
    JSON.stringify(caregiverMaxHours),
  );

  localStorage.setItem(
    "curavelaCaregiverRules",
    JSON.stringify(caregiverRules),
  );

  localStorage.setItem(
    "curavelaAssignments",
    JSON.stringify(scheduleAssignments),
  );

  localStorage.setItem("curavelaScheduleNote", scheduleNote);

  localStorage.setItem("curavelaShiftTimes", JSON.stringify(shiftTimes));

  localStorage.setItem(
    "curavelaShiftTimeOverrides",
    JSON.stringify(shiftTimeOverrides),
  );

  localStorage.setItem("curavelaScheduleView", scheduleViewSelect.value);

  localStorage.setItem("curavelaShiftStyle", shiftStyleSelect.value);

  localStorage.setItem("curavelaWeekStart", weekStartSelect.value);

  localStorage.setItem("curavelaMonth", monthPicker.value);

  localStorage.setItem("curavelaWeekStartDate", weekStartDateInput.value);
}

function loadData() {
  const savedCustomShifts = getSavedItem(
    "curavelaCustomShifts",
    "kindshiftCustomShifts",
  );

  const savedCaregivers = getSavedItem(
    "curavelaCaregivers",
    "kindshiftCaregivers",
  );

  const savedCaregiverMaxHours = localStorage.getItem(
    "curavelaCaregiverMaxHours",
  );

  const savedCaregiverRules = localStorage.getItem("curavelaCaregiverRules");

  const savedAssignments = getSavedItem(
    "curavelaAssignments",
    "kindshiftAssignments",
  );

  const savedScheduleNote = getSavedItem(
    "curavelaScheduleNote",
    "kindshiftScheduleNote",
  );

  const savedShiftTimes = getSavedItem(
    "curavelaShiftTimes",
    "kindshiftShiftTimes",
  );

  const savedShiftTimeOverrides = getSavedItem(
    "curavelaShiftTimeOverrides",
    "kindshiftShiftTimeOverrides",
  );

  if (savedCustomShifts) {
    customShifts = JSON.parse(savedCustomShifts);
  }

  if (savedCaregivers) {
    caregivers = JSON.parse(savedCaregivers);
  }

  if (savedCaregiverMaxHours) {
    caregiverMaxHours = JSON.parse(savedCaregiverMaxHours);
  }

  if (savedCaregiverRules) {
    caregiverRules = JSON.parse(savedCaregiverRules);
  }

  if (savedAssignments) {
    scheduleAssignments = JSON.parse(savedAssignments);
  }

  if (savedScheduleNote) {
    scheduleNote = savedScheduleNote;
  }

  if (savedShiftTimes) {
    shiftTimes = {
      ...shiftTimes,
      ...JSON.parse(savedShiftTimes),
    };
  }

  if (savedShiftTimeOverrides) {
    shiftTimeOverrides = JSON.parse(savedShiftTimeOverrides);
  }

  const savedScheduleView = getSavedItem(
    "curavelaScheduleView",
    "kindshiftScheduleView",
  );

  const savedShiftStyle = getSavedItem(
    "curavelaShiftStyle",
    "kindshiftShiftStyle",
  );

  const savedWeekStart = getSavedItem(
    "curavelaWeekStart",
    "kindshiftWeekStart",
  );

  const savedMonth = getSavedItem("curavelaMonth", "kindshiftMonth");

  const savedWeekStartDate = getSavedItem(
    "curavelaWeekStartDate",
    "kindshiftWeekStartDate",
  );

  if (savedScheduleView) {
    scheduleViewSelect.value = savedScheduleView;
  }

  if (savedShiftStyle) {
    shiftStyleSelect.value = savedShiftStyle;
  }

  if (savedWeekStart) {
    weekStartSelect.value = savedWeekStart;
  }

  if (savedMonth) {
    monthPicker.value = savedMonth;
  }

  if (savedWeekStartDate) {
    weekStartDateInput.value = savedWeekStartDate;
  }
}

function exportCuravelaData() {
  const backupData = {
    app: "Curavela",
    version: 3,
    exportedAt: new Date().toISOString(),
    customShifts,
    caregivers,
    caregiverMaxHours,
    caregiverRules,
    scheduleAssignments,
    scheduleNote,
    shiftTimes,
    shiftTimeOverrides,
    scheduleView: scheduleViewSelect.value,
    shiftStyle: shiftStyleSelect.value,
    weekStart: weekStartSelect.value,
    month: monthPicker.value,
    weekStartDate: weekStartDateInput.value,
  };

  const backupBlob = new Blob([JSON.stringify(backupData, null, 2)], {
    type: "application/json",
  });

  const backupUrl = URL.createObjectURL(backupBlob);
  const downloadLink = document.createElement("a");

  downloadLink.href = backupUrl;
  downloadLink.download = "curavela-backup.json";
  downloadLink.click();

  URL.revokeObjectURL(backupUrl);
}

function importCuravelaData(file) {
  const reader = new FileReader();

  reader.addEventListener("load", function () {
    try {
      const backupData = JSON.parse(reader.result);

      customShifts = backupData.customShifts || customShifts;

      caregivers = backupData.caregivers || caregivers;

      caregiverMaxHours = backupData.caregiverMaxHours || caregiverMaxHours;

      caregiverRules = backupData.caregiverRules || {};

      scheduleAssignments = backupData.scheduleAssignments || {};

      scheduleNote = backupData.scheduleNote || "";

      shiftTimes = {
        ...shiftTimes,
        ...(backupData.shiftTimes || {}),
      };

      shiftTimeOverrides = backupData.shiftTimeOverrides || {};

      if (backupData.scheduleView) {
        scheduleViewSelect.value = backupData.scheduleView;
      }

      if (backupData.shiftStyle) {
        shiftStyleSelect.value = backupData.shiftStyle;
      }

      if (backupData.weekStart) {
        weekStartSelect.value = backupData.weekStart;
      }

      if (backupData.month) {
        monthPicker.value = backupData.month;
      }

      if (backupData.weekStartDate) {
        weekStartDateInput.value = backupData.weekStartDate;
      }

      scheduleNoteInput.value = scheduleNote;

      saveData();
      updateCustomShiftVisibility();
      updatePickerVisibility();
      renderShiftList();
      renderCaregiverList();
      renderShiftTimeList();
      renderSchedule();

      alert("Backup imported successfully.");
    } catch (error) {
      console.error(error);

      alert("That backup file could not be imported.");
    }
  });

  reader.readAsText(file);
}

/* dates */

function getTodayDateValue() {
  const today = new Date();

  const year = today.getFullYear();

  const month = String(today.getMonth() + 1).padStart(2, "0");

  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayMonthValue() {
  const today = new Date();

  const year = today.getFullYear();

  const month = String(today.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function getDateKey(date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getAppDayIndex(date) {
  const jsDayIndex = date.getDay();

  return jsDayIndex === 0 ? 6 : jsDayIndex - 1;
}

function getOrderedWeekDays() {
  const startIndex = allWeekDays.indexOf(weekStartSelect.value);

  return allWeekDays.slice(startIndex).concat(allWeekDays.slice(0, startIndex));
}

function getDaysInSelectedWeek() {
  const selectedDate = weekStartDateInput.value || getTodayDateValue();

  const [year, month, day] = selectedDate.split("-").map(Number);

  const chosenDate = new Date(year, month - 1, day);

  const selectedStartDayIndex = allWeekDays.indexOf(weekStartSelect.value);

  const chosenDayIndex = getAppDayIndex(chosenDate);

  let daysToSubtract = chosenDayIndex - selectedStartDayIndex;

  if (daysToSubtract < 0) {
    daysToSubtract += 7;
  }

  const startDate = new Date(chosenDate);

  startDate.setDate(chosenDate.getDate() - daysToSubtract);

  const days = [];

  for (let index = 0; index < 7; index += 1) {
    const currentDate = new Date(startDate);

    currentDate.setDate(startDate.getDate() + index);

    days.push({
      label: currentDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),

      shortLabel: currentDate.toLocaleDateString("en-US", {
        weekday: "short",
      }),

      dateLabel: currentDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),

      key: getDateKey(currentDate),
      date: currentDate,
    });
  }

  return days;
}

function getDaysInSelectedMonth() {
  const selectedMonth = monthPicker.value || getTodayMonthValue();

  const [year, month] = selectedMonth.split("-").map(Number);

  const lastDayOfMonth = new Date(year, month, 0).getDate();

  const days = [];

  for (let dayNumber = 1; dayNumber <= lastDayOfMonth; dayNumber += 1) {
    const date = new Date(year, month - 1, dayNumber);

    days.push({
      label: date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),

      shortLabel: date.toLocaleDateString("en-US", {
        weekday: "short",
      }),

      dateLabel: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),

      key: getDateKey(date),
      date,
    });
  }

  return days;
}

function changeSelectedWeekByDays(dayAmount) {
  const currentValue = weekStartDateInput.value || getTodayDateValue();

  const [year, month, day] = currentValue.split("-").map(Number);

  const currentDate = new Date(year, month - 1, day);

  currentDate.setDate(currentDate.getDate() + dayAmount);

  weekStartDateInput.value = getDateKey(currentDate);

  saveData();
  updateWeekDisplay();
  renderSchedule();
}

function updateWeekDisplay() {
  if (!selectedWeekDisplay) {
    return;
  }

  const days = getDaysInSelectedWeek();

  selectedWeekDisplay.textContent =
    `${days[0].dateLabel} – ` + `${days[days.length - 1].dateLabel}`;
}

function updateMonthDisplay() {
  if (!selectedMonthDisplay) {
    return;
  }

  const selectedMonth = monthPicker.value || getTodayMonthValue();

  const [year, month] = selectedMonth.split("-").map(Number);

  selectedMonthDisplay.textContent = new Date(
    year,
    month - 1,
  ).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function changeSelectedMonthByMonths(monthAmount) {
  const currentValue = monthPicker.value || getTodayMonthValue();

  const [year, month] = currentValue.split("-").map(Number);

  const currentDate = new Date(year, month - 1, 1);

  currentDate.setMonth(currentDate.getMonth() + monthAmount);

  monthPicker.value =
    `${currentDate.getFullYear()}-` +
    `${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

  saveData();
  updateMonthDisplay();
  renderSchedule();
}

/* shifts */

function getShiftConfig(shiftName, defaultStart, defaultEnd) {
  if (!shiftTimes[shiftName]) {
    shiftTimes[shiftName] = {
      start: defaultStart,
      end: defaultEnd,
    };
  }

  return {
    name: shiftName,
    start: shiftTimes[shiftName].start,
    end: shiftTimes[shiftName].end,
  };
}

function getActiveShifts() {
  const selectedShiftStyle = shiftStyleSelect.value;

  if (selectedShiftStyle === "one") {
    return [getShiftConfig("Full Day", "00:00", "00:00")];
  }

  if (selectedShiftStyle === "two") {
    return [
      getShiftConfig("Day", "07:00", "19:00"),

      getShiftConfig("Night", "19:00", "07:00"),
    ];
  }

  if (selectedShiftStyle === "three") {
    return [
      getShiftConfig("Morning", "06:30", "13:00"),

      getShiftConfig("Afternoon", "13:00", "19:00"),

      getShiftConfig("Night", "19:00", "07:00"),
    ];
  }

  return customShifts.map(function (shiftName) {
    return getShiftConfig(shiftName, "09:00", "17:00");
  });
}

function getShiftOverrideKey(dayKey, shiftName) {
  return `${dayKey}__${shiftName}`;
}

function getShiftForDay(dayKey, shift) {
  const override = shiftTimeOverrides[getShiftOverrideKey(dayKey, shift.name)];

  if (override) {
    return {
      ...shift,
      start: override.start,
      end: override.end,
      hasOverride: true,
    };
  }

  return {
    ...shift,
    hasOverride: false,
  };
}

function formatTime(timeValue) {
  const [hourText, minuteText] = timeValue.split(":");

  const hour = Number(hourText);

  const period = hour >= 12 ? "PM" : "AM";

  const displayHour = hour % 12 === 0 ? 12 : hour % 12;

  return `${displayHour}:${minuteText} ${period}`;
}

function getShiftHours(shift) {
  const [startHour, startMinute] = shift.start.split(":").map(Number);

  const [endHour, endMinute] = shift.end.split(":").map(Number);

  const startMinutes = startHour * 60 + startMinute;

  let endMinutes = endHour * 60 + endMinute;

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  return (endMinutes - startMinutes) / 60;
}

function formatHours(hours) {
  return Number.isInteger(hours) ? `${hours} hrs` : `${hours.toFixed(1)} hrs`;
}

function buildCaregiverOptions(assignedCaregiver) {
  let caregiverOptions = `<option value="Open">Open</option>`;

  caregivers.forEach(function (caregiverName) {
    const selected = caregiverName === assignedCaregiver ? "selected" : "";

    caregiverOptions += `
        <option
          value="${caregiverName}"
          ${selected}
        >
          ${caregiverName}
        </option>
      `;
  });

  return caregiverOptions;
}

function getCaregiverHoursForDays(scheduleDays, activeShifts) {
  const caregiverHours = {};

  caregivers.forEach(function (caregiverName) {
    caregiverHours[caregiverName] = 0;
  });

  scheduleDays.forEach(function (day) {
    activeShifts.forEach(function (shift) {
      const assignmentKey = `${day.key}-${shift.name}`;

      const assignedCaregiver = scheduleAssignments[assignmentKey] || "Open";

      if (assignedCaregiver === "Open") {
        return;
      }

      const shiftForDay = getShiftForDay(day.key, shift);

      caregiverHours[assignedCaregiver] =
        (caregiverHours[assignedCaregiver] || 0) + getShiftHours(shiftForDay);
    });
  });

  return caregiverHours;
}

/* caregiver rules */

function getDefaultCaregiverRules() {
  return {
    availableDays: [...allWeekDays],
    allowedShifts: [],
    maxConsecutiveDays: 0,
    needsTwoConsecutiveDaysOff: false,
    note: "",
  };
}

function getCaregiverRules(caregiverName) {
  return {
    ...getDefaultCaregiverRules(),
    ...(caregiverRules[caregiverName] || {}),
  };
}

function renderCaregiverRuleChoices(caregiverName) {
  if (!caregiverRuleDays || !caregiverRuleShifts) {
    return;
  }

  const rules = getCaregiverRules(caregiverName);

  caregiverRuleDays.innerHTML = allWeekDays
    .map(function (dayName) {
      const isChecked = rules.availableDays.includes(dayName);

      return `
          <label class="rule-choice">
            <input
              class="caregiver-rule-day-checkbox"
              type="checkbox"
              value="${dayName}"
              ${isChecked ? "checked" : ""}
            />

            <span>${dayName}</span>
          </label>
        `;
    })
    .join("");

  caregiverRuleShifts.innerHTML = getActiveShifts()
    .map(function (shift) {
      const isChecked = rules.allowedShifts.includes(shift.name);

      return `
          <label class="rule-choice">
            <input
              class="caregiver-rule-shift-checkbox"
              type="checkbox"
              value="${shift.name}"
              ${isChecked ? "checked" : ""}
            />

            <span>${shift.name}</span>
          </label>
        `;
    })
    .join("");
}

function openCaregiverRulesModal(caregiverName) {
  if (!caregiverRulesModal) {
    return;
  }

  activeCaregiverRulesName = caregiverName;

  const rules = getCaregiverRules(caregiverName);

  caregiverRulesTitle.textContent = `${caregiverName} Rules`;

  caregiverMaxConsecutiveDaysInput.value = rules.maxConsecutiveDays || 0;

  caregiverNeedsTwoDaysOffInput.checked = rules.needsTwoConsecutiveDaysOff;

  caregiverRuleNoteInput.value = rules.note || "";

  renderCaregiverRuleChoices(caregiverName);

  caregiverRulesModal.classList.remove("hidden");
}

function closeCaregiverRulesModal() {
  if (!caregiverRulesModal) {
    return;
  }

  caregiverRulesModal.classList.add("hidden");

  activeCaregiverRulesName = "";
}

function saveActiveCaregiverRules() {
  if (!activeCaregiverRulesName) {
    return;
  }

  const selectedDays = Array.from(
    document.querySelectorAll(".caregiver-rule-day-checkbox:checked"),
  ).map(function (checkbox) {
    return checkbox.value;
  });

  const selectedShifts = Array.from(
    document.querySelectorAll(".caregiver-rule-shift-checkbox:checked"),
  ).map(function (checkbox) {
    return checkbox.value;
  });

  caregiverRules[activeCaregiverRulesName] = {
    availableDays: selectedDays,

    allowedShifts: selectedShifts,

    maxConsecutiveDays: Number(caregiverMaxConsecutiveDaysInput.value) || 0,

    needsTwoConsecutiveDaysOff: caregiverNeedsTwoDaysOffInput.checked,

    note: caregiverRuleNoteInput.value.trim(),
  };

  saveData();
  closeCaregiverRulesModal();
  renderCaregiverList();
  renderSchedule();
}

function getCaregiverScheduledDays(caregiverName, scheduleDays, activeShifts) {
  return scheduleDays.map(function (day) {
    return activeShifts.some(function (shift) {
      const assignmentKey = `${day.key}-${shift.name}`;

      return scheduleAssignments[assignmentKey] === caregiverName;
    });
  });
}

function getLongestConsecutiveRun(scheduledDays) {
  let longestRun = 0;
  let currentRun = 0;

  scheduledDays.forEach(function (isScheduled) {
    if (isScheduled) {
      currentRun += 1;

      longestRun = Math.max(longestRun, currentRun);
    } else {
      currentRun = 0;
    }
  });

  return longestRun;
}

function hasTwoConsecutiveDaysOff(scheduledDays) {
  for (let index = 0; index < scheduledDays.length - 1; index += 1) {
    if (!scheduledDays[index] && !scheduledDays[index + 1]) {
      return true;
    }
  }

  return false;
}

function getCaregiverRuleWarnings(scheduleDays, activeShifts) {
  const warningMap = new Map();

  caregivers.forEach(function (caregiverName) {
    const rules = getCaregiverRules(caregiverName);

    scheduleDays.forEach(function (day) {
      const dayName = day.date.toLocaleDateString("en-US", {
        weekday: "long",
      });

      activeShifts.forEach(function (shift) {
        const assignmentKey = `${day.key}-${shift.name}`;

        const assignedCaregiver = scheduleAssignments[assignmentKey] || "Open";

        if (assignedCaregiver !== caregiverName) {
          return;
        }

        if (!rules.availableDays.includes(dayName)) {
          warningMap.set(`${caregiverName}-unavailable-${day.key}`, {
            level: "high",

            text:
              `${caregiverName} is scheduled ${day.label}, ` +
              `but ${dayName} is unavailable.`,
          });
        }

        if (
          rules.allowedShifts.length > 0 &&
          !rules.allowedShifts.includes(shift.name)
        ) {
          warningMap.set(`${caregiverName}-shift-${day.key}-${shift.name}`, {
            level: "high",

            text:
              `${caregiverName} is scheduled for ${shift.name} ` +
              `on ${day.label}, but that shift is not allowed.`,
          });
        }
      });
    });

    const scheduledDays = getCaregiverScheduledDays(
      caregiverName,
      scheduleDays,
      activeShifts,
    );

    const maxConsecutiveDays = Number(rules.maxConsecutiveDays);

    if (maxConsecutiveDays > 0) {
      const longestRun = getLongestConsecutiveRun(scheduledDays);

      if (longestRun > maxConsecutiveDays) {
        warningMap.set(`${caregiverName}-consecutive`, {
          level: "medium",

          text:
            `${caregiverName} is scheduled ${longestRun} days in a row. ` +
            `Their maximum is ${maxConsecutiveDays}.`,
        });
      }
    }

    if (
      rules.needsTwoConsecutiveDaysOff &&
      scheduleDays.length >= 2 &&
      !hasTwoConsecutiveDaysOff(scheduledDays)
    ) {
      warningMap.set(`${caregiverName}-two-days-off`, {
        level: "medium",

        text:
          `${caregiverName} does not have two consecutive days off ` +
          `in this schedule.`,
      });
    }
  });

  return Array.from(warningMap.values());
}

function renderScheduleWarningStrip(warnings) {
  if (
    !scheduleWarningStrip ||
    !scheduleWarningSummary ||
    !scheduleWarningDetails
  ) {
    return;
  }

  scheduleWarningDetails.innerHTML = "";

  if (warnings.length === 0) {
    scheduleWarningStrip.classList.add("hidden");

    scheduleWarningStrip.removeAttribute("open");

    return;
  }

  scheduleWarningStrip.classList.remove("hidden");

  scheduleWarningSummary.textContent =
    `${warnings.length} ` +
    `${warnings.length === 1 ? "warning" : "warnings"} to review`;

  warnings.forEach(function (warning) {
    const warningItem = document.createElement("li");

    warningItem.classList.add(
      warning.level === "high" ? "warning-high" : "warning-medium",
    );

    warningItem.textContent = warning.text;

    scheduleWarningDetails.append(warningItem);
  });
}

/* coverage assistant */

function getCoverageOpenShifts(scheduleDays, activeShifts) {
  const openShifts = [];

  scheduleDays.forEach(function (day) {
    activeShifts.forEach(function (shift) {
      const assignmentKey = `${day.key}-${shift.name}`;

      const assignedCaregiver = scheduleAssignments[assignmentKey] || "Open";

      if (assignedCaregiver !== "Open") {
        return;
      }

      const shiftForDay = getShiftForDay(day.key, shift);

      openShifts.push({
        day,
        shift,
        shiftForDay,
        hours: getShiftHours(shiftForDay),
      });
    });
  });

  return openShifts;
}

function evaluateCoverageCandidate(
  caregiverName,
  day,
  shift,
  scheduleDays,
  activeShifts,
  caregiverHours,
) {
  const rules = getCaregiverRules(caregiverName);

  const dayName = day.date.toLocaleDateString("en-US", {
    weekday: "long",
  });

  const shiftForDay = getShiftForDay(day.key, shift);

  const shiftHours = getShiftHours(shiftForDay);

  const currentHours = caregiverHours[caregiverName] || 0;

  const maxHours = caregiverMaxHours[caregiverName] || 50;

  const projectedHours = currentHours + shiftHours;

  const conflicts = [];
  const checks = [];

  if (rules.availableDays.includes(dayName)) {
    checks.push(`Available ${dayName}`);
  } else {
    conflicts.push(`Unavailable ${dayName}`);
  }

  if (
    rules.allowedShifts.length === 0 ||
    rules.allowedShifts.includes(shift.name)
  ) {
    checks.push(`${shift.name} shift allowed`);
  } else {
    conflicts.push(`${shift.name} shift not allowed`);
  }

  if (projectedHours <= maxHours) {
    checks.push(`${formatHours(projectedHours)} of ${formatHours(maxHours)}`);
  } else {
    conflicts.push(
      `Would exceed max hours by ${formatHours(projectedHours - maxHours)}`,
    );
  }

  const scheduledDays = getCaregiverScheduledDays(
    caregiverName,
    scheduleDays,
    activeShifts,
  );

  const selectedDayIndex = scheduleDays.findIndex(function (scheduleDay) {
    return scheduleDay.key === day.key;
  });

  if (selectedDayIndex !== -1) {
    scheduledDays[selectedDayIndex] = true;
  }

  const maxConsecutiveDays = Number(rules.maxConsecutiveDays) || 0;

  if (maxConsecutiveDays > 0) {
    const longestRun = getLongestConsecutiveRun(scheduledDays);

    if (longestRun > maxConsecutiveDays) {
      conflicts.push(`Would create ${longestRun} consecutive days`);
    } else {
      checks.push("Consecutive-day rule stays safe");
    }
  }

  if (rules.needsTwoConsecutiveDaysOff) {
    if (hasTwoConsecutiveDaysOff(scheduledDays)) {
      checks.push("Keeps two consecutive days off");
    } else {
      conflicts.push("Would remove two consecutive days off");
    }
  }

  return {
    caregiverName,
    currentHours,
    projectedHours,
    maxHours,
    conflicts,
    checks,
    safe: conflicts.length === 0,
  };
}

function getCoverageCandidates(
  openShift,
  scheduleDays,
  activeShifts,
  caregiverHours,
) {
  const candidates = caregivers.map(function (caregiverName) {
    return evaluateCoverageCandidate(
      caregiverName,
      openShift.day,
      openShift.shift,
      scheduleDays,
      activeShifts,
      caregiverHours,
    );
  });

  candidates.sort(function (firstCandidate, secondCandidate) {
    if (firstCandidate.safe !== secondCandidate.safe) {
      return firstCandidate.safe ? -1 : 1;
    }

    if (firstCandidate.conflicts.length !== secondCandidate.conflicts.length) {
      return firstCandidate.conflicts.length - secondCandidate.conflicts.length;
    }

    return firstCandidate.projectedHours - secondCandidate.projectedHours;
  });

  return candidates;
}

function assignCoverageShift(dayKey, shiftName, caregiverName) {
  if (!caregiverName) {
    return;
  }

  const assignmentKey = `${dayKey}-${shiftName}`;

  scheduleAssignments[assignmentKey] = caregiverName;

  saveData();
  renderSchedule();
}

function buildCoverageCaregiverOptions() {
  let options = `
    <option value="">
      Choose caregiver
    </option>
  `;

  caregivers.forEach(function (caregiverName) {
    options += `
      <option value="${caregiverName}">
        ${caregiverName}
      </option>
    `;
  });

  return options;
}

function getCoverageShiftKey(dayKey, shiftName) {
  return `${dayKey}__${shiftName}`;
}

function renderCoverageAssistant() {
  if (!coverageArea || !coverageShiftsList || !coverageComparisonPanel) {
    return;
  }

  const scheduleDays = getDaysInSelectedWeek();
  const activeShifts = getActiveShifts();

  const caregiverHours = getCaregiverHoursForDays(scheduleDays, activeShifts);

  const openShifts = getCoverageOpenShifts(scheduleDays, activeShifts);

  const firstDay = scheduleDays[0].dateLabel;

  const lastDay = scheduleDays[scheduleDays.length - 1].dateLabel;

  coverageWeekLabel.textContent = `${firstDay} – ${lastDay}`;

  let totalOpenHours = 0;
  let safeMatchCount = 0;
  let noSafeMatchCount = 0;

  const recommendations = openShifts.map(function (openShift) {
    totalOpenHours += openShift.hours;

    const candidates = getCoverageCandidates(
      openShift,
      scheduleDays,
      activeShifts,
      caregiverHours,
    );

    const bestMatch =
      candidates.find(function (candidate) {
        return candidate.safe;
      }) || null;

    if (bestMatch) {
      safeMatchCount += 1;
    } else {
      noSafeMatchCount += 1;
    }

    return {
      ...openShift,
      candidates,
      bestMatch,
      key: getCoverageShiftKey(openShift.day.key, openShift.shift.name),
    };
  });

  coverageOpenCount.textContent = openShifts.length;

  coverageOpenHours.textContent = formatHours(totalOpenHours);

  coverageSafeCount.textContent = safeMatchCount;

  coverageNoMatchCount.textContent = noSafeMatchCount;

  if (coverageListCount) {
    coverageListCount.textContent = openShifts.length;
  }

  let visibleRecommendations = recommendations;

  if (coverageOnlyNoMatch && coverageOnlyNoMatch.checked) {
    visibleRecommendations = recommendations.filter(function (recommendation) {
      return !recommendation.bestMatch;
    });
  }

  coverageShiftsList.innerHTML = "";
  coverageComparisonPanel.innerHTML = "";

  if (openShifts.length === 0) {
    selectedCoverageShiftKey = "";

    coverageShiftsList.innerHTML = `
      <div class="coverage-small-empty">
        No open shifts.
      </div>
    `;

    coverageComparisonPanel.innerHTML = `
      <div class="coverage-comparison-empty">
        <span>✓</span>

        <div>
          <strong>Every shift is covered</strong>

          <p>
            There are no open shifts in this week.
          </p>
        </div>
      </div>
    `;

    return;
  }

  if (visibleRecommendations.length === 0) {
    selectedCoverageShiftKey = "";

    coverageShiftsList.innerHTML = `
      <div class="coverage-small-empty">
        Every open shift has a safe match.
      </div>
    `;

    coverageComparisonPanel.innerHTML = `
      <div class="coverage-comparison-empty">
        Turn off the filter to view all open shifts.
      </div>
    `;

    return;
  }

  const selectedStillExists = visibleRecommendations.some(
    function (recommendation) {
      return recommendation.key === selectedCoverageShiftKey;
    },
  );

  if (!selectedStillExists) {
    selectedCoverageShiftKey = visibleRecommendations[0].key;
  }

  let previousDayKey = "";

  visibleRecommendations.forEach(function (recommendation) {
    const { day, shift, shiftForDay, hours, bestMatch, key } = recommendation;

    if (previousDayKey !== day.key) {
      const dayHeading = document.createElement("div");

      dayHeading.classList.add("coverage-shift-day-heading");

      dayHeading.textContent = day.date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });

      coverageShiftsList.append(dayHeading);

      previousDayKey = day.key;
    }

    const shiftButton = document.createElement("button");

    shiftButton.type = "button";

    shiftButton.classList.add("coverage-shift-list-button");

    if (key === selectedCoverageShiftKey) {
      shiftButton.classList.add("active");
    }

    if (!bestMatch) {
      shiftButton.classList.add("has-conflict");
    }

    shiftButton.innerHTML = `
        <div>
          <strong>${shift.name}</strong>

          <span>
            ${formatTime(shiftForDay.start)}
            –
            ${formatTime(shiftForDay.end)}
          </span>
        </div>

        <div class="coverage-shift-list-meta">
          <strong>${formatHours(hours)}</strong>

          <span class="${bestMatch ? "safe-label" : "conflict-label"}">
            ${bestMatch ? `Best: ${bestMatch.caregiverName}` : "No safe match"}
          </span>
        </div>
      `;

    shiftButton.addEventListener("click", function () {
      selectedCoverageShiftKey = key;

      renderCoverageAssistant();
    });

    coverageShiftsList.append(shiftButton);
  });

  const selectedRecommendation = visibleRecommendations.find(
    function (recommendation) {
      return recommendation.key === selectedCoverageShiftKey;
    },
  );

  renderCoverageComparison(selectedRecommendation);
}

function renderCoverageComparison(recommendation) {
  if (!recommendation || !coverageComparisonPanel) {
    return;
  }

  const { day, shift, shiftForDay, hours, candidates, bestMatch } =
    recommendation;

  const dayName = day.date.toLocaleDateString("en-US", {
    weekday: "long",
  });

  const candidateRows = candidates
    .map(function (candidate) {
      const rules = getCaregiverRules(candidate.caregiverName);

      const isAvailable = rules.availableDays.includes(dayName);

      const shiftAllowed =
        rules.allowedShifts.length === 0 ||
        rules.allowedShifts.includes(shift.name);

      const hoursSafe = candidate.projectedHours <= candidate.maxHours;

      const otherConflicts = candidate.conflicts.filter(function (conflict) {
        return (
          !conflict.startsWith("Unavailable") &&
          !conflict.includes("shift not allowed") &&
          !conflict.startsWith("Would exceed max hours")
        );
      });

      const otherRuleText = otherConflicts[0] || "No rule conflicts";

      const isBestMatch =
        bestMatch && bestMatch.caregiverName === candidate.caregiverName;

      let statusText = "Conflict";

      if (isBestMatch) {
        statusText = "Best match";
      } else if (candidate.safe) {
        statusText = "Safe";
      }

      return `
        <article
          class="
            coverage-caregiver-row
            ${isBestMatch ? "best-match" : ""}
            ${candidate.safe ? "" : "unsafe-match"}
          "
        >
          <div class="coverage-caregiver-person">
            <div class="avatar">
              ${candidate.caregiverName.charAt(0).toUpperCase()}
            </div>

            <div>
              <strong>
                ${candidate.caregiverName}
              </strong>

              <span>
                ${getCaregiverRulesSummary(candidate.caregiverName)}
              </span>
            </div>
          </div>

          <div class="coverage-rule-column">
            <span class="coverage-column-label">
              Availability
            </span>

            <strong class="${isAvailable ? "rule-safe" : "rule-conflict"}">
              ${isAvailable ? `✓ ${dayName}` : `× Unavailable ${dayName}`}
            </strong>
          </div>

          <div class="coverage-rule-column">
            <span class="coverage-column-label">
              Shift
            </span>

            <strong class="${shiftAllowed ? "rule-safe" : "rule-conflict"}">
              ${
                shiftAllowed
                  ? `✓ ${shift.name} allowed`
                  : `× ${shift.name} not allowed`
              }
            </strong>
          </div>

          <div class="coverage-rule-column">
            <span class="coverage-column-label">
              Hours after
            </span>

            <strong class="${hoursSafe ? "rule-safe" : "rule-conflict"}">
              ${formatHours(candidate.projectedHours)}
              /
              ${formatHours(candidate.maxHours)}
            </strong>

            <small>
              ${formatHours(candidate.currentHours)}
              currently
            </small>
          </div>

          <div class="coverage-rule-column">
            <span class="coverage-column-label">
              Other rules
            </span>

            <strong class="${
              otherConflicts.length === 0 ? "rule-safe" : "rule-conflict"
            }">
              ${
                otherConflicts.length === 0
                  ? `✓ ${otherRuleText}`
                  : `× ${otherRuleText}`
              }
            </strong>
          </div>

          <div class="coverage-caregiver-action">
            <span
              class="
                coverage-match-status
                ${candidate.safe ? "safe" : "conflict"}
              "
            >
              ${statusText}
            </span>

            <button
              class="
                coverage-comparison-assign-button
                ${candidate.safe ? "" : "ghost-button"}
              "
              type="button"
              data-day="${day.key}"
              data-shift="${shift.name}"
              data-caregiver="${candidate.caregiverName}"
              data-safe="${candidate.safe}"
            >
              ${
                candidate.safe
                  ? `Assign ${candidate.caregiverName}`
                  : "Assign anyway"
              }
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  coverageComparisonPanel.innerHTML = `
    <div class="coverage-selected-shift-header">
      <div>
        <span class="coverage-open-badge">
          Selected open shift
        </span>

        <h3>
          ${day.label} · ${shift.name}
        </h3>

        <p>
          ${formatTime(shiftForDay.start)}
          –
          ${formatTime(shiftForDay.end)}
          ·
          ${formatHours(hours)}
        </p>
      </div>

      <div
        class="
          coverage-selected-status
          ${bestMatch ? "safe" : "conflict"}
        "
      >
        ${
          bestMatch ? `Best match: ${bestMatch.caregiverName}` : "No safe match"
        }
      </div>
    </div>

    <div class="coverage-comparison-heading">
      <div>Caregiver</div>
      <div>Availability</div>
      <div>Shift rule</div>
      <div>Hours</div>
      <div>Other rules</div>
      <div>Action</div>
    </div>

    <div class="coverage-caregiver-comparison">
      ${candidateRows}
    </div>
  `;

  coverageComparisonPanel
    .querySelectorAll(".coverage-comparison-assign-button")
    .forEach(function (button) {
      button.addEventListener("click", function () {
        const isSafe = button.dataset.safe === "true";

        if (!isSafe) {
          const shouldAssign = confirm(
            `Assign ${button.dataset.caregiver} even though this conflicts with their rules?`,
          );

          if (!shouldAssign) {
            return;
          }
        }

        assignCoverageShift(
          button.dataset.day,
          button.dataset.shift,
          button.dataset.caregiver,
        );
      });
    });
}

/* weekly schedule */

function attachOpenShiftToggleListeners() {
  const openShiftCards = document.querySelectorAll(".open-day-summary");

  openShiftCards.forEach(function (openShiftCard) {
    const toggleButton = openShiftCard.querySelector(".open-day-toggle");

    if (!toggleButton) {
      return;
    }

    toggleButton.addEventListener("click", function () {
      const isOpen = openShiftCard.classList.toggle("is-open");

      toggleButton.setAttribute("aria-expanded", String(isOpen));
    });
  });
}

function renderWeeklySchedule(scheduleDays, activeShifts) {
  scheduleSection.className = "";
  scheduleSection.innerHTML = "";

  if (caregivers.length === 0 && scheduleMode !== "open") {
    scheduleSection.innerHTML = `
      <div class="empty-state">
        Add caregivers to start building the care map.
      </div>
    `;

    return;
  }

  const caregiverHours = getCaregiverHoursForDays(scheduleDays, activeShifts);

  const careMapGrid = document.createElement("div");

  careMapGrid.classList.add("care-map-grid");

  careMapGrid.style.setProperty("--day-count", scheduleDays.length);

  careMapGrid.innerHTML = `
  <div class="care-map-cell care-map-header caregiver-cell">
    <strong>
      ${scheduleMode === "open" ? "Open shifts" : "Caregiver"}
    </strong>
  </div>
`;

  scheduleDays.forEach(function (day) {
    const dayHeader = document.createElement("div");

    dayHeader.classList.add("care-map-cell", "care-map-header");

    dayHeader.innerHTML = `
        <strong>${day.shortLabel}</strong>
        <span>${day.dateLabel}</span>
      `;

    careMapGrid.append(dayHeader);
  });

  if (scheduleMode !== "open") {
    caregivers.forEach(function (caregiverName) {
      const caregiverCell = document.createElement("div");

      caregiverCell.classList.add(
        "care-map-cell",
        "caregiver-cell",
        "draggable-caregiver",
      );

      caregiverCell.draggable = true;

      caregiverCell.dataset.caregiver = caregiverName;

      caregiverCell.innerHTML = `
        <span
          class="caregiver-drag-handle"
          title="Drag to reorder"
        >
          ⋮⋮
        </span>

        <div class="avatar">
          ${caregiverName.charAt(0).toUpperCase()}
        </div>

        <div>
          <span class="caregiver-name">
            ${caregiverName}
          </span>

          <span class="caregiver-meta">
            ${formatHours(caregiverHours[caregiverName] || 0)}
          </span>
        </div>
      `;

      careMapGrid.append(caregiverCell);

      scheduleDays.forEach(function (day) {
        const dayCell = document.createElement("div");

        dayCell.classList.add("care-map-cell");

        const shiftStack = document.createElement("div");

        shiftStack.classList.add("shift-stack");

        activeShifts.forEach(function (shift) {
          const assignmentKey = `${day.key}-${shift.name}`;

          const assignedCaregiver =
            scheduleAssignments[assignmentKey] || "Open";

          if (assignedCaregiver !== caregiverName) {
            return;
          }

          const shiftForDay = getShiftForDay(day.key, shift);

          const shiftPill = document.createElement("div");

          shiftPill.classList.add("shift-pill");

          shiftPill.innerHTML = `
                <strong>
                  ${formatTime(shiftForDay.start)}
                  –
                  ${formatTime(shiftForDay.end)}
                </strong>

                <span>
                  ${shift.name}
                </span>

                <select
                  class="assignment-select"
                  data-day="${day.key}"
                  data-shift="${shift.name}"
                >
                  ${buildCaregiverOptions(assignedCaregiver)}
                </select>
              `;

          shiftStack.append(shiftPill);
        });

        if (shiftStack.children.length === 0) {
          dayCell.innerHTML = `
              <div class="empty-cell">
                —
              </div>
            `;
        } else {
          dayCell.append(shiftStack);
        }

        careMapGrid.append(dayCell);
      });
    });
  }

  const totalOpenShifts = scheduleDays.reduce(function (total, day) {
    const openShiftsForDay = activeShifts.filter(function (shift) {
      const assignmentKey = `${day.key}-${shift.name}`;

      return (scheduleAssignments[assignmentKey] || "Open") === "Open";
    });

    return total + openShiftsForDay.length;
  }, 0);

  const openCaregiverCell = document.createElement("div");

  openCaregiverCell.classList.add(
    "care-map-cell",
    "caregiver-cell",
    "open-shifts-label",
  );

  openCaregiverCell.innerHTML = `
    <div class="avatar">+</div>

    <div>
      <span class="caregiver-name">
        Open shifts
      </span>

      <span class="caregiver-meta">
        ${totalOpenShifts}
        ${totalOpenShifts === 1 ? "shift" : "shifts"}
        need coverage
      </span>
    </div>
  `;

  careMapGrid.append(openCaregiverCell);

  scheduleDays.forEach(function (day) {
    const dayCell = document.createElement("div");

    dayCell.classList.add("care-map-cell", "open-summary-cell");

    const openShiftsForDay = activeShifts.filter(function (shift) {
      const assignmentKey = `${day.key}-${shift.name}`;

      return (scheduleAssignments[assignmentKey] || "Open") === "Open";
    });

    if (openShiftsForDay.length === 0) {
      dayCell.innerHTML = `
          <div class="open-day-covered">
            <span>✓</span>
            Covered
          </div>
        `;

      careMapGrid.append(dayCell);

      return;
    }

    const openShiftNames = openShiftsForDay
      .map(function (shift) {
        return shift.name;
      })
      .join(" · ");

    const openShiftRows = openShiftsForDay
      .map(function (shift) {
        const shiftForDay = getShiftForDay(day.key, shift);

        return `
                <div class="open-mini-shift">
                  <div class="open-mini-shift-info">
                    <strong>
                      ${shift.name}
                    </strong>

                    <span>
                      ${formatTime(shiftForDay.start)}
                      –
                      ${formatTime(shiftForDay.end)}
                    </span>
                  </div>

                  <select
                    class="assignment-select"
                    data-day="${day.key}"
                    data-shift="${shift.name}"
                  >
                    ${buildCaregiverOptions("Open")}
                  </select>
                </div>
              `;
      })
      .join("");

    dayCell.innerHTML = `
  <div class="open-day-summary">
    <button
      class="open-day-toggle"
      type="button"
      aria-expanded="false"
    >
      <div>
        <strong>
          ${openShiftsForDay.length}
          open
        </strong>

        <span>
          ${openShiftNames}
        </span>
      </div>

      <span class="open-chevron">
        ⌄
      </span>
    </button>

    <div class="open-day-menu">
      <div class="open-day-menu-inner">
        ${openShiftRows}
      </div>
    </div>
  </div>
`;

    careMapGrid.append(dayCell);
  });

  scheduleSection.append(careMapGrid);

  scheduleSection.append(careMapGrid);

  attachOpenShiftToggleListeners();
  attachCaregiverDragListeners();
}

/* monthly schedule */

function renderMonthlySchedule(scheduleDays, activeShifts) {
  scheduleSection.innerHTML = "";
  scheduleSection.className = "";

  scheduleSection.classList.add("monthly-schedule-grid");

  const orderedWeekDays = getOrderedWeekDays();

  orderedWeekDays.forEach(function (dayName) {
    const weekdayHeader = document.createElement("div");

    weekdayHeader.classList.add("month-weekday-header");

    weekdayHeader.textContent = dayName.slice(0, 3);

    scheduleSection.append(weekdayHeader);
  });

  if (scheduleDays.length > 0) {
    const firstDayIndex = getAppDayIndex(scheduleDays[0].date);

    const selectedStartIndex = allWeekDays.indexOf(weekStartSelect.value);

    let blankDays = firstDayIndex - selectedStartIndex;

    if (blankDays < 0) {
      blankDays += 7;
    }

    for (let index = 0; index < blankDays; index += 1) {
      const emptyDay = document.createElement("div");

      emptyDay.classList.add("month-empty-day");

      scheduleSection.append(emptyDay);
    }
  }

  scheduleDays.forEach(function (day) {
    const dayCard = document.createElement("div");

    dayCard.classList.add("month-day-card");

    let shiftRows = "";

    activeShifts.forEach(function (shift) {
      const assignmentKey = `${day.key}-${shift.name}`;

      const assignedCaregiver = scheduleAssignments[assignmentKey] || "Open";

      const shiftForDay = getShiftForDay(day.key, shift);

      shiftRows += `
            <div class="month-shift-row">
              <div class="month-shift-info">
                <span>
                  ${shift.name}
                </span>

                <span>
                  ${formatTime(shiftForDay.start)}
                </span>
              </div>

              <select
                class="assignment-select month-assignment-select"
                data-day="${day.key}"
                data-shift="${shift.name}"
              >
                ${buildCaregiverOptions(assignedCaregiver)}
              </select>
            </div>
          `;
    });

    dayCard.innerHTML = `
        <div class="month-day-header">
          <span class="month-date-number">
            ${day.date.getDate()}
          </span>

          <span class="month-weekday">
            ${day.shortLabel}
          </span>
        </div>

        <div class="month-shifts">
          ${shiftRows}
        </div>
      `;

    scheduleSection.append(dayCard);
  });
}

/* summaries and warnings */

function renderCaregiverInsights(warnings, caregiverHours) {
  if (
    !caregiverHoursStatus ||
    !caregiverInsightHeadline ||
    !caregiverInsightMessage ||
    !caregiverUpdateCount ||
    !caregiverUpdateList
  ) {
    return;
  }

  caregiverUpdateList.innerHTML = "";

  const highWarnings = warnings.filter(function (warning) {
    return warning.level === "high";
  });

  const activeCaregiverCount = caregivers.filter(function (caregiverName) {
    return (caregiverHours[caregiverName] || 0) > 0;
  }).length;

  const customRuleCount = caregivers.filter(function (caregiverName) {
    const rules = getCaregiverRules(caregiverName);

    return (
      rules.availableDays.length < allWeekDays.length ||
      rules.allowedShifts.length > 0 ||
      rules.maxConsecutiveDays > 0 ||
      rules.needsTwoConsecutiveDaysOff ||
      Boolean(rules.note)
    );
  }).length;

  caregiverHoursStatus.className = "caregiver-hours-status";

  if (caregivers.length === 0) {
    caregiverHoursStatus.classList.add("neutral");

    caregiverHoursStatus.textContent = "No team";

    caregiverInsightHeadline.textContent = "Start building your care team";

    caregiverInsightMessage.textContent =
      "Add caregivers to track hours, availability, and scheduling rules.";
  } else if (highWarnings.length > 0) {
    caregiverHoursStatus.classList.add("danger");

    caregiverHoursStatus.textContent = `${highWarnings.length} priority`;

    caregiverInsightHeadline.textContent = `${highWarnings.length} important ${
      highWarnings.length === 1 ? "issue" : "issues"
    }`;

    caregiverInsightMessage.textContent =
      "Review hour limits and caregiver rules before finalizing this schedule.";
  } else if (warnings.length > 0) {
    caregiverHoursStatus.classList.add("warning");

    caregiverHoursStatus.textContent = `${warnings.length} updates`;

    caregiverInsightHeadline.textContent = "A few details need attention";

    caregiverInsightMessage.textContent =
      "The schedule is workable, but some limits or rules should be reviewed.";
  } else {
    caregiverHoursStatus.classList.add("safe");

    caregiverHoursStatus.textContent = "All clear";

    caregiverInsightHeadline.textContent = "Your team looks balanced";

    caregiverInsightMessage.textContent = `${activeCaregiverCount} of ${caregivers.length} caregivers are scheduled in this view.`;
  }

  let updates = warnings.slice(0, 3);

  if (updates.length === 0 && caregivers.length > 0) {
    updates = [
      {
        level: "safe",

        text: `${activeCaregiverCount} of ${caregivers.length} caregivers have scheduled hours.`,
      },

      {
        level: "safe",

        text: `${customRuleCount} ${
          customRuleCount === 1 ? "caregiver has" : "caregivers have"
        } custom scheduling rules.`,
      },

      {
        level: "safe",

        text: "No caregivers are near or over their weekly limit.",
      },
    ];
  }

  if (caregivers.length === 0) {
    updates = [
      {
        level: "neutral",

        text: "Add your first caregiver to begin receiving scheduling updates.",
      },
    ];
  }

  caregiverUpdateCount.textContent = `${warnings.length} ${
    warnings.length === 1 ? "update" : "updates"
  }`;

  updates.forEach(function (update) {
    const updateItem = document.createElement("li");

    updateItem.classList.add(`update-${update.level}`);

    updateItem.innerHTML = `
      <span class="update-status-dot"></span>
      <span>${update.text}</span>
    `;

    caregiverUpdateList.append(updateItem);
  });
}

function renderCoverageSummary(scheduleDays, activeShifts) {
  let totalHoursNeeded = 0;
  let totalHoursCovered = 0;
  let openHours = 0;
  let openShiftsCount = 0;

  const caregiverHours = {};
  const warnings = [];

  caregivers.forEach(function (caregiverName) {
    caregiverHours[caregiverName] = 0;
  });

  if (availableShiftsList) {
    availableShiftsList.innerHTML = "";
  }

  scheduleDays.forEach(function (day) {
    activeShifts.forEach(function (shift) {
      const shiftForDay = getShiftForDay(day.key, shift);

      const shiftHours = getShiftHours(shiftForDay);

      const assignmentKey = `${day.key}-${shift.name}`;

      const assignedCaregiver = scheduleAssignments[assignmentKey] || "Open";

      totalHoursNeeded += shiftHours;

      if (assignedCaregiver === "Open") {
        openHours += shiftHours;
        openShiftsCount += 1;

        if (availableShiftsList) {
          const availableShiftItem = document.createElement("li");

          availableShiftItem.innerHTML = `
                <strong>
                  ${day.label}
                </strong>
                <br>

                ${shift.name}
                ·
                ${formatTime(shiftForDay.start)}
                –
                ${formatTime(shiftForDay.end)}
                ·
                ${formatHours(shiftHours)}
              `;

          availableShiftsList.append(availableShiftItem);
        }
      } else {
        totalHoursCovered += shiftHours;

        caregiverHours[assignedCaregiver] =
          (caregiverHours[assignedCaregiver] || 0) + shiftHours;
      }
    });
  });

  totalHoursNeededElement.textContent = formatHours(totalHoursNeeded);

  totalHoursCoveredElement.textContent = formatHours(totalHoursCovered);

  openHoursElement.textContent = formatHours(openHours);

  openShiftsCountElement.textContent = openShiftsCount;

  if (toastOpenShiftsCount) {
    toastOpenShiftsCount.textContent = openShiftsCount;
  }

  if (caregiverHoursList) {
    caregiverHoursList.innerHTML = "";

    if (caregivers.length === 0) {
      const emptyCaregiverItem = document.createElement("li");

      emptyCaregiverItem.classList.add("caregiver-hours-empty");

      emptyCaregiverItem.textContent =
        "Add caregivers to begin tracking hours.";

      caregiverHoursList.append(emptyCaregiverItem);
    } else {
      caregivers.forEach(function (caregiverName) {
        const caregiverHoursItem = document.createElement("li");

        const hoursWorked = caregiverHours[caregiverName] || 0;

        const maxHours = caregiverMaxHours[caregiverName] || 50;

        const rawPercent = maxHours > 0 ? (hoursWorked / maxHours) * 100 : 0;

        const progressPercent = Math.min(rawPercent, 100);

        let statusText = "On track";
        let statusClass = "safe";

        if (hoursWorked > maxHours) {
          const hoursOver = hoursWorked - maxHours;

          statusText = `${formatHours(hoursOver)} over`;

          statusClass = "danger";

          warnings.push({
            level: "high",

            text:
              `${caregiverName} is over their weekly maximum by ` +
              `${formatHours(hoursOver)}.`,
          });

          renderCaregiverInsights(warnings, caregiverHours);
        } else if (hoursWorked >= maxHours - 5) {
          statusText = "Near limit";
          statusClass = "warning";

          warnings.push({
            level: "medium",

            text:
              `${caregiverName} is close to their ` +
              `${formatHours(maxHours)} weekly limit.`,
          });
        }

        caregiverHoursItem.classList.add(
          "caregiver-hours-row",
          `is-${statusClass}`,
        );

        caregiverHoursItem.innerHTML = `
        <div class="caregiver-hours-row-top">
          <div>
            <strong>
              ${caregiverName}
            </strong>

            <span>
              ${formatHours(hoursWorked)}
              of
              ${formatHours(maxHours)}
            </span>
          </div>

          <span
            class="
              caregiver-hour-state
              ${statusClass}
            "
          >
            ${statusText}
          </span>
        </div>

        <div class="caregiver-hours-track">
          <span
            style="width: ${progressPercent}%"
          ></span>
        </div>
      `;

        caregiverHoursList.append(caregiverHoursItem);
      });
    }
  }

  if (availableShiftsList && openShiftsCount === 0) {
    const noOpenShiftsItem = document.createElement("li");

    noOpenShiftsItem.textContent = "No available shifts.";

    availableShiftsList.append(noOpenShiftsItem);
  }

  warnings.push(...getCaregiverRuleWarnings(scheduleDays, activeShifts));

  if (warningCountElement) {
    warningCountElement.textContent = warnings.length;
  }

  renderScheduleWarningStrip(warnings);

  if (coveragePercentElement && coverageProgressFill) {
    const coveragePercent =
      totalHoursNeeded > 0
        ? Math.round((totalHoursCovered / totalHoursNeeded) * 100)
        : 0;

    coveragePercentElement.textContent = `${coveragePercent}%`;

    coverageProgressFill.style.width = `${coveragePercent}%`;

    const degrees = Math.round((coveragePercent / 100) * 360);

    const coverageRing = document.querySelector(".coverage-ring");

    if (coverageRing) {
      coverageRing.style.background = `
        radial-gradient(
          circle at center,
          #fff 58%,
          transparent 60%
        ),
        conic-gradient(
          var(--blue) ${degrees}deg,
          #edf2fb ${degrees}deg
        )
      `;
    }
  }

  startAvailableShiftsAutoScroll();
}

/* drag ordering */

function attachCaregiverDragListeners() {
  const caregiverCells = document.querySelectorAll(
    ".draggable-caregiver[data-caregiver]",
  );

  caregiverCells.forEach(function (caregiverCell) {
    caregiverCell.addEventListener("dragstart", function (event) {
      draggedCaregiverName = caregiverCell.dataset.caregiver;

      event.dataTransfer.effectAllowed = "move";

      event.dataTransfer.setData("text/plain", draggedCaregiverName);

      caregiverCell.classList.add("is-dragging");
    });

    caregiverCell.addEventListener("dragover", function (event) {
      event.preventDefault();

      event.dataTransfer.dropEffect = "move";

      document
        .querySelectorAll(".draggable-caregiver")
        .forEach(function (cell) {
          cell.classList.remove("drag-over");
        });

      caregiverCell.classList.add("drag-over");
    });

    caregiverCell.addEventListener("dragleave", function () {
      caregiverCell.classList.remove("drag-over");
    });

    caregiverCell.addEventListener("drop", function (event) {
      event.preventDefault();

      const sourceCaregiverName =
        event.dataTransfer.getData("text/plain") || draggedCaregiverName;

      const targetCaregiverName = caregiverCell.dataset.caregiver;

      if (
        !sourceCaregiverName ||
        !targetCaregiverName ||
        sourceCaregiverName === targetCaregiverName
      ) {
        caregiverCell.classList.remove("drag-over");

        return;
      }

      const sourceIndex = caregivers.indexOf(sourceCaregiverName);

      if (sourceIndex === -1) {
        return;
      }

      const movedCaregiver = caregivers.splice(sourceIndex, 1)[0];

      const targetIndexAfterRemoval = caregivers.indexOf(targetCaregiverName);

      if (targetIndexAfterRemoval === -1) {
        caregivers.push(movedCaregiver);
      } else {
        caregivers.splice(targetIndexAfterRemoval, 0, movedCaregiver);
      }

      draggedCaregiverName = null;

      saveData();
      renderCaregiverList();
      renderSchedule();
    });

    caregiverCell.addEventListener("dragend", function () {
      draggedCaregiverName = null;

      document
        .querySelectorAll(".draggable-caregiver")
        .forEach(function (cell) {
          cell.classList.remove("is-dragging", "drag-over");
        });
    });
  });
}

/* main render */

function renderSchedule() {
  const activeShifts = getActiveShifts();

  const selectedView = scheduleViewSelect.value;

  let scheduleDays = [];

  if (selectedView === "monthly") {
    scheduleTitle.textContent = "Monthly Care Map";

    scheduleDays = getDaysInSelectedMonth();

    const selectedMonth = monthPicker.value || getTodayMonthValue();

    const [year, month] = selectedMonth.split("-").map(Number);

    weekLabel.textContent = new Date(year, month - 1).toLocaleDateString(
      "en-US",
      {
        month: "long",
        year: "numeric",
      },
    );

    renderMonthlySchedule(scheduleDays, activeShifts);
  } else {
    scheduleTitle.textContent =
      scheduleMode === "open" ? "Open Shifts" : "Weekly Care Map";

    scheduleDays = getDaysInSelectedWeek();

    weekLabel.textContent =
      `${scheduleDays[0].label} – ` +
      `${scheduleDays[scheduleDays.length - 1].label}`;

    renderWeeklySchedule(scheduleDays, activeShifts);
  }

  attachAssignmentListeners();

  renderCoverageSummary(scheduleDays, activeShifts);

  renderCoverageAssistant();
}

function attachAssignmentListeners() {
  document.querySelectorAll(".assignment-select").forEach(function (select) {
    select.addEventListener("change", function () {
      const assignmentKey = `${select.dataset.day}-${select.dataset.shift}`;

      scheduleAssignments[assignmentKey] = select.value;

      saveData();
      renderSchedule();
    });
  });
}

/* caregivers */

function getCaregiverRulesSummary(caregiverName) {
  const rules = getCaregiverRules(caregiverName);

  const summaryParts = [];

  if (rules.availableDays.length < allWeekDays.length) {
    summaryParts.push(`${rules.availableDays.length} available days`);
  }

  if (rules.allowedShifts.length > 0) {
    summaryParts.push(rules.allowedShifts.join(", "));
  }

  if (rules.maxConsecutiveDays > 0) {
    summaryParts.push(`max ${rules.maxConsecutiveDays} days in a row`);
  }

  if (rules.needsTwoConsecutiveDaysOff) {
    summaryParts.push("needs 2 days off");
  }

  return summaryParts.length > 0
    ? summaryParts.join(" · ")
    : "No special rules";
}

function renderCaregiverList() {
  caregiverList.innerHTML = "";

  caregivers.forEach(function (caregiverName, index) {
    const caregiverItem = document.createElement("li");

    caregiverItem.classList.add("caregiver-list-item");

    caregiverItem.innerHTML = `
  <div class="caregiver-card-identity">
    <div class="caregiver-card-avatar">
      ${caregiverName.charAt(0).toUpperCase()}
    </div>

    <div class="caregiver-list-copy">
      <strong>
        ${caregiverName}
      </strong>

      <span>
        Max ${caregiverMaxHours[caregiverName] || 50} hrs
      </span>

      <small>
        ${getCaregiverRulesSummary(caregiverName)}
      </small>
    </div>
  </div>


  <div class="caregiver-manage-wrapper">
    <button
      class="manage-caregiver-button"
      type="button"
      aria-expanded="false"
    >
      Manage
      <span>⌄</span>
    </button>

    <div class="caregiver-action-menu hidden">
      <button
        class="edit-caregiver-button"
        type="button"
      >
        Edit name
      </button>

      <button
        class="edit-max-hours-button"
        type="button"
      >
        Edit max hours
      </button>

      <button
        class="edit-rules-button"
        type="button"
      >
        Edit rules
      </button>

      <button
        class="remove-caregiver-button"
        type="button"
      >
        Remove caregiver
      </button>
    </div>
  </div>
`;

    const manageButton = caregiverItem.querySelector(
      ".manage-caregiver-button",
    );

    const actionMenu = caregiverItem.querySelector(".caregiver-action-menu");

    manageButton.addEventListener("click", function (event) {
      event.stopPropagation();

      document
        .querySelectorAll(".caregiver-action-menu")
        .forEach(function (otherMenu) {
          if (otherMenu !== actionMenu) {
            otherMenu.classList.add("hidden");
          }
        });

      document
        .querySelectorAll(".manage-caregiver-button")
        .forEach(function (otherButton) {
          if (otherButton !== manageButton) {
            otherButton.setAttribute("aria-expanded", "false");
          }
        });

      const isOpening = actionMenu.classList.contains("hidden");

      actionMenu.classList.toggle("hidden");

      manageButton.setAttribute("aria-expanded", String(isOpening));
    });

    actionMenu.addEventListener("click", function (event) {
      event.stopPropagation();
    });

    const editButton = caregiverItem.querySelector(".edit-caregiver-button");

    const editMaxHoursButton = caregiverItem.querySelector(
      ".edit-max-hours-button",
    );

    const editRulesButton = caregiverItem.querySelector(".edit-rules-button");

    const removeButton = caregiverItem.querySelector(
      ".remove-caregiver-button",
    );

    editButton.addEventListener("click", function () {
      const updatedName = prompt("Edit caregiver name:", caregiverName);

      if (updatedName === null) {
        return;
      }

      const trimmedName = updatedName.trim();

      if (trimmedName === "") {
        return;
      }

      const isDuplicate = caregivers.some(
        function (existingName, existingIndex) {
          return (
            existingIndex !== index &&
            existingName.toLowerCase() === trimmedName.toLowerCase()
          );
        },
      );

      if (isDuplicate) {
        alert("That caregiver name already exists.");

        return;
      }

      caregivers[index] = trimmedName;

      caregiverMaxHours[trimmedName] = caregiverMaxHours[caregiverName] || 50;

      caregiverRules[trimmedName] =
        caregiverRules[caregiverName] || getDefaultCaregiverRules();

      delete caregiverMaxHours[caregiverName];

      delete caregiverRules[caregiverName];

      Object.keys(scheduleAssignments).forEach(function (assignmentKey) {
        if (scheduleAssignments[assignmentKey] === caregiverName) {
          scheduleAssignments[assignmentKey] = trimmedName;
        }
      });

      saveData();
      renderCaregiverList();
      renderSchedule();
    });

    editMaxHoursButton.addEventListener("click", function () {
      const currentMaxHours = caregiverMaxHours[caregiverName] || 50;

      const updatedMaxHours = prompt(
        `Set max weekly hours for ${caregiverName}:`,
        currentMaxHours,
      );

      if (updatedMaxHours === null) {
        return;
      }

      const maxHoursNumber = Number(updatedMaxHours);

      if (!maxHoursNumber || maxHoursNumber <= 0) {
        alert("Please enter a valid number.");

        return;
      }

      caregiverMaxHours[caregiverName] = maxHoursNumber;

      saveData();
      renderCaregiverList();
      renderSchedule();
    });

    editRulesButton.addEventListener("click", function () {
      openCaregiverRulesModal(caregiverName);
    });

    removeButton.addEventListener("click", function () {
      if (!confirm(`Remove ${caregiverName}?`)) {
        return;
      }

      caregivers.splice(index, 1);

      delete caregiverMaxHours[caregiverName];

      delete caregiverRules[caregiverName];

      Object.keys(scheduleAssignments).forEach(function (assignmentKey) {
        if (scheduleAssignments[assignmentKey] === caregiverName) {
          scheduleAssignments[assignmentKey] = "Open";
        }
      });

      saveData();
      renderCaregiverList();
      renderSchedule();
    });

    caregiverList.append(caregiverItem);
  });
}

function addCaregiver() {
  const newCaregiverName = caregiverInput.value.trim();

  if (newCaregiverName === "") {
    return;
  }

  const isDuplicate = caregivers.some(function (caregiverName) {
    return caregiverName.toLowerCase() === newCaregiverName.toLowerCase();
  });

  if (isDuplicate) {
    caregiverInput.value = "";
    return;
  }

  caregivers.push(newCaregiverName);

  caregiverMaxHours[newCaregiverName] = 50;

  caregiverRules[newCaregiverName] = getDefaultCaregiverRules();

  caregiverInput.value = "";

  saveData();
  renderCaregiverList();
  renderSchedule();
}

/* shift settings */

function renderShiftList() {
  shiftList.innerHTML = "";

  customShifts.forEach(function (shiftName, index) {
    const shiftItem = document.createElement("li");

    shiftItem.classList.add("shift-list-item");

    shiftItem.innerHTML = `
        <span>
          ${shiftName}
        </span>

        <div class="shift-list-buttons">
          <button
            class="move-up-button"
            type="button"
          >
            ↑
          </button>

          <button
            class="move-down-button"
            type="button"
          >
            ↓
          </button>

          <button
            class="remove-shift-button"
            type="button"
          >
            Remove
          </button>
        </div>
      `;

    const moveUpButton = shiftItem.querySelector(".move-up-button");

    const moveDownButton = shiftItem.querySelector(".move-down-button");

    const removeButton = shiftItem.querySelector(".remove-shift-button");

    moveUpButton.addEventListener("click", function () {
      if (index === 0) {
        return;
      }

      [customShifts[index - 1], customShifts[index]] = [
        customShifts[index],
        customShifts[index - 1],
      ];

      saveData();
      renderShiftList();
      renderShiftTimeList();
      renderSchedule();
    });

    moveDownButton.addEventListener("click", function () {
      if (index === customShifts.length - 1) {
        return;
      }

      [customShifts[index], customShifts[index + 1]] = [
        customShifts[index + 1],
        customShifts[index],
      ];

      saveData();
      renderShiftList();
      renderShiftTimeList();
      renderSchedule();
    });

    removeButton.addEventListener("click", function () {
      const removedShiftName = customShifts[index];

      customShifts.splice(index, 1);

      delete shiftTimes[removedShiftName];

      Object.keys(scheduleAssignments).forEach(function (assignmentKey) {
        if (assignmentKey.endsWith(`-${removedShiftName}`)) {
          delete scheduleAssignments[assignmentKey];
        }
      });

      Object.keys(shiftTimeOverrides).forEach(function (overrideKey) {
        if (overrideKey.endsWith(`__${removedShiftName}`)) {
          delete shiftTimeOverrides[overrideKey];
        }
      });

      Object.keys(caregiverRules).forEach(function (caregiverName) {
        const rules = getCaregiverRules(caregiverName);

        caregiverRules[caregiverName] = {
          ...rules,

          allowedShifts: rules.allowedShifts.filter(function (allowedShift) {
            return allowedShift !== removedShiftName;
          }),
        };
      });

      saveData();
      renderShiftList();
      renderShiftTimeList();
      renderCaregiverList();
      renderSchedule();
    });

    shiftList.append(shiftItem);
  });
}

function updateCustomShiftVisibility() {
  customShiftSection.classList.toggle(
    "hidden",
    shiftStyleSelect.value !== "custom",
  );
}

function updatePickerVisibility() {
  const isMonthly = scheduleViewSelect.value === "monthly";

  monthPickerSection.classList.toggle("hidden", !isMonthly);

  weekPickerSection.classList.toggle("hidden", isMonthly);
}

function renderShiftTimeList() {
  shiftTimeList.innerHTML = "";

  const activeShifts = getActiveShifts();

  activeShifts.forEach(function (shift) {
    const shiftTimeRow = document.createElement("div");

    shiftTimeRow.classList.add("clean-shift-time-row");

    shiftTimeRow.innerHTML = `
        <div>
          <strong>
            ${shift.name}
          </strong>

          <span class="clean-shift-time-text">
            ${formatTime(shift.start)}
            –
            ${formatTime(shift.end)}
            ·
            ${formatHours(getShiftHours(shift))}
          </span>
        </div>

        <button
          class="edit-default-time-button"
          type="button"
          data-shift="${shift.name}"
        >
          Edit default
        </button>
      `;

    shiftTimeList.append(shiftTimeRow);
  });

  document
    .querySelectorAll(".edit-default-time-button")
    .forEach(function (button) {
      button.addEventListener("click", function () {
        const shift = activeShifts.find(function (activeShift) {
          return activeShift.name === button.dataset.shift;
        });

        if (shift) {
          editDefaultShiftTime(shift);
        }
      });
    });
}

/* time modal */

function fillPrettyTimeSelects() {
  const hourSelects = [editStartHourSelect, editEndHourSelect];

  const minuteSelects = [editStartMinuteSelect, editEndMinuteSelect];

  hourSelects.forEach(function (select) {
    select.innerHTML = "";

    for (let hour = 1; hour <= 12; hour += 1) {
      const option = document.createElement("option");

      option.value = String(hour).padStart(2, "0");

      option.textContent = String(hour).padStart(2, "0");

      select.append(option);
    }
  });

  minuteSelects.forEach(function (select) {
    select.innerHTML = "";

    for (let minute = 0; minute < 60; minute += 1) {
      const option = document.createElement("option");

      option.value = String(minute).padStart(2, "0");

      option.textContent = String(minute).padStart(2, "0");

      select.append(option);
    }
  });
}

function convert24HourToPrettyTime(timeValue) {
  const [hourText, minute] = timeValue.split(":");

  let hour = Number(hourText);

  const period = hour >= 12 ? "PM" : "AM";

  hour %= 12;

  if (hour === 0) {
    hour = 12;
  }

  return {
    hour: String(hour).padStart(2, "0"),

    minute,
    period,
  };
}

function convertPrettyTimeTo24Hour(hourValue, minuteValue, periodValue) {
  let hour = Number(hourValue);

  if (periodValue === "AM" && hour === 12) {
    hour = 0;
  }

  if (periodValue === "PM" && hour !== 12) {
    hour += 12;
  }

  return `${String(hour).padStart(2, "0")}:${minuteValue}`;
}

function setPrettyStartTime(timeValue) {
  const prettyTime = convert24HourToPrettyTime(timeValue);

  editStartHourSelect.value = prettyTime.hour;

  editStartMinuteSelect.value = prettyTime.minute;

  editStartPeriodSelect.value = prettyTime.period;
}

function setPrettyEndTime(timeValue) {
  const prettyTime = convert24HourToPrettyTime(timeValue);

  editEndHourSelect.value = prettyTime.hour;

  editEndMinuteSelect.value = prettyTime.minute;

  editEndPeriodSelect.value = prettyTime.period;
}

function getPrettyStartTime() {
  return convertPrettyTimeTo24Hour(
    editStartHourSelect.value,
    editStartMinuteSelect.value,
    editStartPeriodSelect.value,
  );
}

function getPrettyEndTime() {
  return convertPrettyTimeTo24Hour(
    editEndHourSelect.value,
    editEndMinuteSelect.value,
    editEndPeriodSelect.value,
  );
}

function editDefaultShiftTime(shift) {
  activeTimeEdit = {
    mode: "default",
    dayKey: "",
    shift,
  };

  editTimeTitle.textContent = `Edit ${shift.name}`;

  editTimeSubtitle.textContent =
    `This changes ${shift.name} everywhere unless ` +
    `a date has a custom time.`;

  setPrettyStartTime(shift.start);

  setPrettyEndTime(shift.end);

  editTimeModal.classList.remove("hidden");
}

function closeEditTimeModal() {
  editTimeModal.classList.add("hidden");

  activeTimeEdit = {
    mode: "date",
    dayKey: "",
    shift: null,
  };
}

function isValidTimeValue(timeValue) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue);
}

function saveEditedShiftTime() {
  if (!activeTimeEdit.shift) {
    return;
  }

  const newStart = getPrettyStartTime();

  const newEnd = getPrettyEndTime();

  if (!isValidTimeValue(newStart) || !isValidTimeValue(newEnd)) {
    alert("Please choose a valid start and end time.");

    return;
  }

  const shiftName = activeTimeEdit.shift.name;

  shiftTimes[shiftName] = {
    start: newStart,
    end: newEnd,
  };

  saveData();
  closeEditTimeModal();
  renderShiftTimeList();
  renderSchedule();
}

/* copy, paste and clear */

function copySelectedWeek() {
  if (scheduleViewSelect.value !== "weekly") {
    alert("Switch to Weekly view before copying a week.");

    return;
  }

  const weekDays = getDaysInSelectedWeek();

  const activeShifts = getActiveShifts();

  copiedWeekAssignments = [];

  weekDays.forEach(function (day, dayIndex) {
    activeShifts.forEach(function (shift) {
      const assignmentKey = `${day.key}-${shift.name}`;

      copiedWeekAssignments.push({
        dayIndex,

        shiftName: shift.name,

        caregiver: scheduleAssignments[assignmentKey] || "Open",
      });
    });
  });

  alert("This week has been copied.");
}

function pasteCopiedWeek() {
  if (scheduleViewSelect.value !== "weekly") {
    alert("Switch to Weekly view before pasting a week.");

    return;
  }

  if (!copiedWeekAssignments) {
    alert("Copy a week first.");

    return;
  }

  const weekDays = getDaysInSelectedWeek();

  copiedWeekAssignments.forEach(function (copiedShift) {
    const targetDay = weekDays[copiedShift.dayIndex];

    if (!targetDay) {
      return;
    }

    scheduleAssignments[`${targetDay.key}-${copiedShift.shiftName}`] =
      copiedShift.caregiver;
  });

  saveData();
  renderSchedule();

  alert("Copied week pasted to the selected week.");
}

function clearSelectedWeek() {
  if (scheduleViewSelect.value !== "weekly") {
    alert("Switch to Weekly view before clearing a week.");

    return;
  }

  if (!confirm("Clear only this selected week?")) {
    return;
  }

  const weekDays = getDaysInSelectedWeek();

  const activeShifts = getActiveShifts();

  weekDays.forEach(function (day) {
    activeShifts.forEach(function (shift) {
      delete scheduleAssignments[`${day.key}-${shift.name}`];
    });
  });

  saveData();
  renderSchedule();

  alert("This week has been cleared.");
}

function clearSelectedMonth() {
  if (scheduleViewSelect.value !== "monthly") {
    alert("Switch to Monthly view before clearing a month.");

    return;
  }

  if (!confirm("Clear only this selected month?")) {
    return;
  }

  const monthDays = getDaysInSelectedMonth();

  const activeShifts = getActiveShifts();

  monthDays.forEach(function (day) {
    activeShifts.forEach(function (shift) {
      delete scheduleAssignments[`${day.key}-${shift.name}`];
    });
  });

  saveData();
  renderSchedule();

  alert("This month has been cleared.");
}

/* open-shift card */

function updateAvailableShiftsMinimizedState() {
  if (!availableShiftsToast || !minimizeAvailableShiftsButton) {
    return;
  }

  const isMinimized =
    localStorage.getItem("curavelaAvailableShiftsMinimized") === "true";

  availableShiftsToast.classList.toggle("is-minimized", isMinimized);

  minimizeAvailableShiftsButton.textContent = isMinimized ? "+" : "−";
}

function startAvailableShiftsAutoScroll() {
  clearInterval(availableShiftsScrollInterval);

  if (!availableShiftsBody) {
    return;
  }

  availableShiftsBody.scrollTop = 0;

  availableShiftsScrollInterval = setInterval(function () {
    const maxScroll =
      availableShiftsBody.scrollHeight - availableShiftsBody.clientHeight;

    if (maxScroll <= 0) {
      return;
    }

    if (availableShiftsBody.scrollTop >= maxScroll) {
      availableShiftsBody.scrollTop = 0;
    } else {
      availableShiftsBody.scrollTop += 1;
    }
  }, 90);
}

/* navigation */

function setAppView(viewName) {
  const dashboardPanels = [
    caregiverPanel,
    hoursPanel,
    openShiftsPanel,
    warningsPanel,
    reportsPanel,
    settingsPanel,
  ];

  dashboardPanels.forEach(function (panel) {
    if (panel) {
      panel.classList.add("app-view-hidden");
    }
  });

  heroSection.classList.add("app-view-hidden");

  statsStrip.classList.add("app-view-hidden");

  scheduleArea.classList.add("app-view-hidden");

  if (coverageArea) {
    coverageArea.classList.add("app-view-hidden");
  }

  dashboardGrid.classList.add("app-view-hidden");

  dashboardGrid.classList.remove("single-panel-view");

  if (viewName === "schedule") {
    heroSection.classList.remove("app-view-hidden");

    statsStrip.classList.remove("app-view-hidden");

    scheduleArea.classList.remove("app-view-hidden");
  }

  if (viewName === "open-shifts") {
    if (coverageArea) {
      coverageArea.classList.remove("app-view-hidden");
    }

    renderCoverageAssistant();
  }

  if (viewName === "caregivers") {
    dashboardGrid.classList.remove("app-view-hidden");

    caregiverPanel.classList.remove("app-view-hidden");

    hoursPanel.classList.remove("app-view-hidden");
  }

  if (viewName === "reports") {
    dashboardGrid.classList.remove("app-view-hidden");

    dashboardGrid.classList.add("single-panel-view");

    reportsPanel.classList.remove("app-view-hidden");
  }

  if (viewName === "settings") {
    dashboardGrid.classList.remove("app-view-hidden");

    dashboardGrid.classList.add("single-panel-view");

    settingsPanel.classList.remove("app-view-hidden");
  }

  if (availableShiftsToast) {
    availableShiftsToast.classList.toggle(
      "app-view-hidden",
      viewName === "open-shifts",
    );
  }

  sideNavLinks.forEach(function (link) {
    link.classList.toggle("active", link.dataset.view === viewName);
  });

  if (mainContent) {
    mainContent.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }
}

function closeDatePopovers() {
  if (weekDatePopover) {
    weekDatePopover.classList.add("hidden");
  }

  if (monthDatePopover) {
    monthDatePopover.classList.add("hidden");
  }

  if (selectedWeekDisplayButton) {
    selectedWeekDisplayButton.setAttribute("aria-expanded", "false");
  }

  if (selectedMonthDisplayButton) {
    selectedMonthDisplayButton.setAttribute("aria-expanded", "false");
  }
}

function toggleDatePopover(popover, button) {
  if (!popover || !button) {
    return;
  }

  const shouldOpen = popover.classList.contains("hidden");

  closeDatePopovers();

  if (shouldOpen) {
    popover.classList.remove("hidden");

    button.setAttribute("aria-expanded", "true");
  }
}

/* event listeners */

addShiftButton.addEventListener("click", function () {
  const newShiftName = customShiftInput.value.trim();

  if (newShiftName === "") {
    return;
  }

  const isDuplicate = customShifts.some(function (shiftName) {
    return shiftName.toLowerCase() === newShiftName.toLowerCase();
  });

  if (isDuplicate) {
    customShiftInput.value = "";

    return;
  }

  customShifts.push(newShiftName);

  shiftTimes[newShiftName] = {
    start: "09:00",
    end: "17:00",
  };

  customShiftInput.value = "";

  saveData();
  renderShiftList();
  renderShiftTimeList();
  renderSchedule();
});

customShiftInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();

    addShiftButton.click();
  }
});

addCaregiverButton.addEventListener("click", addCaregiver);

caregiverInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();

    addCaregiver();
  }
});

previousWeekButton.addEventListener("click", function () {
  changeSelectedWeekByDays(-7);
});

nextWeekButton.addEventListener("click", function () {
  changeSelectedWeekByDays(7);
});

todayWeekButton.addEventListener("click", function () {
  weekStartDateInput.value = getTodayDateValue();

  saveData();
  updateWeekDisplay();
  renderSchedule();
});

weekStartSelect.addEventListener("change", function () {
  saveData();
  updateWeekDisplay();
  renderSchedule();
});

shiftStyleSelect.addEventListener("change", function () {
  updateCustomShiftVisibility();
  renderShiftTimeList();
  renderCaregiverList();
  saveData();
  renderSchedule();
});

scheduleViewSelect.addEventListener("change", function () {
  updatePickerVisibility();
  saveData();
  renderSchedule();
});

monthPicker.addEventListener("change", function () {
  saveData();
  renderSchedule();
});

weekStartDateInput.addEventListener("change", function () {
  saveData();
  updateWeekDisplay();
  renderSchedule();
});

scheduleNoteInput.addEventListener("input", function () {
  scheduleNote = scheduleNoteInput.value;

  saveData();
});

clearScheduleButton.addEventListener("click", function () {
  if (confirm("Are you sure you want to clear the full schedule?")) {
    scheduleAssignments = {};

    saveData();
    renderSchedule();
  }
});

exportDataButton.addEventListener("click", exportCuravelaData);

importDataButton.addEventListener("click", function () {
  importDataInput.click();
});

importDataInput.addEventListener("change", function () {
  const file = importDataInput.files[0];

  if (!file) {
    return;
  }

  importCuravelaData(file);

  importDataInput.value = "";
});

printScheduleButton.addEventListener("click", function () {
  window.print();
});

copyWeekButton.addEventListener("click", copySelectedWeek);

pasteWeekButton.addEventListener("click", pasteCopiedWeek);

clearWeekButton.addEventListener("click", clearSelectedWeek);

clearMonthButton.addEventListener("click", clearSelectedMonth);

previousMonthButton.addEventListener("click", function () {
  changeSelectedMonthByMonths(-1);
});

nextMonthButton.addEventListener("click", function () {
  changeSelectedMonthByMonths(1);
});

currentMonthButton.addEventListener("click", function () {
  monthPicker.value = getTodayMonthValue();

  saveData();
  updateMonthDisplay();
  renderSchedule();
});

if (minimizeAvailableShiftsButton && availableShiftsToast) {
  minimizeAvailableShiftsButton.addEventListener("click", function () {
    const isCurrentlyMinimized =
      availableShiftsToast.classList.contains("is-minimized");

    localStorage.setItem(
      "curavelaAvailableShiftsMinimized",
      String(!isCurrentlyMinimized),
    );

    updateAvailableShiftsMinimizedState();
  });
}

if (moreActionsButton && moreActionsMenu) {
  moreActionsButton.addEventListener("click", function (event) {
    event.stopPropagation();

    moreActionsMenu.classList.toggle("hidden");
  });

  moreActionsMenu.addEventListener("click", function (event) {
    event.stopPropagation();
  });

  document.addEventListener("click", function (event) {
    if (!event.target.closest(".more-actions")) {
      moreActionsMenu.classList.add("hidden");
    }
  });
}

if (quickAddShiftButton) {
  quickAddShiftButton.addEventListener("click", function () {
    setAppView("settings");

    shiftStyleSelect.value = "custom";

    updateCustomShiftVisibility();
    renderShiftTimeList();
    saveData();
    renderSchedule();

    setTimeout(function () {
      customShiftInput.focus();
    }, 250);
  });
}

closeEditTimeButton.addEventListener("click", closeEditTimeModal);

cancelEditTimeButton.addEventListener("click", closeEditTimeModal);

saveEditTimeButton.addEventListener("click", saveEditedShiftTime);

editTimeModal.addEventListener("click", function (event) {
  if (event.target === editTimeModal) {
    closeEditTimeModal();
  }
});

if (
  closeCaregiverRulesButton &&
  cancelCaregiverRulesButton &&
  saveCaregiverRulesButton &&
  caregiverRulesModal
) {
  closeCaregiverRulesButton.addEventListener("click", closeCaregiverRulesModal);

  cancelCaregiverRulesButton.addEventListener(
    "click",
    closeCaregiverRulesModal,
  );

  saveCaregiverRulesButton.addEventListener("click", saveActiveCaregiverRules);

  caregiverRulesModal.addEventListener("click", function (event) {
    if (event.target === caregiverRulesModal) {
      closeCaregiverRulesModal();
    }
  });
}

document.addEventListener("click", function (event) {
  if (event.target.closest(".caregiver-manage-wrapper")) {
    return;
  }

  document.querySelectorAll(".caregiver-action-menu").forEach(function (menu) {
    menu.classList.add("hidden");
  });

  document
    .querySelectorAll(".manage-caregiver-button")
    .forEach(function (button) {
      button.setAttribute("aria-expanded", "false");
    });
});

document.addEventListener("keydown", function (event) {
  if (event.key !== "Escape") {
    return;
  }

  closeDatePopovers();

  if (!editTimeModal.classList.contains("hidden")) {
    closeEditTimeModal();
  }

  if (
    caregiverRulesModal &&
    !caregiverRulesModal.classList.contains("hidden")
  ) {
    closeCaregiverRulesModal();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key !== "Escape") {
    return;
  }

  closeDatePopovers();

  if (!editTimeModal.classList.contains("hidden")) {
    closeEditTimeModal();
  }

  if (
    caregiverRulesModal &&
    !caregiverRulesModal.classList.contains("hidden")
  ) {
    closeCaregiverRulesModal();
  }
});

if (coveragePreviousWeekButton) {
  coveragePreviousWeekButton.addEventListener("click", function () {
    changeSelectedWeekByDays(-7);
  });
}

if (coverageNextWeekButton) {
  coverageNextWeekButton.addEventListener("click", function () {
    changeSelectedWeekByDays(7);
  });
}

if (coverageTodayButton) {
  coverageTodayButton.addEventListener("click", function () {
    weekStartDateInput.value = getTodayDateValue();

    saveData();
    updateWeekDisplay();
    renderSchedule();
  });
}

if (coverageOnlyNoMatch) {
  coverageOnlyNoMatch.addEventListener("change", function () {
    renderCoverageAssistant();
  });
}

if (selectedWeekDisplayButton && weekDatePopover) {
  selectedWeekDisplayButton.addEventListener("click", function (event) {
    event.stopPropagation();

    toggleDatePopover(weekDatePopover, selectedWeekDisplayButton);
  });

  weekDatePopover.addEventListener("click", function (event) {
    event.stopPropagation();
  });
}

if (selectedMonthDisplayButton && monthDatePopover) {
  selectedMonthDisplayButton.addEventListener("click", function (event) {
    event.stopPropagation();

    toggleDatePopover(monthDatePopover, selectedMonthDisplayButton);
  });

  monthDatePopover.addEventListener("click", function (event) {
    event.stopPropagation();
  });
}

if (weekPickerTodayButton) {
  weekPickerTodayButton.addEventListener("click", function () {
    weekStartDateInput.value = getTodayDateValue();

    saveData();
    updateWeekDisplay();
    renderSchedule();
    closeDatePopovers();
  });
}

if (weekPickerNextButton) {
  weekPickerNextButton.addEventListener("click", function () {
    changeSelectedWeekByDays(7);
    closeDatePopovers();
  });
}

if (monthPickerCurrentButton) {
  monthPickerCurrentButton.addEventListener("click", function () {
    monthPicker.value = getTodayMonthValue();

    saveData();
    updateMonthDisplay();
    renderSchedule();
    closeDatePopovers();
  });
}

if (monthPickerNextButton) {
  monthPickerNextButton.addEventListener("click", function () {
    changeSelectedMonthByMonths(1);
    closeDatePopovers();
  });
}

weekStartDateInput.addEventListener("change", function () {
  closeDatePopovers();
});

monthPicker.addEventListener("change", function () {
  updateMonthDisplay();
  closeDatePopovers();
});

document.addEventListener("click", function () {
  closeDatePopovers();
});

sideNavLinks.forEach(function (link) {
  link.addEventListener("click", function (event) {
    event.preventDefault();

    setAppView(link.dataset.view);
  });
});

/* initialize */

fillPrettyTimeSelects();
loadData();

if (monthPicker.value === "") {
  monthPicker.value = getTodayMonthValue();
}

if (weekStartDateInput.value === "") {
  weekStartDateInput.value = getTodayDateValue();
}

scheduleNoteInput.value = scheduleNote;

updateCustomShiftVisibility();
updatePickerVisibility();
updateAvailableShiftsMinimizedState();
renderShiftList();
renderCaregiverList();
renderShiftTimeList();
renderSchedule();
updateWeekDisplay();
updateMonthDisplay();
setAppView("schedule");
