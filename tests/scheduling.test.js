const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../scheduling.js");

function model() {
  return {
    shifts: [
      { name: "Morning", start: "06:30", end: "13:00" },
      { name: "Afternoon", start: "13:00", end: "19:00" },
      { name: "Night", start: "19:00", end: "07:00" },
    ],
    caregivers: [{ id: "alex", name: "Alex" }, { id: "sam", name: "Sam" }],
    rules: {}, maxHours: { alex: 50, sam: 50 },
    assignments: {}, overrides: {}, weekStart: "Sunday",
  };
}
function proposal(dayKey, shiftName, caregiverId = "alex") {
  const shift = model().shifts.find(function (item) { return item.name === shiftName; });
  return { dayKey, shiftName, caregiverId, start: shift.start, end: shift.end };
}
function codes(warnings) { return warnings.map(function (warning) { return warning.code; }); }

test("blocks the reviewed overnight/morning overlap", function () {
  const data = model();
  data.assignments["2026-10-09-Night"] = "alex";
  const result = rules.evaluate(data, proposal("2026-10-10", "Morning"));
  assert.equal(result.safe, false);
  assert.equal(result.blocked, true);
  assert.deepEqual(codes(result.warnings), ["overlap"]);
});

test("looks into the preceding week when checking an overnight overlap", function () {
  const data = model();
  data.assignments["2026-10-03-Night"] = "alex";
  assert.equal(rules.evaluate(data, proposal("2026-10-04", "Morning")).blocked, true);
});

test("looks into the next day when assigning a night shift", function () {
  const data = model();
  data.assignments["2026-10-05-Morning"] = "alex";
  assert.equal(rules.evaluate(data, proposal("2026-10-04", "Night")).blocked, true);
});

test("overlap for another caregiver does not block an assignment", function () {
  const data = model();
  data.assignments["2026-10-09-Night"] = "sam";
  assert.equal(rules.evaluate(data, proposal("2026-10-10", "Morning")).safe, true);
});

test("adjacent shifts are allowed when no rest preference is set", function () {
  const data = model();
  data.assignments["2026-10-04-Morning"] = "alex";
  assert.equal(rules.evaluate(data, proposal("2026-10-04", "Afternoon")).safe, true);
});

test("configured rest time produces an overridable warning", function () {
  const data = model();
  data.assignments["2026-10-04-Morning"] = "alex";
  data.rules.alex = { minRestHours: 8 };
  const result = rules.evaluate(data, proposal("2026-10-04", "Night"));
  assert.equal(result.blocked, false);
  assert.deepEqual(codes(result.warnings), ["rest"]);
  assert.match(result.conflicts[0], /6 hours off/);
});

test("exactly the required rest is permitted", function () {
  const data = model();
  data.assignments["2026-10-04-Morning"] = "alex";
  data.rules.alex = { minRestHours: 6 };
  assert.equal(rules.evaluate(data, proposal("2026-10-04", "Night")).safe, true);
});

test("editing an existing assignment does not conflict with itself", function () {
  const data = model();
  data.assignments["2026-10-04-Morning"] = "alex";
  const result = rules.evaluate(data, proposal("2026-10-04", "Morning"));
  assert.equal(result.safe, true);
  assert.equal(result.projectedHours, 6.5);
});

test("a moved assignment excludes the source from the proposal", function () {
  const data = model();
  data.assignments["2026-10-04-Morning"] = "alex";
  data.rules.alex = { minRestHours: 48 };
  const result = rules.evaluate(data, {
    ...proposal("2026-10-05", "Morning"), sourceKey: "2026-10-04-Morning",
  });
  assert.equal(result.safe, true);
  assert.equal(result.projectedHours, 6.5);
});

test("finds six consecutive days across a week boundary", function () {
  const data = model();
  for (let day = 2; day <= 7; day += 1) data.assignments["2026-10-0" + day + "-Morning"] = "alex";
  data.rules.alex = { maxConsecutiveDays: 5 };
  const result = rules.getWarnings(data, "2026-10-04", "2026-10-10");
  assert.ok(codes(result).includes("consecutive"));
  assert.match(result.find(function (warning) { return warning.code === "consecutive"; }).text, /6 consecutive days/);
});

test("unrelated historical consecutive runs do not warn in the current view", function () {
  const data = model();
  for (let day = 2; day <= 7; day += 1) data.assignments["2026-09-0" + day + "-Morning"] = "alex";
  data.rules.alex = { maxConsecutiveDays: 5 };
  assert.deepEqual(rules.getWarnings(data, "2026-10-04", "2026-10-10"), []);
});

