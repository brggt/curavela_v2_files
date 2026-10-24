const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../workspace.js');

function snapshot() {
  return W.validateBackup({
    caregivers: [{ id: 'alex', name: 'Alex' }, { id: 'sam', name: 'Sam' }],
    scheduleAssignments: {},
    shiftStyle: 'two',
  });
}

test('brief surfaces blocking time-off warnings and clears them after reassignment', () => {
  const data = snapshot();
  data.scheduleAssignments['2026-10-25-Day'] = 'alex';
  data.caregiverRules.alex.timeOff = [{ startDate: '2026-10-25', endDate: '2026-10-25' }];
  let brief = W.caregiverBriefs(data, '2026-10-25', '2026-10-31');
  assert.equal(brief.assignedShifts, 1);
  assert.ok(brief.blockingWarnings.some(w => w.code === 'time-off' && w.caregiverId === 'alex'));
  assert.equal(brief.blockingWarnings.length,
    brief.people.flatMap(person => person.warnings).filter(warning => warning.blocking).length);

  data.scheduleAssignments['2026-10-25-Day'] = 'sam';
  brief = W.caregiverBriefs(data, '2026-10-25', '2026-10-31');
  assert.equal(brief.assignedShifts, 1);
  assert.equal(brief.blockingWarnings.length, 0);
});

test('brief flags overlapping assignments even when all shifts are assigned', () => {
  const data = snapshot();
  data.scheduleAssignments['2026-10-25-Day'] = 'alex';
  data.scheduleAssignments['2026-10-25-Night'] = 'alex';
  data.shiftTimeOverrides['2026-10-25__Day'] = { start: '07:00', end: '20:00' };
  let brief = W.caregiverBriefs(data, '2026-10-25', '2026-10-25');
  assert.equal(brief.openShifts, 0);
  assert.ok(brief.blockingWarnings.some(w => w.code === 'overlap'));

  data.shiftTimeOverrides['2026-10-25__Day'] = { start: '07:00', end: '19:00' };
  brief = W.caregiverBriefs(data, '2026-10-25', '2026-10-25');
  assert.equal(brief.blockingWarnings.length, 0);
});

test('unassigned shifts do not create false blocking warnings', () => {
  const brief = W.caregiverBriefs(snapshot(), '2026-10-25', '2026-10-25');
  assert.equal(brief.openShifts, 2);
  assert.deepEqual(brief.blockingWarnings, []);
});
