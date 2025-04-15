# System Patterns: Application Architecture & Insight Derivation

This document outlines the technical architecture of the application and how specific insights for engineering managers can be derived from the processed contribution data (`rawData`).

## 1. Application Architecture

*   **Frontend:** Plain HTML, CSS, and TypeScript. No complex frameworks.
*   **Bundling:** esbuild invoked via Bun scripts for fast builds.
*   **Package Management & Scripting:** Bun.
*   **Artifact Handling:** Downloads the single `final-aggregated-results.zip` artifact from GitHub Actions runs and unzips it directly in the browser using JavaScript (`fflate`).
*   **Backend:** Deno Deploy acting strictly as an authentication proxy for GitHub API calls (artifact list/metadata). Direct artifact downloads use authenticated GitHub URLs.
*   **Data Storage:** Transformed contribution data is cached in the browser's IndexedDB for fast retrieval and visualization.

## 2. Key Components

*   `src/main.ts`: Application entry point.
*   `src/download-artifacts.ts`: Fetches metadata and orchestrates the download and processing of the `final-aggregated-results.zip` artifact.
*   `src/unzip-artifact.ts`: Unzips the artifact ZIP using `fflate` and extracts/parses the core `aggregated_results.json`.
*   `src/data-transform.ts`: Transforms the parsed `aggregated_results.json` array into the nested `OrgRepoData` structure required for analytics and insights.
*   `src/db/`: IndexedDB setup and access logic for caching the transformed `OrgRepoData`.
*   `src/visualization/`: Modules for rendering analytics charts (e.g., leaderboards, time series).
*   `tools/`: Build, watch, and development server scripts.

## 3. Artifact Download & Processing Flow

1.  Frontend determines the target GitHub Actions `runId`.
2.  Frontend fetches metadata for the `final-aggregated-results` artifact via the GitHub API (using the Deno Deploy auth proxy if needed).
3.  Frontend downloads the artifact ZIP directly from GitHub's `archive_download_url` (requires authentication header, handled by the proxy or direct fetch).
4.  JavaScript (`fflate`) unzips the downloaded data in the browser or a web worker.
5.  The `aggregated_results.json` file content is extracted and parsed.
6.  The `data-transform.ts` module converts the parsed array data into the nested `OrgRepoData` structure (this structure is also referred to as `rawData` in the context of insights).
7.  The transformed data is stored in IndexedDB, keyed by `runId`.
8.  Feedback is provided in the console/UI during the process.

## 4. Core Design Patterns

*   **Separation of Concerns:** Download logic, storage logic, data transformation, and UI are kept modular.
*   **Minimal Dependencies:** Avoids frameworks, leveraging browser APIs and minimal libraries like `fflate`.
*   **Script-Driven Build/Dev:** Bun scripts manage the build and development workflow.
*   **Client-Side Processing:** Core data processing (unzipping, transformation) happens in the browser to minimize backend requirements and work around serverless compute limits.

## 5. RawData Structure for Insights

The transformed data (`rawData`) stored in IndexedDB and used for insights follows this hierarchical structure:

```
UserID -> Repository -> Issue/PR Number -> Contributor Username -> {
  userId,
  total, // Total XP for this issue/PR
  task: { reward, multiplier, timestamp }, // Task assignment details
  comments: [ { id, content, url, timestamp, commentType, score: { reward, formatting, priority, words, readability, multiplier, relevance, diffHunk? } } ], // Array of comments
  reviewRewards: [ { reviews: [ { reviewId, effect: { addition, deletion }, reward, priority } ], url } ], // Array of review actions
  evaluationCommentHtml // Pre-generated summary HTML (may not be used for direct insight calculation)
}
```

## 6. Insight Derivation Patterns (from RawData)

This section details how manager-focused insights are derived from the `rawData` structure.

### 6.1. Individual Performance Insights

*   **Overall Contribution Score (XP):** Sum `total` across relevant issues/PRs per `userId`.
*   **Contribution Breakdown:** Aggregate counts of `commentType`, check `task.reward > 0`, and count `reviewRewards` per `userId`.
*   **Comment Quality Metrics:** Average `score.formatting`, `score.readability`, `score.relevance` per `userId`.
*   **Review Impact & Thoroughness:** Analyze `reviewRewards.reviews.effect`, `reviewRewards.reviews.reward`, and count `PULL_COLLABORATOR` comments with `diffHunk`.
*   **Engagement & Timeliness:** Analyze distribution/frequency of `comments.timestamp` and `task.timestamp`.

### 6.2. Team Dynamics Insights

*   **Work Distribution:** Compare aggregated `total` XP, task counts, or issue/PR counts across `userId`s.
*   **Collaboration Patterns:** Track cross-contributor interactions (`ISSUE_COLLABORATOR`, `PULL_COLLABORATOR`) on issues/PRs.
*   **Team Communication Quality:** Aggregate team-wide averages for `comments.score.readability` and `comments.score.formatting`.

### 6.3. Project Health Insights

*   **Issue/PR Complexity Indicators:** Identify items with high `task.reward`, many high-scoring `ISSUE_SPECIFICATION` comments, or numerous contributors.
*   **Activity Hotspots:** Aggregate contributors, comments, or XP per repository or issue/PR.
*   **Review Load Distribution:** Analyze the distribution of `reviewRewards` across different reviewers.

## 7. Analytics & Visualization Patterns

*   **IndexedDB-Backed:** All analytics/visualizations run off data cached in IndexedDB for speed.
*   **Modular Architecture:** Data transformation, visualization modules (leaderboard, time series), and UI controls are separate.
*   **Minimal Charting:** Charts rendered using SVG/Canvas directly or minimal libraries (e.g., uPlot, Chart.js via CDN).
*   **Extensible UI:** Designed to be minimal, responsive, and easy to extend.

## 8. UI & CSS Constraints

*   Absolutely minimal CSS for layout/usability only.
*   No colors, custom fonts, or visual embellishments in core UI.
*   All spacing/sizing units in PX, multiples of 4px.
*   Visual interest concentrated in data visualizations.

## 9. Assumptions for Insights

*   `total` XP accurately reflects contribution value.
*   `commentType` correctly categorizes contributions.
*   `score` components (relevance, readability, formatting) are meaningful quality indicators.
*   `reviewRewards.reward` correlates with review effort/impact.
*   Timestamps are accurate.

## 10. Out of Scope

*   Complex backend operations (limited by Deno Deploy's 50ms compute window).
