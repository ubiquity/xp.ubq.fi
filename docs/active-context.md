# Active Context: Application Development & Insight Documentation

## 1. Recent Changes

*   **Architecture:** Shifted artifact unzipping to client-side (`fflate`) due to Deno Deploy limits; backend is now solely an auth proxy. Frontend handles direct artifact downloads (`final-aggregated-results.zip`) and processing.
*   **Data Handling:** Implemented data transformation for the aggregated artifact format (`aggregated_results.json` -> `OrgRepoData`).
*   **Dev Tools:** Refactored dev mode widget instantiation. Retained fallback logic for dev tools as an exception.
*   **Documentation:**
    *   Updated existing docs to reflect architectural changes.
    *   Initiated documentation for "Engineering Manager Performance Insights":
        *   Created `docs/project-brief.md` (merged).
        *   Created `docs/product-context.md` (merged).
        *   Created `docs/system-patterns.md` (merged).
        *   Created `docs/tech-context.md` (merged).
        *   Created `docs/active-context.md` (this file, merged).

## 2. Current Focus

*   **Application Development:**
    *   Maintaining the minimal, framework-free frontend.
    *   Ensuring performant JS-based unzipping and JSON parsing.
    *   Keeping the auth proxy lightweight.
    *   Implementing robust error handling for the artifact processing pipeline.
    *   Supporting direct GitHub artifact downloads (`archive_download_url`).
    *   Maintaining efficient IndexedDB storage patterns.
    *   Implementing developer performance analytics visualizations (leaderboard, time series).
*   **Insight Documentation:**
    *   Completing the initial set of core documentation files (`docs/progress.md` remaining).
    *   Ensuring documentation accurately reflects how insights can be derived from the `rawData` structure.

## 3. Next Steps

*   **Application Development:**
    *   Enhance UI feedback and progress indicators for download/unzip/parse operations.
    *   Implement comprehensive testing for JS unzip/parse.
    *   Build leaderboard and time series views for contributor XP analytics.
    *   Refine IndexedDB caching strategy for instant analytics UI.
*   **Insight Documentation:**
    *   Create `docs/progress.md` (merged content).
    *   Review all documentation for clarity and consistency.
    *   Present the completed documentation set.

## 4. Blockers

*   None currently.

## 5. Active Decisions & Considerations

*   **Tech Stack:** Focus remains on Bun + TypeScript + esbuild + browser APIs + `fflate`.
*   **Architecture:** Minimal dependencies, simple architecture, client-side processing focus.
*   **Analytics:** All visualizations run off IndexedDB-cached data.
*   **UI:** Framework-free, minimal CSS, 4px grid, visualization-focused design.
*   **Insight Documentation:** Based solely on `rawData` structure, assumes source system scoring is valid, documentation phase only (no implementation).
*   **Dev Tools Exception:** Fallback/defensive logic is permitted in developer tools.
