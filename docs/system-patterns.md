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
7.  The transformed data (`OrgRepoStructure`) is stringified, converted to a Blob, and stored in IndexedDB, keyed by `runId`.
8.  Feedback is provided in the console/UI during the process.
9.  When data is needed (e.g., for UI display), `src/workers/artifact-worker-manager.ts` retrieves the Blob from IndexedDB using the `runId`, parses the JSON back into the `OrgRepoStructure`, and then passes this structure to `getLeaderboardData` and `getTimeSeriesData`.

## 4. Core Design Patterns

*   **Separation of Concerns:** Download logic, storage logic, data transformation, and UI are kept modular.
*   **Minimal Dependencies:** Avoids frameworks, leveraging browser APIs and minimal libraries like `fflate`.
*   **Script-Driven Build/Dev:** Bun scripts manage the build and development workflow.
*   **Client-Side Processing:** Core data processing (unzipping, transformation) happens in the browser to minimize backend requirements and work around serverless compute limits.

## 5. Data Structure for Insights (`OrgRepoStructure`)

The data structure stored in IndexedDB under the `runId` key, and subsequently used for generating insights and analytics, is the `OrgRepoStructure`:

```typescript
// Defined in src/data-transform.ts
export type OrgRepoStructure = {
    [repo: string]: { // Key is repo name (e.g., "ubiquity-os/repo-name")
      [issue: string]: { // Key is issue number as string
        [contributor: string]: { // Key is contributor username
          userId: number;
          total: number; // Total XP for this contributor on this issue/PR
          task: { reward: number; multiplier: number; timestamp: string; } | null;
          comments: Array<{ id: number; content?: string; timestamp: string; score: CommentScoreDetails; url?: string; commentType?: string; }>;
          reviewRewards?: Array<{ reviews: Array<{ reviewId: number; effect: { addition: number; deletion: number }; reward: number; priority: number; }>; url?: string; }>;
          evaluationCommentHtml: string | null;
        };
      };
    };
};
```

## 6. Insight Derivation Patterns (from `OrgRepoStructure`)

This section details how manager-focused insights are derived by processing the `OrgRepoStructure` retrieved for a specific `runId`. Note that some insights are directly available from the outputs of `getLeaderboardData` and `getTimeSeriesData` (which operate on the `OrgRepoStructure`), while others require further processing of the structure itself.

### 6.1. Individual Performance Insights

*   **Overall Contribution Score (XP):** Directly available as `totalXP` per contributor in the output of `getLeaderboardData(OrgRepoStructure)`.
*   **Contribution Breakdown:** Requires iterating through the `OrgRepoStructure`. Count occurrences of different `commentType` values in `comments`, check `task.reward > 0`, and count `reviewRewards` entries per `userId`.
*   **Comment Quality Metrics:** Requires iterating through `OrgRepoStructure`. Calculate average `score.formatting.result`, `score.readability.score`, and `score.relevance` from the `comments` array per `userId`.
*   **Review Impact & Thoroughness:** Requires iterating through `OrgRepoStructure`. Analyze `reviewRewards.reviews.effect` (additions/deletions) and `reviewRewards.reviews.reward`. Count `PULL_COLLABORATOR` comments.
*   **Engagement & Timeliness:** Partially available from `getTimeSeriesData(OrgRepoStructure)` output (event timestamps). Deeper analysis might require iterating `OrgRepoStructure` for specific `task.timestamp` vs comment timestamps.

### 6.2. Team Dynamics Insights

*   **Work Distribution:** Compare `totalXP`, `repoBreakdown`, or `issuePrCountBreakdown` from `getLeaderboardData(OrgRepoStructure)` output across contributors. Task counts require iterating `OrgRepoStructure`.
*   **Collaboration Patterns:** Requires iterating through `OrgRepoStructure`. Track cross-contributor interactions (e.g., user A commenting on an issue where user B is the assignee or primary contributor based on `total` XP for that issue).
*   **Team Communication Quality:** Requires iterating through `OrgRepoStructure`. Aggregate team-wide averages for `comments.score.readability.score` and `comments.score.formatting.result`.

### 6.3. Project Health Insights

*   **Issue/PR Complexity Indicators:** Requires iterating through `OrgRepoStructure`. Identify issues/PRs with high `task.reward`, numerous high-scoring (`score.reward`, `score.relevance`) `ISSUE_SPECIFICATION` comments, or a large number of unique contributors per issue.
*   **Activity Hotspots:** Can be derived from `repoBreakdown` in `getLeaderboardData(OrgRepoStructure)` output (XP per repo). Comment/contributor counts per repo/issue require iterating `OrgRepoStructure`.
*   **Review Load Distribution:** Requires iterating through `OrgRepoStructure`. Analyze the distribution of `reviewRewards` across different reviewers (`userId`s associated with `PULL_COLLABORATOR` comments or specific review actions).

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

*   The `total` XP score within the `OrgRepoStructure` accurately reflects the overall contribution value for a contributor on a specific issue/PR.
*   `commentType` correctly categorizes the nature of the contribution.
*   `score` components (relevance, readability, formatting) provide meaningful indicators of quality.
*   `reviewRewards.reward` correlates with review effort or impact.
*   Timestamps (`task.timestamp`, `comments.timestamp`) are accurate and consistent.
*   The `OrgRepoStructure` accurately represents the processed data from the source artifact.

## 10. Out of Scope

*   Complex backend operations (limited by Deno Deploy's 50ms compute window).
