# Master Plan: Developer Performance Analytics Visualization & IndexedDB Caching

---

## UI & CSS Constraints

- Absolutely minimal CSS: only what is strictly necessary for layout and basic usability.
- No colors, no custom fonts, no visual embellishments.
- All spacing, sizing, and layout units must be in PX, and only in multiples of 4px (e.g., 4px, 8px, 12px, 16px, etc.).
- No responsive breakpoints, no media queries, no flexbox/grid tricks unless essential for function.
- All design/visual interest will be in the data visualizations themselves, not in the layout or UI.
- Future visualizations may use Three.js or similar high-impact, framework-free libraries, but only for data display, not for layout or UI.

---

## 1. IndexedDB Caching for Instant Data Access

**Goal:**
Ensure all artifact data (including analytics data) is cached in IndexedDB. On page load, the app should instantly load from IndexedDB if data is present, falling back to remote fetch only if needed. All analytics and visualizations should run off cached data for speed.

**Steps:**
1. Audit existing IndexedDB usage in `src/db/` to understand schema and access patterns.
2. On app startup, check IndexedDB for all required artifact data. If present, load directly into memory and initialize the UI. If missing, fetch from remote, process, and store in IndexedDB, then update the UI.
3. Optimize IndexedDB schema for fast, indexed retrieval by repository and contributor. Optionally, maintain a "last updated" timestamp for cache invalidation or refresh logic.
4. Add a "refresh" or "re-import" option to force re-download if needed.
5. Show instant loading from cache and indicate when data is being fetched/refreshed in the background.

---

## 2. Data Structure Understanding & Transformation

**Raw Data Model:**
- Each artifact JSON file represents a repository.
- Top-level keys: contributor usernames.
- Each contributor object:
  - `userId`: number
  - `total`: XP earned (float)
  - `task`: { reward, multiplier }
  - `comments`: array of comment objects (with XP overviews)
  - `evaluationCommentHtml`: HTML summary (optional)

**Transformation for Analytics:**
- **Leaderboard View:** Aggregate XP totals per contributor, grouped by repository.
- **Time Series View:** For each contributor, extract XP events (from comments or tasks) and map them to a timeline (by date, if available; otherwise, by artifact or synthetic time axis).

---

## 3. Visualization UI/UX

**Overall Layout:**
Minimal, framework-free UI (HTML + CSS + TypeScript) with only essential CSS. All sizing and spacing use PX units in multiples of 4px. No colors or visual embellishments outside of the data visualizations themselves.
Main "Top Contributor" panel with:
- Contributor dropdown (select contributor)
- Toggle: Leaderboard ↔ Trend
- Time range selector (slider or date picker)
- Main chart area (dynamic: leaderboard or time series)

**Leaderboard View:**
- Horizontal stacked bar chart:
  - X-axis: XP earned
  - Y-axis: Contributor names
  - Each bar: Total XP per contributor, grouped by repository (color-coded)
  - Tooltip: Show overview by repo and XP

**Time Series View:**
- Line chart (sparkline per contributor):
  - X-axis: Time (date or synthetic axis)
  - Y-axis: XP earned (cumulative or per event)
  - Multiple lines: One per contributor (toggleable)
  - Tooltip: Show XP event details

**UI Controls:**
- Dropdown: Select contributor (or "All" for aggregate)
- Toggle: Switch between Leaderboard and Time Series
- Time range selector: Filter data by date or artifact index

**Charting Approach:**
- Use lightweight, dependency-free charting:
  - Prefer SVG or Canvas for custom charts.
  - For advanced/flashy visualizations, consider Three.js or similar high-impact, framework-free libraries, but only for data display (not layout/UI).
  - If a library is needed, use a minimal one (e.g., uPlot, Chart.js via CDN, or similar).
  - All chart rendering in TypeScript.
  - All chart sizing, padding, and positioning must use PX units in multiples of 4px.

---

## 4. Implementation Phases

**Phase 1: Data Caching & Loading**
- Refine IndexedDB logic for instant load.
- Build data transformation utilities for analytics.

**Phase 2: UI Scaffolding**
- Implement minimal UI shell with controls and chart area.
- Wire up controls to data selection logic.

**Phase 3: Visualization**
- Implement Leaderboard (horizontal bar chart).
- Implement Time Series (multi-line chart).

**Phase 4: Polish & UX**
- Add tooltips, legends, and responsive design.
- Optimize for large datasets and fast interaction.

---

## 5. File/Module Structure Proposal

- `src/db/`: IndexedDB logic (already exists)
- `src/data-transform.ts`: Data aggregation/transformation utilities
- `src/visualization/leaderboard-chart.ts`: Leaderboard chart rendering
- `src/visualization/time-series-chart.ts`: Time series chart rendering
- `src/ui/`: UI controls (dropdown, toggle, time range)
- `src/main.ts`: App entry point, orchestrates data load and UI

---

## 6. Mermaid Diagram: Data Flow & UI Structure

```mermaid
flowchart TD
    subgraph IndexedDB
        A[Artifact JSONs<br/>(per repo)]
    end
    subgraph Data Layer
        B[Data Loader<br/>(load from IndexedDB or fetch)]
        C[Data Transformer<br/>(aggregate, time series)]
    end
    subgraph UI
        D[UI Controls<br/>(dropdown, toggle, time range)]
        E[Leaderboard Chart]
        F[Time Series Chart]
    end

    A --> B
    B --> C
    C --> E
    C --> F
    D --> E
    D --> F
```

---

## 7. Risks & Considerations

- If artifact data lacks timestamps, time series will use artifact order or synthetic time.
- IndexedDB schema must be robust to support fast queries and future analytics.
- Charting must remain lightweight and performant for large datasets.

---

## 8. Next Steps

- Review and refine IndexedDB schema and loading logic.
- Implement data transformation utilities.
- Scaffold UI and visualization modules.
- Integrate and test with real artifact data.

---

This plan ensures instant, cache-backed analytics and a fast, extensible, framework-free visualization UI for developer performance insights.
