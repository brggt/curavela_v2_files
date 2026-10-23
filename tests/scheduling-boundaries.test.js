const test = require('node:test');
const assert = require('node:assert/strict');
const scheduling = require('../scheduling.js');

function workspace() {
  return {
    shifts: [
      { name: 'Day', start: '07:00', end: '19:00' },
      { name: 'Night', start: '19:00', end: '07:00' },
    ],
    caregivers: [{ id: 'caregiver-1', name: 'Caregiver 1' }],
    rules: {},
    maxHours: { 'caregiver-1': 50 },
    assignments: {},
    overrides: {},
    weekStart: 'Sunday',
  };
}

function candidate(dayKey, shiftName) {
  const shift = workspace().shifts.find((item) => item.name === shiftName);
  return { dayKey, shiftName, caregiverId: 'caregiver-1', start: shift.start, end: shift.end };
}

test('timed time off ending exactly when a shift starts is permitted', () => {
  const data = workspace();
  data.rules['caregiver-1'] = {
    timeOff: [{ allDay: false, startDate: '2026-10-22', startTime: '06:00',
      endDate: '2026-10-22', endTime: '07:00' }],
  };
  assert.equal(scheduling.evaluate(data, candidate('2026-10-22', 'Day')).blocked, false);
  data.rules['caregiver-1'].timeOff[0].endTime = '07:01';
  const result = scheduling.evaluate(data, candidate('2026-10-22', 'Day'));
  assert.equal(result.blocked, true);
  assert.ok(result.warnings.some((warning) => warning.code === 'time-off'));
});

test('overnight shift checks timed time off on its second calendar day', () => {
  const data = workspace();
  data.rules['caregiver-1'] = {
    timeOff: [{ allDay: false, startDate: '2026-10-23', startTime: '02:00',
      endDate: '2026-10-23', endTime: '04:00' }],
  };
  const result = scheduling.evaluate(data, candidate('2026-10-22', 'Night'));
  assert.equal(result.blocked, true);
  assert.ok(result.warnings.some((warning) => warning.code === 'time-off'));
});

test('year-boundary shifts allow exact handoffs but block overlap', () => {
  const data = workspace();
  data.assignments['2026-12-31-Night'] = 'caregiver-1';
  assert.equal(scheduling.evaluate(data, candidate('2027-01-01', 'Day')).blocked, false);
  data.overrides['2026-12-31__Night'] = { start: '19:00', end: '08:00' };
  const result = scheduling.evaluate(data, candidate('2027-01-01', 'Day'));
  assert.equal(result.blocked, true);
  assert.ok(result.warnings.some((warning) => warning.code === 'overlap'));
});

test('overnight hours count toward the week in which the shift starts', () => {
  const data = workspace();
  data.assignments['2026-10-24-Night'] = 'caregiver-1';
  const entries = scheduling.buildEntries(data);
  assert.equal(scheduling.weeklyHours(entries, '2026-10-18'), 12);
  assert.equal(scheduling.weeklyHours(entries, '2026-10-25'), 0);
  assert.deepEqual(Array.from(scheduling.workedDays(entries)), ['2026-10-24', '2026-10-25']);
});
