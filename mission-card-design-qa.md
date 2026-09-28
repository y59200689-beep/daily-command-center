# Today mission card — design QA

The mission card now uses the reference's Phase 1 sales objective, five metric labels and goals, three daily action goals, quote, and “Open Mission” action. The current counts and progress are calculated from saved workspace records rather than the example values in the image. The 10,000 MAD revenue objective is converted to a USD display target using that day's exchange rate, consistent with the site's USD reporting preference.

The reference's “Day 4 / 30” is represented as “30-day mission” because there is no recorded start date for this specific sales mission. Meetings are counted from opportunities that reached the meeting stage or later; video audits are counted from completed tasks whose title contains “video audit.” These definitions should be revisited if the app gets dedicated mission tracking.

Verified in the in-app browser at `/today`: the title, description, metric cards, current values, action chips, quote, and navigation render. TypeScript and scoped ESLint pass. A production build could not finish because the local disk reported `ENOSPC` while writing `.next` cache; the browser's development build rendered the change.
