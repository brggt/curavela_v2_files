const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "editing.js"), "utf8");
const start = source.indexOf("function findDialogReturnFocus(modal)");
const end = source.indexOf("\nfunction updateOccurrenceDuration()", start);
assert.ok(start >= 0 && end > start, "focus restoration helpers must exist");
const helpers = source.slice(start, end);

function fixture(previous, renderedButtons = [], selected = {day: "2026-11-01", shift: "Morning"}) {
  const focused = [];
  const appShell = { inert: true };
  const modal = { classList: { add(name) { assert.equal(name, "hidden"); } } };
  const quickAdd = { isConnected: true, focus(options) { focused.push(["quick add", options]); } };
  const context = {
    dialogReturnFocus: new WeakMap([[modal, previous]]),
    occurrenceModal: modal,
    occurrenceDate: { value: selected.day },
    occurrenceShift: { value: selected.shift },
    quickAddShiftButton: quickAdd,
    document: {
      querySelector(selector) {
        if (selector === ".app-shell") return appShell;
        if (selector === ".modal-backdrop:not(.hidden)") return null;
        throw new Error("unexpected selector " + selector);
      },
      querySelectorAll(selector) {
        assert.equal(selector, ".edit-occurrence-button");
        return renderedButtons;
      },
    },
  };
  vm.runInNewContext(helpers, context);
  return { modal, appShell, focused, close() { vm.runInNewContext("closeManagedDialog(occurrenceModal)", context); } };
}

function editButton(day, shift, isConnected = true, focused = []) {
  return {
    isConnected,
    dataset: { day, shift },
    classList: { contains(name) { return name === "edit-occurrence-button"; } },
    focus(options) { focused.push(options); },
  };
}

test("saving a shift restores focus to the newly rendered edit button", () => {
  const original = editButton("2026-11-01", "Morning", false);
  const focusCalls = [];
  const replacement = editButton("2026-11-01", "Morning", true, focusCalls);
  const f = fixture(original, [replacement]);
  f.close();
  assert.equal(f.appShell.inert, false);
  assert.equal(f.focused.length, 0, "must not jump to the quick-add control");
  assert.equal(focusCalls.length, 1);
  assert.equal(focusCalls[0].preventScroll, true);
});

test("moving a shift focuses its new date instead of the old date", () => {
  const original = editButton("2026-10-31", "Night", false);
  const oldButton = editButton("2026-10-31", "Night", true);
  const focusCalls = [];
  const newButton = editButton("2026-11-01", "Night", true, focusCalls);
  const f = fixture(original, [oldButton, newButton], {day:"2026-11-01",shift:"Night"});
  f.close();
  assert.equal(focusCalls.length, 1);
  assert.equal(focusCalls[0].preventScroll, true);
});

test("canceling an edit keeps focus on the existing connected trigger", () => {
  const calls = [];
  const original = editButton("2026-11-01", "Morning", true, calls);
  const f = fixture(original);
  f.close();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].preventScroll, true);
  assert.equal(f.focused.length, 0);
});

test("deleted or unavailable shift triggers fall back without scrolling to the top", () => {
  const original = editButton("2026-10-31", "Night", false);
  const f = fixture(original, []);
  f.close();
  assert.equal(f.focused.length, 1);
  assert.equal(f.focused[0][0], "quick add");
  assert.equal(f.focused[0][1].preventScroll, true);
});
