# Product Context: Developer Analytics Frontend & Manager Insights

## 1. Why This Project Exists

This project addresses two primary needs:

1.  **For Developers:** The need for a **minimal, fast, framework-free frontend template** that integrates easily with modern tooling (Bun, esbuild) and supports efficient client-side processing of GitHub artifacts, working around server compute limitations.
2.  **For Engineering Managers:** The need for **objective, data-driven insights** into team activities, performance patterns, and collaboration dynamics, derived from the contribution data processed by this application.

## 2. Problems It Solves

*   **For Developers:**
    *   Avoids heavy frameworks and complex frontend setups.
    *   Provides a simple way to fetch and unzip GitHub artifacts directly in the browser.
    *   Enables client-side processing to work around server compute limits (e.g., Deno Deploy).
    *   Enables rapid development with Bun and esbuild.
    *   Simplifies deployment with minimal backend requirements.
*   **For Engineering Managers:**
    *   Overcomes reliance on anecdotal or purely quantitative (commit count) performance assessments.
    *   Provides visibility into the *quality* and *type* of contributions (specs, comments, reviews).
    *   Helps track collaboration patterns and work distribution.
    *   Offers data to correlate activities with project outcomes.

## 3. Solution: Minimalist Frontend Enabling Data Insights

The core solution is a lightweight frontend application that:
*   Fetches and processes GitHub artifact data (including contribution `rawData` from systems like `text-conversation-rewards`).
*   Stores processed data efficiently in the browser's IndexedDB.
*   Visualizes key developer analytics (leaderboards, time series) directly from the cached data.
*   Leverages this processed data foundation to **enable the generation of objective, quantifiable insights for engineering managers** regarding team performance and activities.

## 4. How It Should Work (Technical Flow)

1.  User opens the app in a browser.
2.  Frontend authenticates through a minimal Deno Deploy proxy (for GitHub access).
3.  The app fetches a list of relevant artifacts (including `rawData`).
4.  User can trigger the download of specific artifact ZIPs.
5.  The browser unzips artifacts using WASM components.
6.  Processed data (including parsed `rawData`) is saved/updated in IndexedDB.
7.  The frontend displays developer performance analytics (leaderboards, time series) instantly from IndexedDB.
8.  The UI remains minimal and responsive, adhering to strict design constraints.
9.  (Future) Derived insights for managers can be presented through dedicated views or reports built upon the IndexedDB data.

## 5. Value Proposition

*   **For Developers:** Fast development cycle, simple deployment, framework-free base, client-side artifact handling.
*   **For Engineering Managers:** Access to objective performance data, identification of coaching opportunities, better understanding of collaboration and project health, ability to recognize diverse contributions, and track trends over time.

## 6. User Experience Goals

*   **Overall:** Fast load times, minimalist UI, transparent data handling.
*   **For Developers:** Easy to extend/customize, clear feedback on artifact processing.
*   **For Contributors:** Instant analytics visualizations, clear interactive insights into their contributions.
*   **For Engineering Managers (Future):** Clear, concise, actionable insights presented effectively (e.g., via dashboards/reports allowing filtering and trend identification).

## 7. UI & CSS Constraints

*   Absolutely minimal CSS: only what is strictly necessary for layout and usability.
*   No colors, no custom fonts, no visual embellishments in the core UI.
*   All spacing, sizing, and layout units must be in PX and only in multiples of 4px (e.g., 4px, 8px, 12px, 16px, etc.).
*   All design/visual interest will be concentrated within the data visualizations themselves, not in the surrounding layout or UI components.

## 8. Out of Scope

*   Complex UI frameworks.
*   Heavy backend processing (limited by Deno Deploy's 50ms compute window).
*   Building advanced manager dashboards/reports in the *initial* phase (focus is on documenting potential insights first).