test("overnight work counts on both calendar days but midnight end does not", function () {
  const data = model();
  data.assignments["2026-10-04-Night"] = "alex";
  assert.deepEqual(Array.from(rules.workedDays(rules.buildEntries(data))), ["2026-10-04", "2026-10-05"]);
  data.overrides["2026-10-04__Night"] = { start: "19:00", end: "00:00" };
  assert.deepEqual(Array.from(rules.workedDays(rules.buildEntries(data))), ["2026-10-04"]);
});

test("monthly warnings preserve each week's maximum, not a monthly maximum", function () {
  const data = model();
  for (let day = 4; day <= 9; day += 1) data.assignments["2026-10-0" + day + "-Night"] = "alex";
  const weekly = rules.getWarnings(data, "2026-10-04", "2026-10-10").filter(function (w) { return w.code === "hours"; });
  const monthly = rules.getWarnings(data, "2026-10-01", "2026-10-31").filter(function (w) { return w.code === "hours"; });
  assert.equal(weekly.length, 1);
  assert.deepEqual(monthly, weekly);
  assert.match(monthly[0].text, /22 hours over/);
});

test("a month boundary includes the rest of its partial week", function () {
  const data = model();
  for (const day of ["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]) {
    data.assignments[day + "-Night"] = "alex";
  }
  const result = rules.getWarnings(data, "2026-10-01", "2026-10-31");
  assert.ok(result.some(function (warning) { return warning.code === "hours" && warning.week === "2026-09-27"; }));
});

test("two days off are evaluated per week in monthly view", function () {
  const data = model();
  data.rules.alex = { needsTwoConsecutiveDaysOff: true };
  for (let day = 4; day <= 10; day += 1) data.assignments["2026-10-" + String(day).padStart(2, "0") + "-Afternoon"] = "alex";
  const warnings = rules.getWarnings(data, "2026-10-01", "2026-10-31").filter(function (w) { return w.code === "days-off"; });
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].week, "2026-10-04");
});

test("availability and allowed shifts are checked in the common evaluator", function () {
  const data = model();
  data.rules.alex = { availableDays: ["Monday"], allowedShifts: ["Night"] };
  assert.deepEqual(codes(rules.evaluate(data, proposal("2026-10-04", "Morning")).warnings), ["unavailable", "shift-rule"]);
});

test("date-specific times take precedence over templates", function () {
  const data = model();
  data.assignments["2026-10-04-Morning"] = "alex";
  data.overrides["2026-10-04__Morning"] = { start: "09:00", end: "12:00" };
  assert.equal(rules.buildEntries(data)[0].hours, 3);
});

test("rejects invalid dates and times", function () {
  assert.equal(rules.interval("2026-02-30", "09:00", "17:00"), null);
  assert.equal(rules.interval("2026-10-04", "25:00", "17:00"), null);
  assert.equal(rules.evaluate(model(), { ...proposal("2026-10-04", "Morning"), caregiverId: "missing" }), null);
});

test("equal times explicitly represent 24 hours", function () {
  assert.equal(rules.interval("2026-10-04", "00:00", "00:00").hours, 24);
});

test("calendar arithmetic stays stable over DST and year changes", function () {
  assert.equal(rules.interval("2026-10-31", "19:00", "07:00").hours, 12);
  assert.equal(rules.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(rules.weekStart("2026-10-04", "Monday"), "2026-09-28");
});

test("split shift parts follow their parent in calendar and print ordering", () => {
  const source=[
    {name:"Morning",start:"06:30"},
    {name:"Afternoon",start:"13:00"},
    {name:"Night",start:"19:00"},
    {name:"Morning (part 3)",start:"11:00"},
    {name:"Morning (part 2)",start:"10:00"}
  ];
  const sorted=rules.orderSplitShifts(source);
  assert.deepEqual(sorted.map(x=>x.name),["Morning","Morning (part 2)","Morning (part 3)","Afternoon","Night"]);
  assert.deepEqual(source.map(x=>x.name),["Morning","Afternoon","Night","Morning (part 3)","Morning (part 2)"]);
  assert.deepEqual(rules.orderSplitShifts([{name:"Night"},{name:"Morning (part 2)"},{name:"Morning"}]).map(x=>x.name),["Night","Morning","Morning (part 2)"]);
});
