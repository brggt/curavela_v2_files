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

const scheduleNoteInput = document.querySelector("#schedule-note");
const clearScheduleButton = document.querySelector("#clear-schedule-button");

const exportDataButton = document.querySelector("#export-data-button");
const importDataButton = document.querySelector("#import-data-button");
const importDataInput = document.querySelector("#import-data-input");

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

const totalHoursNeededElement = document.querySelector("#total-hours-needed");
const totalHoursCoveredElement = document.querySelector("#total-hours-covered");
const openHoursElement = document.querySelector("#open-hours");
const openShiftsCountElement = document.querySelector("#open-shifts-count");
const caregiverHoursList = document.querySelector("#caregiver-hours-list");
const availableShiftsList = document.querySelector("#available-shifts-list");

const coveragePercentElement = document.querySelector("#coverage-percent");
const coverageProgressFill = document.querySelector("#coverage-progress-fill");
const warningCountElement = document.querySelector("#warning-count");
const scheduleWarningsList = document.querySelector("#schedule-warnings-list");

const toastOpenShiftsCount = document.querySelector("#toast-open-shifts-count");
const availableShiftsBody = document.querySelector(".available-shifts-body");
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

const quickAddShiftButton = document.querySelector(
  "#quick-add-shift-button",
);

const moreActionsButton = document.querySelector(
  "#more-actions-button",
);

const moreActionsMenu = document.querySelector(
  "#more-actions-menu",
);

let availableShiftsScrollInterval;

function getSavedItem(newKey, oldKey) {
  return localStorage.getItem(newKey) || localStorage.getItem(oldKey);
}

function saveData() {
  localStorage.setItem(
    "curavelaCustomShifts",
    JSON.stringify(customShifts),
  );

  localStorage.setItem(
    "curavelaCaregivers",
    JSON.stringify(caregivers),
  );

  localStorage.setItem(
    "curavelaCaregiverMaxHours",
    JSON.stringify(caregiverMaxHours),
  );

  localStorage.setItem(
    "curavelaAssignments",
    JSON.stringify(scheduleAssignments),
  );

  localStorage.setItem(
    "curavelaScheduleNote",
    scheduleNote,
  );

  localStorage.setItem(
    "curavelaShiftTimes",
    JSON.stringify(shiftTimes),
  );

  localStorage.setItem(
    "curavelaShiftTimeOverrides",
    JSON.stringify(shiftTimeOverrides),
  );

  localStorage.setItem(
    "curavelaScheduleView",
    scheduleViewSelect.value,
  );

  localStorage.setItem(
    "curavelaShiftStyle",
    shiftStyleSelect.value,
  );

  localStorage.setItem(
    "curavelaWeekStart",
    weekStartSelect.value,
  );

  localStorage.setItem(
    "curavelaMonth",
    monthPicker.value,
  );

  localStorage.setItem(
    "curavelaWeekStartDate",
    weekStartDateInput.value,
  );
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
    caregiverMaxHours = JSON.parse(
      savedCaregiverMaxHours,
    );
  }

  if (savedAssignments) {
    scheduleAssignments = JSON.parse(
      savedAssignments,
    );
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
    shiftTimeOverrides = JSON.parse(
      savedShiftTimeOverrides,
    );
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

  const savedMonth = getSavedItem(
    "curavelaMonth",
    "kindshiftMonth",
  );

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
    version: 2,
    exportedAt: new Date().toISOString(),
    customShifts,
    caregivers,
    caregiverMaxHours,
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

  const backupText = JSON.stringify(
    backupData,
    null,
    2,
  );

  const backupBlob = new Blob(
    [backupText],
    {
      type: "application/json",
    },
  );

  const backupUrl = URL.createObjectURL(
    backupBlob,
  );

  const downloadLink =
    document.createElement("a");

  downloadLink.href = backupUrl;
  downloadLink.download =
    "curavela-backup.json";

  downloadLink.click();

  URL.revokeObjectURL(backupUrl);
}

function importCuravelaData(file) {
  const reader = new FileReader();

  reader.addEventListener(
    "load",
    function () {
      try {
        const backupData = JSON.parse(
          reader.result,
        );

        customShifts =
          backupData.customShifts ||
          customShifts;

        caregivers =
          backupData.caregivers ||
          caregivers;

        caregiverMaxHours =
          backupData.caregiverMaxHours ||
          caregiverMaxHours;

        scheduleAssignments =
          backupData.scheduleAssignments ||
          {};

        scheduleNote =
          backupData.scheduleNote ||
          "";

        shiftTimes = {
          ...shiftTimes,
          ...(backupData.shiftTimes || {}),
        };

        shiftTimeOverrides =
          backupData.shiftTimeOverrides ||
          {};

        if (backupData.scheduleView) {
          scheduleViewSelect.value =
            backupData.scheduleView;
        }

        if (backupData.shiftStyle) {
          shiftStyleSelect.value =
            backupData.shiftStyle;
        }

        if (backupData.weekStart) {
          weekStartSelect.value =
            backupData.weekStart;
        }

        if (backupData.month) {
          monthPicker.value =
            backupData.month;
        }

        if (backupData.weekStartDate) {
          weekStartDateInput.value =
            backupData.weekStartDate;
        }

        scheduleNoteInput.value =
          scheduleNote;

        saveData();
        updateCustomShiftVisibility();
        updatePickerVisibility();
        renderShiftList();
        renderCaregiverList();
        renderShiftTimeList();
        renderSchedule();

        alert(
          "Backup imported successfully.",
        );
      } catch (error) {
        alert(
          "That backup file could not be imported.",
        );
      }
    },
  );

  reader.readAsText(file);
}

