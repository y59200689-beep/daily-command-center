# Daily Command × ClickUp 4.0 reference

## Scope and source record

This is a structural reference, not a request to reproduce ClickUp branding, logos, copy, assets, or product-only features. Observations were made on 2026-09-20 from public official pages. Mobbin was checked during this task; its connected account requires a paid plan, so no Mobbin material was used.

| Source | Observed characteristics | Daily Command use |
| --- | --- | --- |
| [ClickUp 4.0](https://clickup.com/v4) | White, precise product framing; compact control shapes; prominent but restrained typography; interface imagery demonstrates a rail plus contextual navigation and dense task surfaces. | Overall visual restraint, neutral canvas, purple interaction accent, compact controls. |
| [Intro to ClickUp 4.0](https://help.clickup.com/hc/en-us/articles/31142608907543-Intro-to-ClickUp-4-0) | Public documentation explicitly describes a persistent vertical Global Navigation, a contextual Home Sidebar, updated Hubs with sidebars, a personal task surface, and a redesigned task side panel. | Two-level application shell, contextual area navigation, Today/Home grouping, detail-page affordances. |
| [List view vs Board view](https://help.clickup.com/hc/en-us/articles/6310314670359-List-view-vs-Board-view) | List and board views are treated as task working surfaces rather than dashboard decorations. | Existing list/table and content workflow presentation; horizontal board overflow only where current functionality provides it. |
| [Task layouts](https://help.clickup.com/hc/en-us/articles/29665520762647-Task-layouts) | Task work is centered on the record, with secondary context in a right-side area rather than competing cards. | Existing record detail routes and modal/drawer conventions. |
| [My Tasks](https://help.clickup.com/hc/en-us/articles/31007956275863-My-Tasks) | A personalized starting point emphasizes assigned work, today/overdue work, and agenda planning. | `/today`, `/tasks`, `/calendar`, `/inbox`. |
| [Dashboards](https://clickup.com/blog/powerful-new-dashboards/) and [card layout](https://help.clickup.com/hc/en-us/articles/34275916892951-Move-and-resize-cards-on-Dashboards) | Reusable cards have clear titles and support information density without visual noise. | Analytics, finance, growth, executive, team, commerce, and operations surfaces. |

## Observed shell grammar

1. **Global rail:** fixed slim left column for major application areas. Its job is switching context, not presenting every destination.
2. **Contextual sidebar:** a second, denser navigation column changes with the selected area and contains grouped, collapsible destinations. The public help article names this pattern Global Navigation plus Home/Spaces Sidebar.
3. **Compact header:** a persistent working header has breadcrumb/context, centered global search, and immediate actions. It is a utility strip, not a marketing navigation bar.
4. **Working canvas:** page content begins below the header with a quiet canvas; borders, grouped rows, and shallow tinted surfaces establish hierarchy before cards or shadows.

## Translation into Daily Command

| ClickUp pattern | Daily Command implementation |
| --- | --- |
| Global Navigation | 60px rail for Home, Plan, Business, Operate, Intelligence, Personal, and Settings. |
| Home/Spaces Sidebar | 248px contextual sidebar whose groups are selected from the real current route; it does not invent data hierarchy. |
| Hubs | Existing Daily Command modules remain their own routes but share one shell, page header, toolbar, table, modal, and state treatment. |
| My Tasks | Today, Inbox, Tasks, and Calendar remain top-level work destinations. |
| Dense lists | Existing tables/lists keep their actions and data bindings, now using neutral headers, row separators, purple selected state, and intentional table overflow. |
| Task details | Existing dynamic detail routes and modal workflows remain the source of truth; no fabricated activity/comment panels are added. |

## Token direction

- Canvas `#F7F8FA`, surface `#FFFFFF`, hover `#F1F2F5`, primary text `#202127`, secondary text `#666B76`, border `#E5E7EC`.
- Primary interaction `#6B43D6`; purple is reserved for selection, focus, and primary actions.
- Geist stays the one product type family already loaded by the application. The hierarchy is compact: page title 23–32px, body 13px, dense labels 9–11px.
- Controls use 6–8px radii; depth is mostly borders and surface contrast, with minimal shadows.

## Captured reference

The public ClickUp 4.0 landing page was captured in the in-app browser during the research pass. It visually confirmed the current product’s bright neutral presentation, very high whitespace around the marketing message, and the compact visual weight of navigation and controls. The screenshot remains in the browser session; no proprietary assets were copied into this repository.
