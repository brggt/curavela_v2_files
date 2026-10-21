# Curavela

> This branch is an enhancement **review build**, not a production-ready care or payroll system. See [REVIEW_CHECKLIST.md](REVIEW_CHECKLIST.md) for device, accessibility, integration, and release gates. Team setup is in [server/DEPLOYMENT.md](server/DEPLOYMENT.md).

Curavela is a caregiving scheduling web app designed to make weekly and monthly staffing easier to understand. It brings caregiver availability, shift coverage, hour limits, open shifts, and schedule warnings into one workspace.

## Live Demo

**Demo:** https://brggt.github.io/curavela_v2_files/

## Current Features

- Weekly and monthly schedule views
- Week and month navigation
- Caregiver management
- Editable shift times
- Coverage and open-shift views
- Caregiver hour tracking and schedule warnings
- Copy/paste and schedule-management tools
- Responsive interface for different screen sizes
- Local browser-based scheduling workflow
- Searchable agenda, mobile navigation labels, responsive layouts, keyboard focus and non-drag caregiver reordering
- Full-day or timed time off, weekly availability windows, additional/split shifts, and recurring weekly series
- Required-care gap reports separate from the Brief, hours and CSV export
- Automatic weekly caregiver briefs that recalculate hours, assignments and warnings after edits; written notes remain separate
- Full headline at the top, smoothly collapsing its space after scrolling so the controls and schedule move up; compact calendar cards open the dated editor on click and keep their own height when another day has more shifts
- Saved 1-, 2-, and 4-week patterns with destination previews and one-step undo
- Per-shift notes in the dated editor, Agenda, Brief, and published My shifts
- Validated backups, pre-import recovery, before/after history and 10 recent local recovery copies
- Calendar downloads for the selected dates; private, revocable subscriptions for signed-in caregivers
- Installable home-screen app with a static offline shell and explicit local/team/unsynced status
- Help, setup instructions and support diagnostics
- Optional Node/SQLite team server with accounts, explicit draft sync, publication, My shifts, acknowledgments, requests and notification preferences

GitHub Pages runs **local mode only**. It shows the merged version, not an unmerged review branch. Accounts, shared schedules and email require a separate hosted server; they are not activated by this pull request.

## Technologies Used

- HTML5
- CSS3
- JavaScript
- Local browser storage and DOM APIs
- Git and GitHub
- GitHub Pages

## How to Run Locally

1. Clone this repository.
2. Run `python -m http.server 8000` in the repository folder.
3. Open `http://localhost:8000` in a separate browser profile with sample data. A local HTTP server is needed for service-worker checks; real installation testing uses HTTPS.

## Plans for Improvement

- Continue simplifying scheduling workflows and reducing unnecessary steps.
- Improve accessibility and keyboard navigation.
- Expand validation around coverage, caregiver limits, and schedule conflicts.
- Continue testing across browsers and screen sizes.
- Refine mobile layouts and performance as the app grows.
- Complete integration, security and deployment review of the optional team backend.

## Scheduling reliability and dated editing

- The weekly calendar and Coverage Assistant share overlap, availability, rest, consecutive-day, and weekly-limit checks. Overlapping assignments are blocked; other rule warnings require confirmation.
- Weekly limits are evaluated for every calendar week intersecting a monthly view, including the days outside a partial first or last week.
- Use **Schedule Shift** or **Edit shift** for dated assignments. **Add / repeat shifts** adds independent dated slots or series every 1, 2, or 4 weeks, up to 52 occurrences. An existing shift can be split, including after midnight. Series edits support one occurrence or this and future occurrences; move dates individually.
- Default-time changes preserve existing assigned occurrences. Shift-style changes and custom-template removal keep dated work. Version 7 backups recover older hidden assignments when their times are known and reject unknown times rather than guessing.
- Copy/paste carries extra dated slots, explicit times, and notes to the destination. **More → Saved patterns** captures 1, 2, or 4 weeks, then previews up to 12 cycles before applying. Matching slots are replaced; unrelated shifts are kept. Missing caregiver profiles become visibly flagged Open slots in the preview.
- Notes follow moves, copies, splits and recurring edits. Calendar exports and subscription feeds exclude notes. A published note is visible only to the assigned caregiver and managers.
- **Undo** and **Redo** restore up to 30 schedule changes during the current page session. They include assignments, dated times, templates, caregiver rules/profiles, and bulk paste/clear actions. Navigation and weekly brief text are outside schedule history. Reloading or importing a backup resets history.
- Set an optional minimum rest period under caregiver rules. Its default is 0 (disabled). Availability applies to the day a shift starts. Consecutive-day and two-days-off checks include every day touched by overnight work.

Hours remain scheduled wall-clock hours allocated to the week in which the shift starts. They are not attendance or elapsed-time payroll calculations. Equal start/end times mean 24 hours. **Shifts filled** measures configured shift hours assigned, not continuous coverage; configure the daily required-care interval and staffing count in Reports to measure gaps.

Time off can cover inclusive full dates or exact start/end times. For overnight timed time off, use the following end date. Weekly availability windows are preferences by the day a shift starts; a shift must fit entirely inside its window to avoid a warning. Actual time-off intersections remain blocking.

Reports includes readable changes and up to 10 local versions saved before edits. Team includes up to 100 draft revisions, a change preview, and manager-only restoration with stale-revision protection. Restoring a team draft does not publish it. History is bounded; local history is not a tamper-proof audit trail.

Team edits require explicit sync, not live collaboration. Stale saves are rejected: export unsynced work before loading the latest draft. Approved requests still require publication. Swaps require the requested coworker to accept from their own account, followed by manager approval; both shifts and availability are rechecked. Email needs an HTTPS relay; `accepted` means relay acceptance, not inbox delivery. SMS and push are not implemented. Do not rely solely on notifications for urgent coverage coordination.

## Calendar and offline behavior

Reports → Export to Calendar downloads a one-time `.ics` file after confirming the care-location IANA time zone. Team → Calendar subscription creates a private URL for the signed-in caregiver's published shifts. Creating a replacement disables the old URL; revoking it stops future access. Previously downloaded events may remain in the calendar client. Reassignments/removals publish cancellation events with stable IDs. Client refresh intervals vary; calendar delivery has not been verified against Apple, Google, or Outlook yet.

Calendar times use the care location's zone and convert to UTC. DST folds choose the first occurrence; gaps use the pre-transition offset, consistent with RFC 5545. A shift whose end becomes earlier than its start after conversion must be corrected before export/publication. Planned hours remain wall-clock hours.

The service worker caches only explicitly listed static app files. It does not cache API responses, private calendar links, accounts, or team schedules. Local data stays in browser storage. Team edits require an open page until synced; they are not queued for replay. Save/export before closing when unsynced. Updates activate after all old tabs close. Bump `VERSION` in `sw.js` for every release. An installed app may have separate storage from the browser, so export a backup before switching.

## Development checks

No build or dependency installation is required. With Node.js 24 or newer:

```sh
npm test
npm run check
```

The suite covers scheduling calculations, isolated browser-state transitions, and real HTTP API requests against temporary databases. It does not verify browser rendering, touch interaction, VoiceOver, regulatory compliance, or production availability. Complete the review checklist before merging.

Use Help for setup steps, sample data in an empty workspace, recovery, and support diagnostics. Never attach real caregiver names, care notes, schedules, backups, passwords or invitation links to public GitHub issues.