function getTodayDateValue() {
  const today = new Date();

  const year = today.getFullYear();

  const month = String(
    today.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    today.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayMonthValue() {
  const today = new Date();

  const year = today.getFullYear();

  const month = String(
    today.getMonth() + 1,
  ).padStart(2, "0");

  return `${year}-${month}`;
}

function getDateKey(date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getAppDayIndex(date) {
  const jsDayIndex = date.getDay();

  if (jsDayIndex === 0) {
    return 6;
  }

  return jsDayIndex - 1;
}

function getOrderedWeekDays() {
  const startIndex =
    allWeekDays.indexOf(
      weekStartSelect.value,
    );

  const firstPart =
    allWeekDays.slice(startIndex);

  const secondPart =
    allWeekDays.slice(0, startIndex);

  return firstPart.concat(secondPart);
}

function getDaysInSelectedWeek() {
  const selectedDate =
    weekStartDateInput.value ||
    getTodayDateValue();

  const [year, month, day] =
    selectedDate
      .split("-")
      .map(Number);

  const chosenDate = new Date(
    year,
    month - 1,
    day,
  );

  const selectedStartDayIndex =
    allWeekDays.indexOf(
      weekStartSelect.value,
    );

  const chosenDayIndex =
    getAppDayIndex(chosenDate);

  let daysToSubtract =
    chosenDayIndex -
    selectedStartDayIndex;

  if (daysToSubtract < 0) {
    daysToSubtract += 7;
  }

  const startDate =
    new Date(chosenDate);

  startDate.setDate(
    chosenDate.getDate() -
      daysToSubtract,
  );

  const days = [];

  for (let i = 0; i < 7; i++) {
    const currentDate =
      new Date(startDate);

    currentDate.setDate(
      startDate.getDate() + i,
    );

    days.push({
      label:
        currentDate.toLocaleDateString(
          "en-US",
          {
            weekday: "long",
            month: "short",
            day: "numeric",
          },
        ),

      shortLabel:
        currentDate.toLocaleDateString(
          "en-US",
          {
            weekday: "short",
          },
        ),

      dateLabel:
        currentDate.toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
          },
        ),

      key: getDateKey(currentDate),
      date: currentDate,
    });
  }

  return days;
}

function getDaysInSelectedMonth() {
  const selectedMonth =
    monthPicker.value ||
    getTodayMonthValue();

  const [year, month] =
    selectedMonth
      .split("-")
      .map(Number);

  const days = [];

  const lastDayOfMonth =
    new Date(year, month, 0).getDate();

  for (
    let dayNumber = 1;
    dayNumber <= lastDayOfMonth;
    dayNumber++
  ) {
    const date = new Date(
      year,
      month - 1,
      dayNumber,
    );

    days.push({
      label:
        date.toLocaleDateString(
          "en-US",
          {
            weekday: "long",
            month: "short",
            day: "numeric",
          },
        ),

      key: getDateKey(date),
      date,
    });
  }

  return days;
}

function changeSelectedWeekByDays(
  dayAmount,
) {
  const currentValue =
    weekStartDateInput.value ||
    getTodayDateValue();

  const [year, month, day] =
    currentValue
      .split("-")
      .map(Number);

  const currentDate = new Date(
    year,
    month - 1,
    day,
  );

  currentDate.setDate(
    currentDate.getDate() +
      dayAmount,
  );

  weekStartDateInput.value =
    getDateKey(currentDate);

  saveData();
  updateWeekDisplay();
  renderSchedule();
}

function updateWeekDisplay() {
  if (!selectedWeekDisplay) {
    return;
  }

  const days =
    getDaysInSelectedWeek();

  const firstDay =
    days[0].dateLabel;

  const lastDay =
    days[
      days.length - 1
    ].dateLabel;

  selectedWeekDisplay.textContent =
    `${firstDay} – ${lastDay}`;
}

function updateMonthDisplay() {
  if (!selectedMonthDisplay) {
    return;
  }

  const selectedMonth =
    monthPicker.value ||
    getTodayMonthValue();

  const [year, month] =
    selectedMonth
      .split("-")
      .map(Number);

  selectedMonthDisplay.textContent =
    new Date(
      year,
      month - 1,
    ).toLocaleDateString(
      "en-US",
      {
        month: "long",
        year: "numeric",
      },
    );
}

function changeSelectedMonthByMonths(
  monthAmount,
) {
  const currentValue =
    monthPicker.value ||
    getTodayMonthValue();

  const [year, month] =
    currentValue
      .split("-")
      .map(Number);

  const currentDate = new Date(
    year,
    month - 1,
    1,
  );

  currentDate.setMonth(
    currentDate.getMonth() +
      monthAmount,
  );

  const newYear =
    currentDate.getFullYear();

  const newMonth = String(
    currentDate.getMonth() + 1,
  ).padStart(2, "0");

  monthPicker.value =
    `${newYear}-${newMonth}`;

  saveData();
  updateMonthDisplay();
  renderSchedule();
}

function getShiftConfig(
  shiftName,
  defaultStart,
  defaultEnd,
) {
  if (!shiftTimes[shiftName]) {
    shiftTimes[shiftName] = {
      start: defaultStart,
      end: defaultEnd,
    };
  }

  return {
    name: shiftName,
    start:
      shiftTimes[shiftName].start,
    end:
      shiftTimes[shiftName].end,
  };
}

function getActiveShifts() {
  const selectedShiftStyle =
    shiftStyleSelect.value;

  if (
    selectedShiftStyle === "one"
  ) {
    return [
      getShiftConfig(
        "Full Day",
        "00:00",
        "00:00",
      ),
    ];
  }

  if (
    selectedShiftStyle === "two"
  ) {
    return [
      getShiftConfig(
        "Day",
        "07:00",
        "19:00",
      ),

      getShiftConfig(
        "Night",
        "19:00",
        "07:00",
      ),
    ];
  }

  if (
    selectedShiftStyle === "three"
  ) {
    return [
      getShiftConfig(
        "Morning",
        "06:30",
        "13:00",
      ),

      getShiftConfig(
        "Afternoon",
        "13:00",
        "19:00",
      ),

      getShiftConfig(
        "Night",
        "19:00",
        "07:00",
      ),
    ];
  }

  return customShifts.map(
    function (shiftName) {
      return getShiftConfig(
        shiftName,
        "09:00",
        "17:00",
      );
    },
  );
}

function getShiftOverrideKey(
  dayKey,
  shiftName,
) {
  return `${dayKey}__${shiftName}`;
}

function getShiftForDay(
  dayKey,
  shift,
) {
  const overrideKey =
    getShiftOverrideKey(
      dayKey,
      shift.name,
    );

  const override =
    shiftTimeOverrides[
      overrideKey
    ];

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
  const [
    hourText,
    minuteText,
  ] = timeValue.split(":");

  const hour = Number(hourText);
  const minute = minuteText;

  const period =
    hour >= 12 ? "PM" : "AM";

  const displayHour =
    hour % 12 === 0
      ? 12
      : hour % 12;

  return `${displayHour}:${minute} ${period}`;
}

function getShiftHours(shift) {
  const [
    startHour,
    startMinute,
  ] = shift.start
    .split(":")
    .map(Number);

  const [
    endHour,
    endMinute,
  ] = shift.end
    .split(":")
    .map(Number);

  const startMinutes =
    startHour * 60 +
    startMinute;

  let endMinutes =
    endHour * 60 +
    endMinute;

  if (
    endMinutes <= startMinutes
  ) {
    endMinutes += 24 * 60;
  }

  const totalMinutes =
    endMinutes - startMinutes;

  return totalMinutes / 60;
}

function formatHours(hours) {
  if (Number.isInteger(hours)) {
    return `${hours} hrs`;
  }

  return `${hours.toFixed(1)} hrs`;
}

function buildCaregiverOptions(
  assignedCaregiver,
) {
  let caregiverOptions =
    `<option value="Open">Open</option>`;

  caregivers.forEach(
    function (caregiverName) {
      const selected =
        caregiverName ===
        assignedCaregiver
          ? "selected"
          : "";

      caregiverOptions += `
        <option
          value="${caregiverName}"
          ${selected}
        >
          ${caregiverName}
        </option>
      `;
    },
  );

  return caregiverOptions;
}

function getCaregiverHoursForDays(
  scheduleDays,
  activeShifts,
) {
  const caregiverHours = {};

  caregivers.forEach(
    function (caregiverName) {
      caregiverHours[
        caregiverName
      ] = 0;
    },
  );

  scheduleDays.forEach(
    function (day) {
      activeShifts.forEach(
        function (shift) {
          const shiftForDay =
            getShiftForDay(
              day.key,
              shift,
            );

          const shiftHours =
            getShiftHours(
              shiftForDay,
            );

          const assignmentKey =
            `${day.key}-${shift.name}`;

          const assignedCaregiver =
            scheduleAssignments[
              assignmentKey
            ] || "Open";

          if (
            assignedCaregiver !==
            "Open"
          ) {
            if (
              !caregiverHours[
                assignedCaregiver
              ]
            ) {
              caregiverHours[
                assignedCaregiver
              ] = 0;
            }

            caregiverHours[
              assignedCaregiver
            ] += shiftHours;
          }
        },
      );
    },
  );

  return caregiverHours;
}

function renderWeeklySchedule(
  scheduleDays,
  activeShifts,
) {
  scheduleSection.className = "";
  scheduleSection.innerHTML = "";

  if (caregivers.length === 0) {
    scheduleSection.innerHTML = `
      <div class="empty-state">
        Add caregivers to start
        building the care map.
      </div>
    `;

    return;
  }

  const caregiverHours =
    getCaregiverHoursForDays(
      scheduleDays,
      activeShifts,
    );

  const careMapGrid =
    document.createElement("div");

  careMapGrid.classList.add(
    "care-map-grid",
  );

  careMapGrid.style.setProperty(
    "--day-count",
    scheduleDays.length,
  );

  careMapGrid.innerHTML = `
    <div
      class="
        care-map-cell
        care-map-header
        caregiver-cell
      "
    >
      <strong>Caregiver</strong>
    </div>
  `;

  scheduleDays.forEach(
    function (day) {
      const dayHeader =
        document.createElement("div");

      dayHeader.classList.add(
        "care-map-cell",
        "care-map-header",
      );

      dayHeader.innerHTML = `
        <strong>
          ${day.shortLabel}
        </strong>

        <span>
          ${day.dateLabel}
        </span>
      `;

      careMapGrid.append(
        dayHeader,
      );
    },
  );

  caregivers.forEach(
    function (caregiverName) {
      const caregiverCell =
        document.createElement("div");

      caregiverCell.classList.add(
        "care-map-cell",
        "caregiver-cell",
        "draggable-caregiver",
      );

      caregiverCell.draggable = true;

      caregiverCell.dataset.caregiver =
        caregiverName;

      caregiverCell.innerHTML = `
        <span
          class="caregiver-drag-handle"
          title="Drag to reorder"
        >
          ⋮⋮
        </span>

        <div class="avatar">
          ${caregiverName
            .charAt(0)
            .toUpperCase()}
        </div>

        <div>
          <span
            class="caregiver-name"
          >
            ${caregiverName}
          </span>

          <span
            class="caregiver-meta"
          >
            ${formatHours(
              caregiverHours[
                caregiverName
              ] || 0,
            )}
          </span>
        </div>
      `;

      careMapGrid.append(
        caregiverCell,
      );

      scheduleDays.forEach(
        function (day) {
          const dayCell =
            document.createElement(
              "div",
            );

          dayCell.classList.add(
            "care-map-cell",
          );

          const shiftStack =
            document.createElement(
              "div",
            );

          shiftStack.classList.add(
            "shift-stack",
          );

          activeShifts.forEach(
            function (shift) {
              const assignmentKey =
                `${day.key}-${shift.name}`;

              const assignedCaregiver =
                scheduleAssignments[
                  assignmentKey
                ] || "Open";

              if (
                assignedCaregiver !==
                caregiverName
              ) {
                return;
              }

              const shiftForDay =
                getShiftForDay(
                  day.key,
                  shift,
                );

              const shiftPill =
                document.createElement(
                  "div",
                );

              shiftPill.classList.add(
                "shift-pill",
              );

              shiftPill.innerHTML = `
                <strong>
                  ${formatTime(
                    shiftForDay.start,
                  )}
                  –
                  ${formatTime(
                    shiftForDay.end,
                  )}
                </strong>

                <span>
                  ${shift.name}
                </span>

                <select
                  class="assignment-select"
                  data-day="${day.key}"
                  data-shift="${shift.name}"
                >
                  ${buildCaregiverOptions(
                    assignedCaregiver,
                  )}
                </select>
              `;

              shiftStack.append(
                shiftPill,
              );
            },
          );

          if (
            shiftStack.children
              .length === 0
          ) {
            dayCell.innerHTML = `
              <div class="empty-cell">
                —
              </div>
            `;
          } else {
            dayCell.append(
              shiftStack,
            );
          }

          careMapGrid.append(
            dayCell,
          );
        },
      );
    },
  );

  const totalOpenShifts =
    scheduleDays.reduce(
      function (total, day) {
        const openShiftsForDay =
          activeShifts.filter(
            function (shift) {
              const assignmentKey =
                `${day.key}-${shift.name}`;

              const assignedCaregiver =
                scheduleAssignments[
                  assignmentKey
                ] || "Open";

              return (
                assignedCaregiver ===
                "Open"
              );
            },
          );

        return (
          total +
          openShiftsForDay.length
        );
      },
      0,
    );

  const openCaregiverCell =
    document.createElement("div");

  openCaregiverCell.classList.add(
    "care-map-cell",
    "caregiver-cell",
    "open-shifts-label",
  );

  openCaregiverCell.innerHTML = `
    <div class="avatar">
      +
    </div>

    <div>
      <span class="caregiver-name">
        Open shifts
      </span>

      <span class="caregiver-meta">
        ${totalOpenShifts}
        ${
          totalOpenShifts === 1
            ? "shift"
            : "shifts"
        }
        need coverage
      </span>
    </div>
  `;

  careMapGrid.append(
    openCaregiverCell,
  );

  scheduleDays.forEach(
    function (day) {
      const dayCell =
        document.createElement("div");

      dayCell.classList.add(
        "care-map-cell",
        "open-summary-cell",
      );

      const openShiftsForDay =
        activeShifts.filter(
          function (shift) {
            const assignmentKey =
              `${day.key}-${shift.name}`;

            const assignedCaregiver =
              scheduleAssignments[
                assignmentKey
              ] || "Open";

            return (
              assignedCaregiver ===
              "Open"
            );
          },
        );

      if (
        openShiftsForDay.length === 0
      ) {
        dayCell.innerHTML = `
          <div class="open-day-covered">
            <span>✓</span>
            Covered
          </div>
        `;

        careMapGrid.append(dayCell);

        return;
      }

      const openShiftNames =
        openShiftsForDay
          .map(
            function (shift) {
              return shift.name;
            },
          )
          .join(" · ");

      const openShiftRows =
        openShiftsForDay
          .map(
            function (shift) {
              const shiftForDay =
                getShiftForDay(
                  day.key,
                  shift,
                );

              return `
                <div
                  class="open-mini-shift"
                >
                  <div
                    class="
                      open-mini-shift-info
                    "
                  >
                    <strong>
                      ${shift.name}
                    </strong>

                    <span>
                      ${formatTime(
                        shiftForDay.start,
                      )}
                      –
                      ${formatTime(
                        shiftForDay.end,
                      )}
                    </span>
                  </div>

                  <select
                    class="
                      assignment-select
                    "
                    data-day="${day.key}"
                    data-shift="${shift.name}"
                  >
                    ${buildCaregiverOptions(
                      "Open",
                    )}
                  </select>
                </div>
              `;
            },
          )
          .join("");

      dayCell.innerHTML = `
        <details
          class="open-day-summary"
        >
          <summary>
            <div>
              <strong>
                ${openShiftsForDay.length}
                open
              </strong>

              <span>
                ${openShiftNames}
              </span>
            </div>

            <span
              class="open-chevron"
            >
              ⌄
            </span>
          </summary>

          <div
            class="open-day-menu"
          >
            ${openShiftRows}
          </div>
        </details>
      `;

      careMapGrid.append(
        dayCell,
      );
    },
  );

  scheduleSection.append(
    careMapGrid,
  );

  attachCaregiverDragListeners();
}

function renderMonthlySchedule(
  scheduleDays,
  activeShifts,
) {
  scheduleSection.innerHTML = "";
  scheduleSection.className = "";

  scheduleSection.classList.add(
    "monthly-schedule-grid",
  );

  const orderedWeekDays =
    getOrderedWeekDays();

  orderedWeekDays.forEach(
    function (dayName) {
      const weekdayHeader =
        document.createElement("div");

      weekdayHeader.classList.add(
        "month-weekday-header",
      );

      weekdayHeader.textContent =
        dayName.slice(0, 3);

      scheduleSection.append(
        weekdayHeader,
      );
    },
  );

  if (scheduleDays.length > 0) {
    const firstDate =
      scheduleDays[0].date;

    const firstDayIndex =
      getAppDayIndex(firstDate);

    const selectedStartIndex =
      allWeekDays.indexOf(
        weekStartSelect.value,
      );

    let blankDays =
      firstDayIndex -
      selectedStartIndex;

    if (blankDays < 0) {
      blankDays += 7;
    }

    for (
      let i = 0;
      i < blankDays;
      i++
    ) {
      const emptyDay =
        document.createElement(
          "div",
        );

      emptyDay.classList.add(
        "month-empty-day",
      );

      scheduleSection.append(
        emptyDay,
      );
    }
  }

  scheduleDays.forEach(
    function (day) {
      const dayCard =
        document.createElement("div");

      dayCard.classList.add(
        "month-day-card",
      );

      const dayNumber =
        day.date.getDate();

      const weekdayShort =
        day.date.toLocaleDateString(
          "en-US",
          {
            weekday: "short",
          },
        );

      let shiftRows = "";

      activeShifts.forEach(
        function (shift) {
          const assignmentKey =
            `${day.key}-${shift.name}`;

          const assignedCaregiver =
            scheduleAssignments[
              assignmentKey
            ] || "Open";

          const caregiverOptions =
            buildCaregiverOptions(
              assignedCaregiver,
            );

          const shiftForDay =
            getShiftForDay(
              day.key,
              shift,
            );

          shiftRows += `
            <div
              class="month-shift-row"
            >
              <div
                class="month-shift-info"
              >
                <span>
                  ${shift.name}
                </span>

                <span>
                  ${formatTime(
                    shiftForDay.start,
                  )}
                </span>
              </div>

              <select
                class="
                  assignment-select
                  month-assignment-select
                "
                data-day="${day.key}"
                data-shift="${shift.name}"
              >
                ${caregiverOptions}
              </select>
            </div>
          `;
        },
      );

      dayCard.innerHTML = `
        <div class="month-day-header">
          <span
            class="month-date-number"
          >
            ${dayNumber}
          </span>

          <span
            class="month-weekday"
          >
            ${weekdayShort}
          </span>
        </div>

        <div class="month-shifts">
          ${shiftRows}
        </div>
      `;

      scheduleSection.append(
        dayCard,
      );
    },
  );
}

function renderCoverageSummary(
  scheduleDays,
  activeShifts,
) {
  let totalHoursNeeded = 0;
  let totalHoursCovered = 0;
  let openHours = 0;
  let openShiftsCount = 0;

  const warnings = [];
  const caregiverHours = {};

  caregivers.forEach(
    function (caregiverName) {
      caregiverHours[
        caregiverName
      ] = 0;
    },
  );

  availableShiftsList.innerHTML =
    "";

  scheduleDays.forEach(
    function (day) {
      activeShifts.forEach(
        function (shift) {
          const shiftForDay =
            getShiftForDay(
              day.key,
              shift,
            );

          const shiftHours =
            getShiftHours(
              shiftForDay,
            );

          const assignmentKey =
            `${day.key}-${shift.name}`;

          const assignedCaregiver =
            scheduleAssignments[
              assignmentKey
            ] || "Open";

          totalHoursNeeded +=
            shiftHours;

          if (
            assignedCaregiver ===
            "Open"
          ) {
            openHours += shiftHours;
            openShiftsCount += 1;

            const availableShiftItem =
              document.createElement(
                "li",
              );

            availableShiftItem.innerHTML = `
              <strong>
                ${day.label}
              </strong>
              <br>

              ${shift.name}
              ·
              ${formatTime(
                shiftForDay.start,
              )}
              –
              ${formatTime(
                shiftForDay.end,
              )}
              ·
              ${formatHours(
                shiftHours,
              )}
            `;

            availableShiftsList.append(
              availableShiftItem,
            );
          } else {
            totalHoursCovered +=
              shiftHours;

            if (
              !caregiverHours[
                assignedCaregiver
              ]
            ) {
              caregiverHours[
                assignedCaregiver
              ] = 0;
            }

            caregiverHours[
              assignedCaregiver
            ] += shiftHours;
          }
        },
      );
    },
  );

  totalHoursNeededElement.textContent =
    formatHours(totalHoursNeeded);

  totalHoursCoveredElement.textContent =
    formatHours(totalHoursCovered);

  openHoursElement.textContent =
    formatHours(openHours);

  openShiftsCountElement.textContent =
    openShiftsCount;

  if (toastOpenShiftsCount) {
    toastOpenShiftsCount.textContent =
      openShiftsCount;
  }

  caregiverHoursList.innerHTML = "";

  if (caregivers.length === 0) {
    const emptyCaregiverItem =
      document.createElement("li");

    emptyCaregiverItem.textContent =
      "No caregivers added yet.";

    caregiverHoursList.append(
      emptyCaregiverItem,
    );
  } else {
    caregivers.forEach(
      function (caregiverName) {
        const caregiverHoursItem =
          document.createElement(
            "li",
          );

        const hoursWorked =
          caregiverHours[
            caregiverName
          ] || 0;

        const maxHours =
          caregiverMaxHours[
            caregiverName
          ] || 50;

        if (
          hoursWorked > maxHours
        ) {
          const hoursOver =
            hoursWorked - maxHours;

          caregiverHoursItem
            .classList
            .add(
              "hours-over-limit",
            );

          caregiverHoursItem
            .textContent =
              `${caregiverName}: ` +
              `${formatHours(
                hoursWorked,
              )} ` +
              `⚠ over by ` +
              `${formatHours(
                hoursOver,
              )}`;

          warnings.push({
            level: "high",

            text:
              `${caregiverName} ` +
              `is over their max by ` +
              `${formatHours(
                hoursOver,
              )}.`,
          });
        } else if (
          hoursWorked >=
          maxHours - 5
        ) {
          caregiverHoursItem
            .classList
            .add(
              "hours-near-limit",
            );

          caregiverHoursItem
            .textContent =
              `${caregiverName}: ` +
              `${formatHours(
                hoursWorked,
              )} · near ` +
              `${formatHours(
                maxHours,
              )} limit`;

          warnings.push({
            level: "medium",

            text:
              `${caregiverName} ` +
              `is close to their ` +
              `${formatHours(
                maxHours,
              )} limit.`,
          });
        } else {
          caregiverHoursItem
            .textContent =
              `${caregiverName}: ` +
              `${formatHours(
                hoursWorked,
              )} / ` +
              `${formatHours(
                maxHours,
              )}`;
        }

        caregiverHoursList.append(
          caregiverHoursItem,
        );
      },
    );
  }

  if (openShiftsCount === 0) {
    const noOpenShiftsItem =
      document.createElement("li");

    noOpenShiftsItem.textContent =
      "No available shifts.";

    availableShiftsList.append(
      noOpenShiftsItem,
    );
  } else {
    warnings.unshift({
      level: "medium",

      text:
        `${openShiftsCount} ` +
        `open shifts still need ` +
        `coverage.`,
    });
  }

  if (
    coveragePercentElement &&
    coverageProgressFill
  ) {
    let coveragePercent = 0;

    if (totalHoursNeeded > 0) {
      coveragePercent = Math.round(
        (
          totalHoursCovered /
          totalHoursNeeded
        ) * 100,
      );
    }

    coveragePercentElement.textContent =
      `${coveragePercent}%`;

    coverageProgressFill.style.width =
      `${coveragePercent}%`;

    const degrees = Math.round(
      (
        coveragePercent / 100
      ) * 360,
    );

    const coverageRing =
      document.querySelector(
        ".coverage-ring",
      );

    if (coverageRing) {
      coverageRing.style.background = `
        radial-gradient(
          circle at center,
          #fff 58%,
          transparent 60%
        ),
        conic-gradient(
          var(--blue)
          ${degrees}deg,
          #edf2fb
          ${degrees}deg
        )
      `;
    }
  }

  if (warningCountElement) {
    warningCountElement.textContent =
      warnings.length;
  }

  if (scheduleWarningsList) {
    scheduleWarningsList.innerHTML =
      "";

    if (warnings.length === 0) {
      const noWarnings =
        document.createElement("li");

      noWarnings.textContent =
        "No warnings right now.";

      scheduleWarningsList.append(
        noWarnings,
      );
    } else {
      warnings
        .slice(0, 6)
        .forEach(
          function (warning) {
            const warningItem =
              document.createElement(
                "li",
              );

            warningItem.classList.add(
              warning.level === "high"
                ? "warning-high"
                : "warning-medium",
            );

            warningItem.textContent =
              warning.text;

            scheduleWarningsList.append(
              warningItem,
            );
          },
        );
    }
  }

  startAvailableShiftsAutoScroll();
}

function attachCaregiverDragListeners() {
  const caregiverCells =
    document.querySelectorAll(
      ".draggable-caregiver[data-caregiver]",
    );

  caregiverCells.forEach(
    function (caregiverCell) {
      caregiverCell.addEventListener(
        "dragstart",
        function (event) {
          draggedCaregiverName =
            caregiverCell.dataset
              .caregiver;

          event.dataTransfer
            .effectAllowed = "move";

          event.dataTransfer.setData(
            "text/plain",
            draggedCaregiverName,
          );

          caregiverCell.classList.add(
            "is-dragging",
          );
        },
      );

      caregiverCell.addEventListener(
        "dragover",
        function (event) {
          event.preventDefault();

          event.dataTransfer
            .dropEffect = "move";

          document
            .querySelectorAll(
              ".draggable-caregiver",
            )
            .forEach(
              function (cell) {
                cell.classList.remove(
                  "drag-over",
                );
              },
            );

          caregiverCell.classList.add(
            "drag-over",
          );
        },
      );

      caregiverCell.addEventListener(
        "dragleave",
        function () {
          caregiverCell.classList.remove(
            "drag-over",
          );
        },
      );

      caregiverCell.addEventListener(
        "drop",
        function (event) {
          event.preventDefault();

          const sourceCaregiverName =
            event.dataTransfer.getData(
              "text/plain",
            ) ||
            draggedCaregiverName;

          const targetCaregiverName =
            caregiverCell.dataset
              .caregiver;

          if (
            !sourceCaregiverName ||
            !targetCaregiverName ||
            sourceCaregiverName ===
              targetCaregiverName
          ) {
            caregiverCell
              .classList
              .remove("drag-over");

            return;
          }

          const sourceIndex =
            caregivers.indexOf(
              sourceCaregiverName,
            );

          if (sourceIndex === -1) {
            return;
          }

          const movedCaregiver =
            caregivers.splice(
              sourceIndex,
              1,
            )[0];

          const targetIndexAfterRemoval =
            caregivers.indexOf(
              targetCaregiverName,
            );

          if (
            targetIndexAfterRemoval ===
            -1
          ) {
            caregivers.push(
              movedCaregiver,
            );
          } else {
            caregivers.splice(
              targetIndexAfterRemoval,
              0,
              movedCaregiver,
            );
          }

          draggedCaregiverName = null;

          saveData();
          renderCaregiverList();
          renderSchedule();
        },
      );

      caregiverCell.addEventListener(
        "dragend",
        function () {
          draggedCaregiverName = null;

          document
            .querySelectorAll(
              ".draggable-caregiver",
            )
            .forEach(
              function (cell) {
                cell.classList.remove(
                  "is-dragging",
                  "drag-over",
                );
              },
            );
        },
      );
    },
  );
}

function renderSchedule() {
  const activeShifts =
    getActiveShifts();

  const selectedView =
    scheduleViewSelect.value;

  let scheduleDays = [];

  if (selectedView === "monthly") {
    scheduleTitle.textContent =
      "Monthly Care Map";

    scheduleDays =
      getDaysInSelectedMonth();

    const selectedMonth =
      monthPicker.value ||
      getTodayMonthValue();

    const [year, month] =
      selectedMonth
        .split("-")
        .map(Number);

    weekLabel.textContent =
      new Date(
        year,
        month - 1,
      ).toLocaleDateString(
        "en-US",
        {
          month: "long",
          year: "numeric",
        },
      );

    renderMonthlySchedule(
      scheduleDays,
      activeShifts,
    );
  } else {
    scheduleTitle.textContent =
      "Weekly Care Map";

    scheduleDays =
      getDaysInSelectedWeek();

    const firstDay =
      scheduleDays[0].label;

    const lastDay =
      scheduleDays[
        scheduleDays.length - 1
      ].label;

    weekLabel.textContent =
      `${firstDay} – ${lastDay}`;

    renderWeeklySchedule(
      scheduleDays,
      activeShifts,
    );
  }

  attachAssignmentListeners(
    scheduleDays,
    activeShifts,
  );

  renderCoverageSummary(
    scheduleDays,
    activeShifts,
  );
}

function attachAssignmentListeners() {
  const assignmentSelects =
    document.querySelectorAll(
      ".assignment-select",
    );

  assignmentSelects.forEach(
    function (select) {
      select.addEventListener(
        "change",
        function () {
          const dayName =
            select.dataset.day;

          const shiftName =
            select.dataset.shift;

          const assignmentKey =
            `${dayName}-${shiftName}`;

          scheduleAssignments[
            assignmentKey
          ] = select.value;

          saveData();
          renderSchedule();
        },
      );
    },
  );
}

function renderCaregiverList() {
  caregiverList.innerHTML = "";

  caregivers.forEach(
    function (
      caregiverName,
      index,
    ) {
      const caregiverItem =
        document.createElement("li");

      caregiverItem.classList.add(
        "caregiver-list-item",
      );

      caregiverItem.innerHTML = `
        <span>
          ${caregiverName}
          —
          Max
          ${
            caregiverMaxHours[
              caregiverName
            ] || 50
          }
          hrs
        </span>

        <div
          class="
            caregiver-list-buttons
          "
        >
          <button
            class="
              edit-caregiver-button
            "
            type="button"
          >
            Edit Name
          </button>

          <button
            class="
              edit-max-hours-button
            "
            type="button"
          >
            Edit Max
          </button>

          <button
            class="
              remove-caregiver-button
            "
            type="button"
          >
            Remove
          </button>
        </div>
      `;

      const editButton =
        caregiverItem.querySelector(
          ".edit-caregiver-button",
        );

      const editMaxHoursButton =
        caregiverItem.querySelector(
          ".edit-max-hours-button",
        );

      const removeButton =
        caregiverItem.querySelector(
          ".remove-caregiver-button",
        );

      editButton.addEventListener(
        "click",
        function () {
          const updatedName = prompt(
            "Edit caregiver name:",
            caregiverName,
          );

          if (updatedName === null) {
            return;
          }

          const trimmedName =
            updatedName.trim();

          if (trimmedName === "") {
            return;
          }

          const isDuplicate =
            caregivers.some(
              function (
                existingName,
                existingIndex,
              ) {
                return (
                  existingIndex !==
                    index &&
                  existingName
                    .toLowerCase() ===
                    trimmedName
                      .toLowerCase()
                );
              },
            );

          if (isDuplicate) {
            alert(
              "That caregiver name already exists.",
            );

            return;
          }

          caregivers[index] =
            trimmedName;

          caregiverMaxHours[
            trimmedName
          ] =
            caregiverMaxHours[
              caregiverName
            ] || 50;

          delete caregiverMaxHours[
            caregiverName
          ];

          Object.keys(
            scheduleAssignments,
          ).forEach(
            function (
              assignmentKey,
            ) {
              if (
                scheduleAssignments[
                  assignmentKey
                ] === caregiverName
              ) {
                scheduleAssignments[
                  assignmentKey
                ] = trimmedName;
              }
            },
          );

          saveData();
          renderCaregiverList();
          renderSchedule();
        },
      );

      editMaxHoursButton
        .addEventListener(
          "click",
          function () {
            const currentMaxHours =
              caregiverMaxHours[
                caregiverName
              ] || 50;

            const updatedMaxHours =
              prompt(
                `Set max weekly hours for ${caregiverName}:`,
                currentMaxHours,
              );

            if (
              updatedMaxHours === null
            ) {
              return;
            }

            const maxHoursNumber =
              Number(
                updatedMaxHours,
              );

            if (
              !maxHoursNumber ||
              maxHoursNumber <= 0
            ) {
              alert(
                "Please enter a valid number.",
              );

              return;
            }

            caregiverMaxHours[
              caregiverName
            ] = maxHoursNumber;

            saveData();
            renderCaregiverList();
            renderSchedule();
          },
        );

      removeButton.addEventListener(
        "click",
        function () {
          caregivers.splice(
            index,
            1,
          );

          delete caregiverMaxHours[
            caregiverName
          ];

          Object.keys(
            scheduleAssignments,
          ).forEach(
            function (
              assignmentKey,
            ) {
              if (
                scheduleAssignments[
                  assignmentKey
                ] === caregiverName
              ) {
                scheduleAssignments[
                  assignmentKey
                ] = "Open";
              }
            },
          );

          saveData();
          renderCaregiverList();
          renderSchedule();
        },
      );

      caregiverList.append(
        caregiverItem,
      );
    },
  );
}

function addCaregiver() {
  const newCaregiverName =
    caregiverInput.value.trim();

  if (newCaregiverName === "") {
    return;
  }

  const isDuplicate =
    caregivers.some(
      function (caregiverName) {
        return (
          caregiverName
            .toLowerCase() ===
          newCaregiverName
            .toLowerCase()
        );
      },
    );

  if (isDuplicate) {
    caregiverInput.value = "";
    return;
  }

  caregivers.push(
    newCaregiverName,
  );

  caregiverMaxHours[
    newCaregiverName
  ] = 50;

  caregiverInput.value = "";

  saveData();
  renderCaregiverList();
  renderSchedule();
}

function renderShiftList() {
  shiftList.innerHTML = "";

  customShifts.forEach(
    function (shiftName, index) {
      const shiftItem =
        document.createElement("li");

      shiftItem.classList.add(
        "shift-list-item",
      );

      shiftItem.innerHTML = `
        <span>
          ${shiftName}
        </span>

        <div
          class="shift-list-buttons"
        >
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

      const moveUpButton =
        shiftItem.querySelector(
          ".move-up-button",
        );

      const moveDownButton =
        shiftItem.querySelector(
          ".move-down-button",
        );

      const removeButton =
        shiftItem.querySelector(
          ".remove-shift-button",
        );

      moveUpButton.addEventListener(
        "click",
        function () {
          if (index === 0) {
            return;
          }

          const currentShift =
            customShifts[index];

          customShifts[index] =
            customShifts[
              index - 1
            ];

          customShifts[
            index - 1
          ] = currentShift;

          saveData();
          renderShiftList();
          renderShiftTimeList();
          renderSchedule();
        },
      );

      moveDownButton
        .addEventListener(
          "click",
          function () {
            if (
              index ===
              customShifts.length - 1
            ) {
              return;
            }

            const currentShift =
              customShifts[index];

            customShifts[index] =
              customShifts[
                index + 1
              ];

            customShifts[
              index + 1
            ] = currentShift;

            saveData();
            renderShiftList();
            renderShiftTimeList();
            renderSchedule();
          },
        );

      removeButton.addEventListener(
        "click",
        function () {
          const removedShiftName =
            customShifts[index];

          customShifts.splice(
            index,
            1,
          );

          delete shiftTimes[
            removedShiftName
          ];

          Object.keys(
            scheduleAssignments,
          ).forEach(
            function (
              assignmentKey,
            ) {
              if (
                assignmentKey.endsWith(
                  `-${removedShiftName}`,
                )
              ) {
                delete scheduleAssignments[
                  assignmentKey
                ];
              }
            },
          );

          Object.keys(
            shiftTimeOverrides,
          ).forEach(
            function (overrideKey) {
              if (
                overrideKey.endsWith(
                  `__${removedShiftName}`,
                )
              ) {
                delete shiftTimeOverrides[
                  overrideKey
                ];
              }
            },
          );

          saveData();
          renderShiftList();
          renderShiftTimeList();
          renderSchedule();
        },
      );

      shiftList.append(
        shiftItem,
      );
    },
  );
}

function updateCustomShiftVisibility() {
  if (
    shiftStyleSelect.value ===
    "custom"
  ) {
    customShiftSection.classList.remove(
      "hidden",
    );
  } else {
    customShiftSection.classList.add(
      "hidden",
    );
  }
}

function updatePickerVisibility() {
  if (
    scheduleViewSelect.value ===
    "monthly"
  ) {
    monthPickerSection.classList.remove(
      "hidden",
    );

    weekPickerSection.classList.add(
      "hidden",
    );
  } else {
    monthPickerSection.classList.add(
      "hidden",
    );

    weekPickerSection.classList.remove(
      "hidden",
    );
  }
}

function renderShiftTimeList() {
  shiftTimeList.innerHTML = "";

  const activeShifts =
    getActiveShifts();

  activeShifts.forEach(
    function (shift) {
      const shiftTimeRow =
        document.createElement("div");

      shiftTimeRow.classList.add(
        "clean-shift-time-row",
      );

      const shiftHours =
        getShiftHours(shift);

      shiftTimeRow.innerHTML = `
        <div>
          <strong>
            ${shift.name}
          </strong>

          <span
            class="
              clean-shift-time-text
            "
          >
            ${formatTime(
              shift.start,
            )}
            –
            ${formatTime(
              shift.end,
            )}
            ·
            ${formatHours(
              shiftHours,
            )}
          </span>
        </div>

        <button
          class="
            edit-default-time-button
          "
          type="button"
          data-shift="${shift.name}"
        >
          Edit default
        </button>
      `;

      shiftTimeList.append(
        shiftTimeRow,
      );
    },
  );

  const editDefaultTimeButtons =
    document.querySelectorAll(
      ".edit-default-time-button",
    );

  editDefaultTimeButtons.forEach(
    function (button) {
      button.addEventListener(
        "click",
        function () {
          const shiftName =
            button.dataset.shift;

          const shift =
            activeShifts.find(
              function (
                activeShift,
              ) {
                return (
                  activeShift.name ===
                  shiftName
                );
              },
            );

          if (!shift) {
            return;
          }

          editDefaultShiftTime(
            shift,
          );
        },
      );
    },
  );
}

function fillPrettyTimeSelects() {
  const hourSelects = [
    editStartHourSelect,
    editEndHourSelect,
  ];

  const minuteSelects = [
    editStartMinuteSelect,
    editEndMinuteSelect,
  ];

  hourSelects.forEach(
    function (select) {
      select.innerHTML = "";

      for (
        let hour = 1;
        hour <= 12;
        hour++
      ) {
        const option =
          document.createElement(
            "option",
          );

        option.value =
          String(hour).padStart(
            2,
            "0",
          );

        option.textContent =
          String(hour).padStart(
            2,
            "0",
          );

        select.append(option);
      }
    },
  );

  minuteSelects.forEach(
    function (select) {
      select.innerHTML = "";

      for (
        let minute = 0;
        minute < 60;
        minute++
      ) {
        const option =
          document.createElement(
            "option",
          );

        option.value =
          String(minute).padStart(
            2,
            "0",
          );

        option.textContent =
          String(minute).padStart(
            2,
            "0",
          );

        select.append(option);
      }
    },
  );
}

function convert24HourToPrettyTime(
  timeValue,
) {
  const [hourText, minute] =
    timeValue.split(":");

  let hour = Number(hourText);

  const period =
    hour >= 12 ? "PM" : "AM";

  hour = hour % 12;

  if (hour === 0) {
    hour = 12;
  }

  return {
    hour:
      String(hour).padStart(
        2,
        "0",
      ),

    minute,
    period,
  };
}

function convertPrettyTimeTo24Hour(
  hourValue,
  minuteValue,
  periodValue,
) {
  let hour = Number(hourValue);

  if (
    periodValue === "AM" &&
    hour === 12
  ) {
    hour = 0;
  }

  if (
    periodValue === "PM" &&
    hour !== 12
  ) {
    hour += 12;
  }

  return (
    `${String(hour).padStart(
      2,
      "0",
    )}:${minuteValue}`
  );
}

function setPrettyStartTime(
  timeValue,
) {
  const prettyTime =
    convert24HourToPrettyTime(
      timeValue,
    );

  editStartHourSelect.value =
    prettyTime.hour;

  editStartMinuteSelect.value =
    prettyTime.minute;

  editStartPeriodSelect.value =
    prettyTime.period;
}

function setPrettyEndTime(
  timeValue,
) {
  const prettyTime =
    convert24HourToPrettyTime(
      timeValue,
    );

  editEndHourSelect.value =
    prettyTime.hour;

  editEndMinuteSelect.value =
    prettyTime.minute;

  editEndPeriodSelect.value =
    prettyTime.period;
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

function editDefaultShiftTime(
  shift,
) {
  activeTimeEdit = {
    mode: "default",
    dayKey: "",
    shift,
  };

  editTimeTitle.textContent =
    `Edit ${shift.name}`;

  editTimeSubtitle.textContent =
    `This changes ${shift.name} ` +
    `everywhere unless a date ` +
    `has a custom time.`;

  setPrettyStartTime(
    shift.start,
  );

  setPrettyEndTime(
    shift.end,
  );

  editTimeModal.classList.remove(
    "hidden",
  );
}

function closeEditTimeModal() {
  editTimeModal.classList.add(
    "hidden",
  );

  activeTimeEdit = {
    mode: "date",
    dayKey: "",
    shift: null,
  };
}

function isValidTimeValue(
  timeValue,
) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(
    timeValue,
  );
}

function saveEditedShiftTime() {
  if (!activeTimeEdit.shift) {
    return;
  }

  const newStart =
    getPrettyStartTime();

  const newEnd =
    getPrettyEndTime();

  if (
    !isValidTimeValue(newStart) ||
    !isValidTimeValue(newEnd)
  ) {
    alert(
      "Please choose a valid start and end time.",
    );

    return;
  }

  const shiftName =
    activeTimeEdit.shift.name;

  if (!shiftTimes[shiftName]) {
    shiftTimes[shiftName] = {
      start: newStart,
      end: newEnd,
    };
  }

  shiftTimes[shiftName].start =
    newStart;

  shiftTimes[shiftName].end =
    newEnd;

  saveData();
  closeEditTimeModal();
  renderShiftTimeList();
  renderSchedule();
}

function copySelectedWeek() {
  if (
    scheduleViewSelect.value !==
    "weekly"
  ) {
    alert(
      "Switch to Weekly view before copying a week.",
    );

    return;
  }

  const weekDays =
    getDaysInSelectedWeek();

  const activeShifts =
    getActiveShifts();

  copiedWeekAssignments = [];

  weekDays.forEach(
    function (day, dayIndex) {
      activeShifts.forEach(
        function (shift) {
          const assignmentKey =
            `${day.key}-${shift.name}`;

          const assignedCaregiver =
            scheduleAssignments[
              assignmentKey
            ] || "Open";

          copiedWeekAssignments.push({
            dayIndex,
            shiftName: shift.name,
            caregiver:
              assignedCaregiver,
          });
        },
      );
    },
  );

  alert(
    "This week has been copied.",
  );
}

function pasteCopiedWeek() {
  if (
    scheduleViewSelect.value !==
    "weekly"
  ) {
    alert(
      "Switch to Weekly view before pasting a week.",
    );

    return;
  }

  if (!copiedWeekAssignments) {
    alert("Copy a week first.");
    return;
  }

  const weekDays =
    getDaysInSelectedWeek();

  copiedWeekAssignments.forEach(
    function (copiedShift) {
      const targetDay =
        weekDays[
          copiedShift.dayIndex
        ];

      if (!targetDay) {
        return;
      }

      const assignmentKey =
        `${targetDay.key}-` +
        `${copiedShift.shiftName}`;

      scheduleAssignments[
        assignmentKey
      ] = copiedShift.caregiver;
    },
  );

  saveData();
  renderSchedule();

  alert(
    "Copied week pasted to the selected week.",
  );
}

function clearSelectedWeek() {
  if (
    scheduleViewSelect.value !==
    "weekly"
  ) {
    alert(
      "Switch to Weekly view before clearing a week.",
    );

    return;
  }

  if (
    !confirm(
      "Clear only this selected week?",
    )
  ) {
    return;
  }

  const weekDays =
    getDaysInSelectedWeek();

  const activeShifts =
    getActiveShifts();

  weekDays.forEach(
    function (day) {
      activeShifts.forEach(
        function (shift) {
          const assignmentKey =
            `${day.key}-${shift.name}`;

          delete scheduleAssignments[
            assignmentKey
          ];
        },
      );
    },
  );

  saveData();
  renderSchedule();

  alert(
    "This week has been cleared.",
  );
}

function clearSelectedMonth() {
  if (
    scheduleViewSelect.value !==
    "monthly"
  ) {
    alert(
      "Switch to Monthly view before clearing a month.",
    );

    return;
  }

  if (
    !confirm(
      "Clear only this selected month?",
    )
  ) {
    return;
  }

  const monthDays =
    getDaysInSelectedMonth();

  const activeShifts =
    getActiveShifts();

  monthDays.forEach(
    function (day) {
      activeShifts.forEach(
        function (shift) {
          const assignmentKey =
            `${day.key}-${shift.name}`;

          delete scheduleAssignments[
            assignmentKey
          ];
        },
      );
    },
  );

  saveData();
  renderSchedule();

  alert(
    "This month has been cleared.",
  );
}

function updateAvailableShiftsMinimizedState() {
  if (
    !availableShiftsToast ||
    !minimizeAvailableShiftsButton
  ) {
    return;
  }

  const isMinimized =
    localStorage.getItem(
      "curavelaAvailableShiftsMinimized",
    ) === "true";

  availableShiftsToast
    .classList
    .toggle(
      "is-minimized",
      isMinimized,
    );

  minimizeAvailableShiftsButton
    .textContent =
      isMinimized ? "+" : "−";
}

function startAvailableShiftsAutoScroll() {
  clearInterval(
    availableShiftsScrollInterval,
  );

  if (!availableShiftsBody) {
    return;
  }

  availableShiftsBody.scrollTop = 0;

  availableShiftsScrollInterval =
    setInterval(
      function () {
        const maxScroll =
          availableShiftsBody
            .scrollHeight -
          availableShiftsBody
            .clientHeight;

        if (maxScroll <= 0) {
          return;
        }

        if (
          availableShiftsBody
            .scrollTop >=
          maxScroll
        ) {
          availableShiftsBody
            .scrollTop = 0;
        } else {
          availableShiftsBody
            .scrollTop += 1;
        }
      },
      90,
    );
}

addShiftButton.addEventListener(
  "click",
  function () {
    const newShiftName =
      customShiftInput
        .value
        .trim();

    if (newShiftName === "") {
      return;
    }

    const isDuplicate =
      customShifts.some(
        function (shiftName) {
          return (
            shiftName
              .toLowerCase() ===
            newShiftName
              .toLowerCase()
          );
        },
      );

    if (isDuplicate) {
      customShiftInput.value = "";
      return;
    }

    customShifts.push(
      newShiftName,
    );

    shiftTimes[newShiftName] = {
      start: "09:00",
      end: "17:00",
    };

    customShiftInput.value = "";

    saveData();
    renderShiftList();
    renderShiftTimeList();
    renderSchedule();
  },
);

customShiftInput.addEventListener(
  "keydown",
  function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      addShiftButton.click();
    }
  },
);

addCaregiverButton.addEventListener(
  "click",
  function () {
    addCaregiver();
  },
);

caregiverInput.addEventListener(
  "keydown",
  function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      addCaregiver();
    }
  },
);

previousWeekButton.addEventListener(
  "click",
  function () {
    changeSelectedWeekByDays(-7);
  },
);

nextWeekButton.addEventListener(
  "click",
  function () {
    changeSelectedWeekByDays(7);
  },
);

todayWeekButton.addEventListener(
  "click",
  function () {
    weekStartDateInput.value =
      getTodayDateValue();

    saveData();
    updateWeekDisplay();
    renderSchedule();
  },
);

weekStartSelect.addEventListener(
  "change",
  function () {
    saveData();
    updateWeekDisplay();
    renderSchedule();
  },
);

shiftStyleSelect.addEventListener(
  "change",
  function () {
    updateCustomShiftVisibility();
    renderShiftTimeList();
    saveData();
    renderSchedule();
  },
);

scheduleViewSelect.addEventListener(
  "change",
  function () {
    updatePickerVisibility();
    saveData();
    renderSchedule();
  },
);

monthPicker.addEventListener(
  "change",
  function () {
    saveData();
    renderSchedule();
  },
);

weekStartDateInput.addEventListener(
  "change",
  function () {
    saveData();
    updateWeekDisplay();
    renderSchedule();
  },
);

scheduleNoteInput.addEventListener(
  "input",
  function () {
    scheduleNote =
      scheduleNoteInput.value;

    saveData();
  },
);

clearScheduleButton.addEventListener(
  "click",
  function () {
    if (
      confirm(
        "Are you sure you want to clear the full schedule?",
      )
    ) {
      scheduleAssignments = {};

      saveData();
      renderSchedule();
    }
  },
);

exportDataButton.addEventListener(
  "click",
  function () {
    exportCuravelaData();
  },
);

importDataButton.addEventListener(
  "click",
  function () {
    importDataInput.click();
  },
);

importDataInput.addEventListener(
  "change",
  function () {
    const file =
      importDataInput.files[0];

    if (!file) {
      return;
    }

    importCuravelaData(file);

    importDataInput.value = "";
  },
);

printScheduleButton.addEventListener(
  "click",
  function () {
    window.print();
  },
);

copyWeekButton.addEventListener(
  "click",
  function () {
    copySelectedWeek();
  },
);

pasteWeekButton.addEventListener(
  "click",
  function () {
    pasteCopiedWeek();
  },
);

clearWeekButton.addEventListener(
  "click",
  function () {
    clearSelectedWeek();
  },
);

clearMonthButton.addEventListener(
  "click",
  function () {
    clearSelectedMonth();
  },
);

previousMonthButton.addEventListener(
  "click",
  function () {
    changeSelectedMonthByMonths(
      -1,
    );
  },
);

nextMonthButton.addEventListener(
  "click",
  function () {
    changeSelectedMonthByMonths(
      1,
    );
  },
);

currentMonthButton.addEventListener(
  "click",
  function () {
    monthPicker.value =
      getTodayMonthValue();

    saveData();
    updateMonthDisplay();
    renderSchedule();
  },
);

if (
  minimizeAvailableShiftsButton &&
  availableShiftsToast
) {
  minimizeAvailableShiftsButton
    .addEventListener(
      "click",
      function () {
        const isCurrentlyMinimized =
          availableShiftsToast
            .classList
            .contains(
              "is-minimized",
            );

        localStorage.setItem(
          "curavelaAvailableShiftsMinimized",
          String(
            !isCurrentlyMinimized,
          ),
        );

        updateAvailableShiftsMinimizedState();
      },
    );
}

if (
  moreActionsButton &&
  moreActionsMenu
) {
  moreActionsButton.addEventListener(
    "click",
    function (event) {
      event.stopPropagation();

      moreActionsMenu
        .classList
        .toggle("hidden");
    },
  );

  moreActionsMenu.addEventListener(
    "click",
    function (event) {
      event.stopPropagation();
    },
  );

  document.addEventListener(
    "click",
    function (event) {
      if (
        !event.target.closest(
          ".more-actions",
        )
      ) {
        moreActionsMenu
          .classList
          .add("hidden");
      }
    },
  );
}

if (quickAddShiftButton) {
  quickAddShiftButton
    .addEventListener(
      "click",
      function () {
        shiftStyleSelect.value =
          "custom";

        updateCustomShiftVisibility();
        renderShiftTimeList();
        saveData();
        renderSchedule();

        document
          .querySelector(
            "#settings-panel",
          )
          .scrollIntoView({
            behavior: "smooth",
            block: "start",
          });

        setTimeout(
          function () {
            customShiftInput.focus();
          },
          500,
        );
      },
    );
}

closeEditTimeButton.addEventListener(
  "click",
  function () {
    closeEditTimeModal();
  },
);

cancelEditTimeButton.addEventListener(
  "click",
  function () {
    closeEditTimeModal();
  },
);

saveEditTimeButton.addEventListener(
  "click",
  function () {
    saveEditedShiftTime();
  },
);

editTimeModal.addEventListener(
  "click",
  function (event) {
    if (
      event.target === editTimeModal
    ) {
      closeEditTimeModal();
    }
  },
);

document.addEventListener(
  "keydown",
  function (event) {
    if (
      event.key === "Escape" &&
      !editTimeModal.classList.contains(
        "hidden",
      )
    ) {
      closeEditTimeModal();
    }
  },
);

fillPrettyTimeSelects();
loadData();

if (monthPicker.value === "") {
  monthPicker.value =
    getTodayMonthValue();
}

if (
  weekStartDateInput.value === ""
) {
  weekStartDateInput.value =
    getTodayDateValue();
}

scheduleNoteInput.value =
  scheduleNote;

updateCustomShiftVisibility();
updatePickerVisibility();
updateAvailableShiftsMinimizedState();
renderShiftList();
renderCaregiverList();
renderShiftTimeList();
renderSchedule();
updateWeekDisplay();
updateMonthDisplay();