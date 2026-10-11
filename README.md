# Curavela

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
- Explore a future backend for account-based storage and multi-user scheduling.

## Scheduling reliability and dated editing

- The weekly calendar and Coverage Assistant share overlap, availability, rest, consecutive-day, and weekly-limit checks. Overlapping assignments are blocked; other rule warnings require confirmation.
- Weekly limits are evaluated for every calendar week intersecting a monthly view, including the days outside a partial first or last week.
- Use **Schedule Shift** or **Edit shift** to assign an existing template on a date, adjust only that occurrence's times, or move its assignment. Moving opens the original slot. This version does not add extra independent slots or split shifts.
- Default-time changes preserve existing assigned occurrences. New dated edits and copied weeks retain their explicit times.
- **Undo** and **Redo** restore up to 30 schedule changes during the current page session. They include assignments, dated times, templates, caregiver rules/profiles, and bulk paste/clear actions. Navigation and weekly brief text are outside schedule history. Reloading or importing a backup resets history.
- Set an optional minimum rest period under caregiver rules. Its default is 0 (disabled). Availability applies to the day a shift starts. Consecutive-day and two-days-off checks include every day touched by overnight work.

Hours remain scheduled wall-clock hours and are allocated to the week in which the shift starts, using the selected week-start day. They are not elapsed-time payroll calculations. Equal start/end times mean a 24-hour shift. The **Shifts filled** percentage measures configured shift hours assigned, not continuous care coverage; a required-care timeline remains future work.

## Development checks

No build or dependency installation is required. With Node.js 18 or newer:

```sh
npm test
npm run check
```

The automated suite covers scheduling rules and application state transitions using isolated DOM/storage stubs. It does not replace real browser validation. Before merging this milestone, check the dated editor in weekly/monthly views, modal focus and keyboard shortcuts, and the layout on a phone.

