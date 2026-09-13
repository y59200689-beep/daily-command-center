# Daily Command Center redesign research

Research date: 2026-09-12

## Source access

The `mobbin` MCP server is installed and authenticated at `https://api.mobbin.com/mcp`, but its tools were not exposed to the active Codex task after installation. No Mobbin screen is claimed as inspected. The implementation continued with the following accessible official product references; reconnecting or reopening the task should expose Mobbin for a later comparative pass.

## Visible reference evidence and project inference

| Reference | What the source visibly documents | Design inference applied here |
| --- | --- | --- |
| [Slack sidebar preferences](https://slack.com/help/articles/212596808-Adjust-your-sidebar-preferences) | A small navigation bar holds stable primary destinations while the sidebar contains scoped sections. | Keep six everyday destinations permanently visible; move the long tail into four expandable workspaces. |
| [Slack Activity view](https://slack.com/help/articles/46751260742035-Introducing-the-new-Activity-view-in-Slack) | Dense/detailed layouts, saved filter views, bulk clearing, and keyboard actions support notification triage. | Make Inbox a dedicated triage queue with explicit Organize and Clear actions instead of a generic record page. |
| [Notion database views, filters, sorts, and groups](https://www.notion.com/help/views-filters-and-sorts) | The same data can be presented as tables, boards, timelines, calendars, or lists; entries can open in side peek while the source view remains present. | Use domain-appropriate surfaces and keep edit context over the list rather than forcing every domain into one layout. |
| [Notion database fundamentals](https://www.notion.com/help/what-is-a-database) | Rows remain detail pages and properties provide scan-level context; search, filters, and sort change the view of the same source. | Keep project/detail relationships intact while surfacing status, priority, due dates, and progress in the collection view. |
| [Monday board views](https://support.monday.com/hc/en-us/articles/360001267945-The-board-views) | Boards expose multiple purpose-specific views directly under the board title. | Put view switching beside dataset controls, not in a separate settings page. |
| [Monday mobile board views](https://support.monday.com/hc/en-us/articles/360015740220-Mobile-app-board-views) | Calendar items remain visual on mobile and filters remain available from the view. | Preserve a calendar-specific mobile agenda rather than shrinking the desktop month grid. |
| [ClickUp views control bar](https://help.clickup.com/hc/en-us/articles/35368731425175-The-views-control-bar) | Group, columns, filter, assignee, search, and customization occupy one compact view-control bar. | Consolidate search, status, priority, counts, and view switching into one restrained toolbar. |
| [ClickUp task filters](https://help.clickup.com/hc/en-us/articles/6310206119575-Filter-and-search-tasks-in-List-view) | Status, priority, due date, assignee, and other task properties are first-class filters. | Implement the filters supported by the actual task schema—status and priority—without inventing assignees or tags. |
| [ClickUp mobile Calendar](https://help.clickup.com/hc/en-us/articles/7255373717143-Use-Calendar-view-on-mobile) | Day, week, month, work-week, and chronological schedule timescales are available; connected external events remain visible. | Use month on desktop and agenda/schedule on mobile while preserving existing Google Calendar sync/conflict behavior. |
| [ClickUp task right sidebar](https://help.clickup.com/hc/en-us/articles/35041742373015-Tasks-right-sidebar) | Task context such as relationships, activity, references, and integrations stays adjacent to the task. | Preserve contextual edit/detail overlays and existing related records instead of replacing them with isolated pages. |

## Direction

The result is a neutral, indigo-accented workbench: compact shell, fixed everyday destinations, purpose-built views, quiet surfaces, clear status semantics, and a narrow attention rail. It intentionally avoids borrowing Slack purple chrome, Monday's multicolor board language, Notion's document aesthetic, or ClickUp's visual density wholesale.
