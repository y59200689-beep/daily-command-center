---
version: alpha
colors:
  canvas: "#F4F5F1"
  surface: "#FCFCF9"
  ink: "#161815"
  muted: "#686C65"
  line: "#D9DCD3"
  attention: "#3157D5"
  success: "#387A58"
  warning: "#A46222"
  danger: "#B84438"
typography:
  display:
    fontFamily: '"Instrument Serif", Georgia, serif'
    fontSize: "4rem"
    lineHeight: "0.96"
  body:
    fontFamily: '"Geist", Arial, sans-serif'
    fontSize: "0.9375rem"
    lineHeight: "1.5"
  utility:
    fontFamily: '"Geist Mono", monospace'
    fontSize: "0.6875rem"
    lineHeight: "1.25"
rounded:
  control: "0.625rem"
  surface: "0.875rem"
  pill: "999px"
spacing:
  xs: "0.375rem"
  sm: "0.625rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2.5rem"
components:
  button:
    height: "2.5rem"
    radius: "0.625rem"
  panel:
    radius: "0.875rem"
    border: "1px solid var(--line)"
---

## Overview

Daily Command Center is a personal briefing folio for one ambitious operator. It should feel like opening a carefully edited morning edition: decisive hierarchy, calm density, and the sense that the system has already sorted signal from noise. The product register leads; the memorable signature is a vertical cobalt attention beam that connects time, priority, and the next action. Avoid generic card mosaics, glass effects, rainbow category systems, and decorative statistics.

Runtime CSS variables in `src/app/globals.css` are canonical (mapping model B). This file mirrors those semantic values and explains their use. Theme overrides preserve roles rather than literal color parity.

## Colors

Neutral canvas and paper surfaces carry nearly all of the UI. Cobalt is reserved for the selected route, the current priority, focus state, and primary action. Green means completed, ochre means waiting or approaching, and red is reserved for destructive or overdue conditions. Project colors appear only as narrow marks.

## Typography

Geist is the workhorse. Instrument Serif is used sparingly for the daily thesis and empty-state invitations; it never appears in controls or dense data. Geist Mono carries timestamps, counts, shortcuts, and ordered priority numbers.

## Layout

Desktop uses a 248px navigation rail, a fluid reading column, and a narrow context rail. Mobile is intentionally sequential: greeting, brief, first priority, next appointment, remaining priorities, waiting, capture. Breakpoints are 640px, 768px, 1024px, and 1440px; the tested targets also include 390px, 430px, and 1920px.

## Elevation & Depth

Hierarchy comes from tone, rules, and overlap rather than shadow. Floating command surfaces use one restrained shadow. Static content remains flat.

## Shapes

Controls use a 10px radius; contained surfaces use 14px. Pills belong only to status and filter chips. Large rounded rectangles are not a layout strategy.

## Components

Shared owners live in `src/components`: Button, AppShell, CommandPalette, QuickCapture, EmptyState, and domain rows. All interactive states include hover, active, visible focus, disabled, and busy behavior. The global stylesheet owns scrollbars and reduced motion.

## Do's and Don'ts

- Do lead with one clear recommendation and a credible explanation.
- Do keep task rows compact, ordered, and easy to scan.
- Do preserve line length and whitespace around editorial type.
- Don't place every datum in a bordered card.
- Don't use color without a text or icon cue.
- Don't animate stable navigation or routine re-renders.
