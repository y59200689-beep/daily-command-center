# Today mission card — design QA

final result: passed

## Source and rendered evidence

- Source: `/Users/youssefmahir/Downloads/ChatGPT Image Sep 28, 2026, 12_17_41 PM.png`, desktop mission card reference.
- Implementation: `http://localhost:3000/today`, light theme, observed in the in-app browser at desktop and 390px mobile width.
- The source depicts a populated example; the current account has no active planning period. The rendered card correctly shows a setup state and does not copy sample mission numbers or claims.

## Fidelity review

- Typography: bold near-black title, compact monospace eyebrow, muted supporting copy, and strong metric numerals follow the reference hierarchy.
- Layout: the hero art sits behind the heading and progress, followed by five translucent metric cards and a separated action row. At 390px the metrics wrap to two columns and actions stack without clipping.
- Color: lavender/white surface, vivid violet progress and primary action, and blue/orange/rose/green metric accents mirror the reference.
- Image: generated, full-resolution alpine summit artwork preserves the reference's red summit flag and quiet left-side text area. It is an individual background asset, not a rasterized screenshot of the UI.
- Copy/data: title, description, day count, progress, and metrics come from the active planning period and its recorded commitments/milestones. The empty state is intentionally different because the account has no active mission.

## Interaction and behavior

- The metric cards and action chips are keyboard-focusable links with hover lift, tooltips, and relevant destinations.
- `Create mission` navigates to Control Tower, where the user can create a planning period. This navigation was verified in the browser.
- Mission completion is an accessible progressbar with a visible percentage when commitments exist. The card refreshes after relevant workspace changes.
- `npm run build` passed. No P0/P1/P2 issues remain in the observed desktop and mobile states.
