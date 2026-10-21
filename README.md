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
- Full-day dated time off, additional/split shifts, and recurring weekly series
- Required-care gap reports separate from the Brief, hours and CSV export
- Automatic weekly caregiver briefs that recalculate hours, assignments and warnings after edits; written notes remain separate
- Full headline at the top, smoothly collapsing its space after scrolling so the controls and schedule move up; compact calendar cards open the dated editor on click and keep their own height when another day has more shifts
- Validated backups, pre-import recovery, recent local history, Help and support diagnostics
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
2. Open `index.html` in a modern browser.

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
- Default-time changes preserve existing assigned occurrences. New dated edits and copied weeks retain their explicit times.
- **Undo** and **Redo** restore up to 30 schedule changes during the current page session. They include assignments, dated times, templates, caregiver rules/profiles, and bulk paste/clear actions. Navigation and weekly brief text are outside schedule history. Reloading or importing a backup resets history.
- Set an optional minimum rest period under caregiver rules. Its default is 0 (disabled). Availability applies to the day a shift starts. Consecutive-day and two-days-off checks include every day touched by overnight work.

Hours remain scheduled wall-clock hours allocated to the week in which the shift starts. They are not attendance or elapsed-time payroll calculations. Equal start/end times mean 24 hours. **Shifts filled** measures configured shift hours assigned, not continuous coverage; configure the daily required-care interval and staffing count in Reports to measure gaps.

Time off currently covers full days. Copy/paste is template-oriented and does not create missing additional slots at the destination. Changing template style can hide inactive-template assignments; back up and review affected dates. Local history is bounded and is not a tamper-proof audit trail.

Team edits require explicit sync, not live collaboration. Stale saves are rejected: export unsynced work before loading the latest draft. Approved requests still require publication. Swap approval records the manager's confirmation of coworker agreement, not independent digital consent. Email needs an HTTPS relay; `accepted` means relay acceptance, not inbox delivery. SMS and push are not implemented. Do not rely solely on notifications for urgent coverage coordination.

## Development checks

No build or dependency installation is required. With Node.js 24 or newer:

```sh
npm test
npm run check
```

The suite covers scheduling calculations, isolated browser-state transitions, and real HTTP API requests against temporary databases. It does not verify browser rendering, touch interaction, VoiceOver, regulatory compliance, or production availability. Complete the review checklist before merging.

Use Help for setup steps, sample data in an empty workspace, recovery, and support diagnostics. Never attach real caregiver names, care notes, schedules, backups, passwords or invitation links to public GitHub issues.

