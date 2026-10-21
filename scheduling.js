/* Shared scheduling rules. Dates are local calendar dates; hours are wall-clock
 * hours, allocated to the week in which a shift starts (not a payroll ledger).
 * UTC arithmetic keeps calendar calculations independent of browser DST changes.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CuravelaScheduling = api;
})(typeof globalThis === "undefined" ? this : globalThis, function () {
  "use strict";
  const DAY = 1440;
  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function dateNumber(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key || "")) return NaN;
    const date = new Date(key + "T00:00:00Z");
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) return NaN;
    return date.getTime() / 60000;
  }

  function dateKey(minutes) {
    return new Date(minutes * 60000).toISOString().slice(0, 10);
  }

  function addDays(key, count) {
    return dateKey(dateNumber(key) + count * DAY);
  }

  function timeNumber(value) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || "")) return NaN;
    const parts = value.split(":").map(Number);
    return parts[0] * 60 + parts[1];
  }

  function interval(dayKey, startTime, endTime) {
    const midnight = dateNumber(dayKey);
    const start = midnight + timeNumber(startTime);
    let end = midnight + timeNumber(endTime);
    if (![start, end].every(Number.isFinite)) return null;
    if (end <= start) end += DAY;
    return { start, end, hours: (end - start) / 60 };
  }

  function weekStart(key, weekday) {
    const startIndex = Math.max(0, WEEKDAYS.indexOf(weekday));
    const dayIndex = new Date(key + "T00:00:00Z").getUTCDay();
    return addDays(key, -((dayIndex - startIndex + 7) % 7));
  }

  function weeksInRange(first, last, weekday) {
    const weeks = [];
    for (let key = weekStart(first, weekday); key <= last; key = addDays(key, 7)) weeks.push(key);
    return weeks;
  }

  function buildEntries(model) {
    const shifts = new Map(model.shifts.map(function (shift) { return [shift.name, shift]; }));
    return Object.entries(model.assignments).flatMap(function (pair) {
      const key = pair[0], caregiverId = pair[1];
      const dayKey = key.slice(0, 10), shiftName = key.slice(11);
      const shift = (model.extraShifts || []).find(function (item) { return item.dayKey === dayKey && item.name === shiftName; }) || shifts.get(shiftName);
      if (!shift || caregiverId === "Open" || !caregiverId || !Number.isFinite(dateNumber(dayKey))) return [];
      const times = model.overrides[dayKey + "__" + shiftName] || shift;
      const span = interval(dayKey, times.start, times.end);
      return [{
        key, dayKey, shiftName, caregiverId,
        startTime: times.start, endTime: times.end,
        invalid: !span,
        ...(span || { start: NaN, end: NaN, hours: 0 }),
      }];
    });
  }

  function workedDays(entries) {
    const days = new Set();
    entries.filter(function (entry) { return !entry.invalid; }).forEach(function (entry) {
      for (let minute = Math.floor(entry.start / DAY) * DAY; minute < entry.end; minute += DAY) {
        days.add(dateKey(minute));
      }
    });
    return days;
  }

  function consecutiveRuns(days) {
    const runs = [];
    Array.from(days).sort().forEach(function (day) {
      const last = runs[runs.length - 1];
      if (last && addDays(last.end, 1) === day) {
        last.end = day;
        last.length += 1;
      } else runs.push({ start: day, end: day, length: 1 });
    });
    return runs;
  }

  function weeklyHours(entries, start) {
    const end = addDays(start, 6);
    return entries.reduce(function (total, entry) {
      return total + (entry.dayKey >= start && entry.dayKey <= end ? entry.hours : 0);
    }, 0);
  }

  function readableHours(hours) {
    return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  }

  function intersects(entry, first, last) {
    return entry.start < dateNumber(addDays(last, 1)) && entry.end > dateNumber(first);
  }

  function timeOffInterval(record) {
    if (!record || typeof record !== "object") return null;
    const start = dateNumber(record.startDate), last = dateNumber(record.endDate);
    if (!Number.isFinite(start) || !Number.isFinite(last) || last < start) return null;
    if(record.allDay===false || record.startTime!==undefined || record.endTime!==undefined) {
      const from=start+timeNumber(record.startTime),to=last+timeNumber(record.endTime);
      if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from)return null;
      return {start:from,end:to};
    }
    return { start, end: last + DAY };
  }

  function getTimeOffConflicts(rules, span) {
    if (!span || !Array.isArray(rules.timeOff)) return [];
    return rules.timeOff.filter(function (record) {
      const away = timeOffInterval(record);
      return away && span.start < away.end && span.end > away.start;
    });
  }

  function getWarnings(model, first, last, suppliedEntries) {
    const entries = suppliedEntries || buildEntries(model);
    const warnings = [];
    const weeks = weeksInRange(first, last, model.weekStart);
    model.caregivers.forEach(function (caregiver) {
      const id = caregiver.id, name = caregiver.name;
      const rules = model.rules[id] || {};
      const availableDays = Array.isArray(rules.availableDays) ? rules.availableDays : WEEKDAYS;
      const allowedShifts = Array.isArray(rules.allowedShifts) ? rules.allowedShifts : [];
      const maxHours = Number(model.maxHours[id]) > 0 ? Number(model.maxHours[id]) : 50;
      const minRest = Math.max(0, Number(rules.minRestHours) || 0);
      const personEntries = entries.filter(function (entry) { return entry.caregiverId === id; });
      const valid = personEntries.filter(function (entry) { return !entry.invalid; })
        .sort(function (a, b) { return a.start - b.start || a.end - b.end; });
      function warn(code, text, extra) {
        warnings.push({ code, text, caregiverId: id, level: "high", blocking: false, keys: [], ...extra });
      }
      personEntries.forEach(function (entry) {
        if (!entry.invalid && intersects(entry, first, last)) {
          const timeOff = getTimeOffConflicts(rules, entry);
          if (timeOff.length) {
            const dates = timeOff.map(function (record) {
              return record.startTime ? record.startDate+' '+record.startTime+'–'+record.endDate+' '+record.endTime : record.startDate === record.endDate ? record.startDate : record.startDate + "–" + record.endDate;
            }).join(", ");
            warn("time-off", name + " has time off " + dates + ", overlapping " + entry.dayKey +
              " " + entry.shiftName + ". Reassign or open this shift.", { blocking: true, keys: [entry.key] });
          }
        }
        if (entry.dayKey < first || entry.dayKey > last) return;
        const label = entry.dayKey + " " + entry.shiftName;
        if (entry.invalid) {
          warn("invalid-time", name + " has invalid saved times for " + label + ".", { blocking: true, keys: [entry.key] });
          return;
        }
        const weekday = WEEKDAYS[new Date(entry.dayKey + "T00:00:00Z").getUTCDay()];
        if (!availableDays.includes(weekday)) {
          warn("unavailable", name + " is scheduled for " + label + ", but is unavailable " + weekday + ".", { keys: [entry.key] });
        }
        const window=rules.availabilityWindows?.[weekday];
        if(window) {
          const available=interval(entry.dayKey,window.start,window.end);
          if(available&&(entry.start<available.start||entry.end>available.end))warn("availability-time",name+" is scheduled for "+label+", outside their "+weekday+" availability ("+window.start+"–"+window.end+").",{keys:[entry.key]});
        }
        if (allowedShifts.length && !allowedShifts.includes(entry.shiftName)) {
          warn("shift-rule", name + " is scheduled for " + label + ", but that shift is not allowed.", { keys: [entry.key] });
        }
      });
      valid.forEach(function (a, index) {
        for (let next = index + 1; next < valid.length; next += 1) {
          const b = valid[next], rest = (b.start - a.end) / 60;
          if (rest >= minRest) break;
          if (!intersects(a, first, last) && !intersects(b, first, last)) continue;
          const pair = a.dayKey + " " + a.shiftName + " and " + b.dayKey + " " + b.shiftName;
          if (rest < 0) {
            warn("overlap", name + " has overlapping shifts: " + pair + ".", { blocking: true, keys: [a.key, b.key] });
          } else {
            warn("rest", name + " has " + readableHours(rest) + " hours off between " + pair +
              "; their minimum is " + readableHours(minRest) + " hours.", { keys: [a.key, b.key] });
          }
        }
      });
      const days = workedDays(valid);
      const maxDays = Math.max(0, Number(rules.maxConsecutiveDays) || 0);
      if (maxDays) consecutiveRuns(days).forEach(function (run) {
        if (run.length > maxDays && run.start <= last && run.end >= first) {
          warn("consecutive", name + " works " + run.length + " consecutive days (" + run.start + "–" +
            run.end + "); their maximum is " + maxDays + ".", { level: "medium", range: run });
        }
      });
      weeks.forEach(function (week) {
        const hours = weeklyHours(valid, week);
        if (hours > maxHours) {
          warn("hours", name + " is " + readableHours(hours - maxHours) + " hours over their " +
            readableHours(maxHours) + "-hour limit for the week of " + week + ".", { week });
        } else if (hours > 0 && hours >= Math.max(0, maxHours - 5)) {
          warn("near-hours", name + " is near their " + readableHours(maxHours) +
            "-hour limit for the week of " + week + ".", { level: "medium", week });
        }
        if (rules.needsTwoConsecutiveDaysOff) {
          let hasBreak = false;
          for (let offset = 0; offset < 6; offset += 1) {
            if (!days.has(addDays(week, offset)) && !days.has(addDays(week, offset + 1))) hasBreak = true;
          }
          if (!hasBreak) warn("days-off", name + " does not have two consecutive days off in the week of " +
            week + ".", { level: "medium", week });
        }
      });
    });
    return warnings;
  }

  function evaluate(model, proposal) {
    const caregiver = model.caregivers.find(function (person) { return person.id === proposal.caregiverId; });
    const span = interval(proposal.dayKey, proposal.start, proposal.end);
    if (!caregiver || !span) return null;
    const key = proposal.dayKey + "-" + proposal.shiftName;
    const remaining = buildEntries(model).filter(function (entry) {
      return entry.key !== key && entry.key !== proposal.sourceKey;
    });
    const entry = {
      key, caregiverId: caregiver.id, dayKey: proposal.dayKey, shiftName: proposal.shiftName,
      startTime: proposal.start, endTime: proposal.end, invalid: false, ...span,
    };
    const entries = remaining.concat(entry);
    const warnings = getWarnings(model, proposal.dayKey, dateKey(span.end - 1), entries)
      .filter(function (warning) {
        if (warning.caregiverId !== caregiver.id || warning.code === "near-hours") return false;
        if (warning.keys.length) return warning.keys.includes(key);
        if (warning.range) {
          return warning.range.start <= dateKey(span.end - 1) && warning.range.end >= proposal.dayKey;
        }
        return warning.week === weekStart(proposal.dayKey, model.weekStart) ||
          (warning.code === "days-off" && warning.week === weekStart(dateKey(span.end - 1), model.weekStart));
      });
    const week = weekStart(proposal.dayKey, model.weekStart);
    const currentHours = weeklyHours(remaining.filter(function (item) { return item.caregiverId === caregiver.id; }), week);
    const maxHours = Number(model.maxHours[caregiver.id]) > 0 ? Number(model.maxHours[caregiver.id]) : 50;
    return {
      caregiverId: caregiver.id, caregiverName: caregiver.name,
      currentHours, projectedHours: currentHours + span.hours, maxHours,
      conflicts: warnings.map(function (warning) { return warning.text; }),
      checks: warnings.length ? [] : ["Fits availability, time off, shift, rest, and consecutive-day rules"],
      warnings, blocked: warnings.some(function (warning) { return warning.blocking; }),
      safe: warnings.length === 0,
    };
  }

  return { dateNumber, timeNumber, addDays, interval, weekStart, buildEntries, workedDays, weeklyHours,
    timeOffInterval, getTimeOffConflicts, getWarnings, evaluate };
});
