# Enhancement review and release gates

This branch implements the approved roadmap as a review build. **Implemented does not mean device-verified or production-ready.** Keep the pull request in draft until integration review passes. The live Pages site remains unchanged until merge/deployment.

## How to review

1. Use the pull request's **Files changed** tab to review code. Download/check out its branch and serve the frontend locally in a separate browser profile to try it.
2. Use fictitious data only. In an empty workspace, Help → Try sample data provides a starting point.
3. For team features follow [server/DEPLOYMENT.md](server/DEPLOYMENT.md); use separate manager/caregiver browser profiles.
4. Record device/OS/browser version, results, and screenshots without private data. Report failures on the pull request. Unit tests alone are not merge approval.

## Approved roadmap status

| Items | Draft implementation | Remaining gate |
| --- | --- | --- |
| 1–4: media queries, navigation, agenda, tablet layouts | Primary responsive layer, text navigation, agenda, tablet breakpoints | Browser rendering, portrait/landscape, actual Split View |
| 5–9: targets, dialogs, VoiceOver, keyboard, contrast/zoom/motion | Larger controls, names/status, managed focus, reorder buttons, focus/contrast/motion rules | Measured contrast and keyboard/VoiceOver/zoom audit; not certified |
| 10: real-device testing | Checklist prepared | Actual iPhone/iPad tests not performed |
| 11–12: time off and care gaps | Full-day intervals, overnight conflicts, distinct-caregiver coverage | UI workflow verification |
| 13–14: recurrence and extra/split shifts | Weekly series, future edits, dated slots, overnight split | Browser integration; additional-slot copy/paste remains limited |
| 15–16: warnings and filters | Review-shift actions and agenda filters | Browser/accessibility verification |
| 17–18: recovery and reports | Validated atomic backups, pre-import copy, hours/CSV/print separate from Brief | Recovery/export/print UI review |
| 19–20: accounts/sync/publication | Roles, invitation/password sessions, revision protection, private drafts | Hosting, persistence, independent security review |
| 21–22: My shifts and requests | Acknowledgments, time-off/callout/claim/swap, manager approval | Two-user end-to-end review; swap agreement is manager-confirmed |
| 23: notifications | Inbox, preferences, email relay/retries/status, reminders | Relay/provider setup and DST/delivery testing; no SMS/push |
| 24: history | Recent local actions, persistent server actions/publication diffs | Retention policy, richer draft field-level history, operator recovery |
| Support | Help, setup progress, sample data, diagnostics, release notes | User feedback and support ownership |

## Local workflow checks

- [ ] Load old data, export, reload, verify assignments/rules remain intact.
- [ ] Attempt an overnight/next-morning overlap; rejection must preserve both assignments.
- [ ] Add time off intersecting a previous-night shift; review the warning and reassign.
- [ ] Create recurrence; edit one then future occurrences; undo and redo.
- [ ] Add/move an extra shift; reject a destination-name collision without losing the source.
- [ ] Split overnight after midnight; confirm dates and total scheduled hours.
- [ ] Create a care gap while all configured shifts are filled; verify Reports detects it.
- [ ] Search/filter, clear filters, navigate weeks/months, review all panels.
- [ ] Export CSV and print Reports; check dates, totals, columns, and formula-like names.
- [ ] Import valid/malformed backups, cancel, restore pre-import copy, and test storage failure recovery.
- [ ] Watch the browser console for uncaught errors throughout.

## Device/accessibility checks — all pending

- [ ] iPhone Safari, small/large screens, portrait/landscape, safe areas, keyboard open in each modal; reachable Save/Cancel.
- [ ] iPad Safari, portrait/landscape, narrow/wide Split View, touch and hardware keyboard.
- [ ] Desktop Safari/Chrome/Firefox: weekly/monthly/agenda and all navigation panels.
- [ ] VoiceOver: meaningful names, selected navigation, errors/status, logical reading order.
- [ ] Keyboard: focus visibility, modal Tab/Shift+Tab/Escape and return focus, reorder without drag, shortcuts do not intercept text editing.
- [ ] 200%/400% zoom and larger text: usable reflow, dense-calendar scrolling contained.
- [ ] Measure contrast and touch targets; test reduced-motion settings.

## Team workflow checks

- [ ] Caregiver cannot see unpublished draft changes or manager data.
- [ ] Two manager sessions: stale sync fails without overwriting the server.
- [ ] Publish, acknowledge, change/re-publish; acknowledgment becomes pending again.
- [ ] Remove a published extra shift; former caregiver receives cancellation notification.
- [ ] Requests revalidate on approval; duplicate decisions fail; publication remains separate.
- [ ] Verify private requests/server/database files remain inaccessible to other users.
- [ ] Test invitation expiry/single-use, recovery session revocation, sign-out, restart persistence.
- [ ] Test email opt-in/out, retries, relay acceptance versus actual delivery, reminders and DST.
- [ ] Full database backup/restore and rollback drill on isolated infrastructure.

## Automated evidence and remaining work

Run `npm test`, `npm run check`, and `git diff --check`. Tests use fictitious data, isolated state stubs, and temporary HTTP databases. They do not cover real browser lifecycle, CSS layout, assistive technology, or real delivery.

Before broad rollout: additional-shift copy/paste and template-style migration safeguards; richer draft change details and server recovery UI; offboarding/MFA/recovery policy; request-abuse limits; retention controls; security/privacy review; formatting/module cleanup. Decide separately whether partial-day time off, richer recurrence, digital coworker consent, SMS/push, or attendance/payroll integration belong in the next release.
