/**
 * Data transformation utilities for developer analytics visualizations.
 * - Leaderboard: Aggregate XP per contributor, grouped by repository.
 * - Time Series: Extract XP events per contributor, mapped to a timeline.
 *
 * The input data is expected to be a nested object:
 * {
 *   [org: string]: {
 *     [repo: string]: {
 *       [issueOrPr: string]: {
 *         [contributor: string]: ContributorAnalytics
 *       }
 *     }
 *   }
 * }
 */

export type ContributorAnalytics = {
  userId: number;
  total: number;
  task: {
    reward: number;
    multiplier: number;
    timestamp: string; // Required ISO 8601 string
  } | null;
  comments: Array<{
    id: number;
    timestamp: string; // Required ISO 8601 string
    score: { reward: number };
  }>;
  evaluationCommentHtml: string | null;
};

export type LeaderboardEntry = {
  contributor: string;
  userId: number;
  totalXP: number;
  repoBreakdown: { [repo: string]: number };
  issuePrCountBreakdown: { [repo: string]: number }; // Number of unique issues/prs per repo
  issueBreakdown: { [issue: string]: number }; // XP per issue (issue = repo#issueNumber)
};

export type TimeSeriesDataPoint = {
  time: string; // Store as ISO string
  xp: number;
  repo: string;
  issueOrPr: string;
};

export type TimeSeriesEntry = {
  contributor: string;
  userId: number;
  series: TimeSeriesDataPoint[];
};

/**
 * Aggregates leaderboard data from nested artifact analytics.
 * Returns an array of contributors with total XP and per-repo breakdown.
 */
export type OrgRepoData = {
  [org: string]: {
    [repo: string]: {
      [issue: string]: { // Key is issue number as string
        [contributor: string]: ContributorAnalytics;
      };
    };
  };
};

export function getLeaderboardData(
  data: OrgRepoData
): LeaderboardEntry[] {
  console.log("getLeaderboardData input structure:", {
    orgs: Object.keys(data),
    sampleData: Object.entries(data as Record<string, Record<string, unknown>>).map(([org, repos]) => ({
      org,
      repos: Object.keys(repos),
      sampleIssue: Object.entries(Object.values(repos)[0] || {})[0]?.[1] || null
    }))
  });
  // contributorKey: { userId, totalXP, repoBreakdown, issuePrCountBreakdown }
  const leaderboard: Map<string, LeaderboardEntry> = new Map();

  // For issue/pr count: contributor -> repo -> Set of issue/pr ids
  const issuePrTracker: Map<string, { [repo: string]: Set<string> }> = new Map();

  // For issue breakdown: contributor -> issueKey -> XP
  // issueKey = `${repo}#${issueNumber}`
  const issueBreakdownTracker: Map<string, { [issueKey: string]: number }> = new Map();

  for (const org in data) {
    const orgData = data[org];
    for (const repo in orgData) {
      const repoData = orgData[repo];
      for (const issueOrPr in repoData) {
        // Only include issues, not pulls (assuming pulls are associated with issues)
        // If you need to filter out PRs, add logic here (e.g., if issueOrPr starts with "pr" skip)
        const issueData = repoData[issueOrPr];
        for (const contributor in issueData) {
          const analytics: ContributorAnalytics = issueData[contributor];
          if (!analytics) {
            throw new Error(`Missing analytics data for contributor "${contributor}" in issue "${issueOrPr}"`);
          }

          if (typeof analytics.userId !== 'number') {
            throw new Error(`Invalid userId for contributor "${contributor}" in issue "${issueOrPr}"`);
          }

          if (typeof analytics.total !== 'number') {
            throw new Error(`Invalid total for contributor "${contributor}" in issue "${issueOrPr}"`);
          }

          if (!leaderboard.has(contributor)) {
            leaderboard.set(contributor, {
              contributor,
              userId: analytics.userId,
              totalXP: 0,
              repoBreakdown: {},
              issuePrCountBreakdown: {},
              issueBreakdown: {},
            });
          }

          const entry = leaderboard.get(contributor)!;
          entry.totalXP += analytics.total;
          entry.repoBreakdown[repo] = (entry.repoBreakdown[repo] || 0) + analytics.total;

          // Track unique issues/prs per contributor per repo
          if (!issuePrTracker.has(contributor)) {
            issuePrTracker.set(contributor, {});
          }
          if (!issuePrTracker.get(contributor)![repo]) {
            issuePrTracker.get(contributor)![repo] = new Set();
          }
          issuePrTracker.get(contributor)![repo].add(issueOrPr);

          // Track XP per issue (issueKey = repo#issueOrPr)
          const issueKey = `${repo}#${issueOrPr}`;
          if (!issueBreakdownTracker.has(contributor)) {
            issueBreakdownTracker.set(contributor, {});
          }
          if (!issueBreakdownTracker.get(contributor)![issueKey]) {
            issueBreakdownTracker.get(contributor)![issueKey] = 0;
          }
          issueBreakdownTracker.get(contributor)![issueKey] += analytics.total;
        }
      }
    }
  }

  // Populate issuePrCountBreakdown and issueBreakdown
  for (const [contributor, entry] of leaderboard.entries()) {
    const repoMap = issuePrTracker.get(contributor) || {};
    for (const repo in repoMap) {
      entry.issuePrCountBreakdown[repo] = repoMap[repo].size;
    }
    entry.issueBreakdown = issueBreakdownTracker.get(contributor) || {};
  }

  const result = Array.from(leaderboard.values()).sort((a, b) => b.totalXP - a.totalXP);
  console.log("getLeaderboardData result:", result);
  return result;
}

// --- New Transformation for Aggregated Artifact ---

export type AggregatedResultEntry = {
  org: string;
  repo: string;
  issueId: string; // Note: This is the issue *number* as a string
  metadata: {
    [contributor: string]: ContributorAnalytics; // Re-use existing type
  };
};

/**
 * Transforms the new aggregated artifact format (array) into the nested
 * OrgRepoData format expected by analytics functions.
 * The top-level key will be the runId.
 */
export function transformAggregatedToOrgRepoData(
  aggregatedData: AggregatedResultEntry[],
  runId: string // Use runId as the top-level key
): OrgRepoData {
  const transformed: OrgRepoData = { [runId]: {} };

  if (!Array.isArray(aggregatedData)) {
    throw new Error("aggregatedData must be an array");
  }

  for (const entry of aggregatedData) {
    // Strict validation of entry structure
    if (!entry || typeof entry !== 'object') {
      throw new Error("Invalid entry: must be an object");
    }

    const { repo, issueId, metadata } = entry;

    if (!repo || typeof repo !== 'string') {
      throw new Error("Missing or invalid repo name");
    }

    if (!issueId || typeof issueId !== 'string') {
      throw new Error("Missing or invalid issueId");
    }

    if (!metadata || typeof metadata !== 'object') {
      throw new Error("Missing or invalid metadata");
    }

    // Initialize nested structure
    transformed[runId] = transformed[runId] || {};
    transformed[runId][repo] = transformed[runId][repo] || {};
    transformed[runId][repo][issueId] = metadata;
  }

  console.log("Transformed Aggregated Data:", {
    orgs: Object.keys(transformed),
    reposByOrg: Object.fromEntries(
      Object.entries(transformed).map(([org, repos]) => [
        org,
        Object.keys(repos)
      ])
    ),
    totalIssues: Object.values(transformed).reduce((acc, repos) =>
      acc + Object.values(repos).reduce((racc, issues) =>
        racc + Object.keys(issues).length, 0
      ), 0
    )
  });

  return transformed;
}

/**
 * Extracts time series XP events for each contributor from the transformed OrgRepoData.
 * Returns an array of contributors with their XP event series, sorted by time.
 * Skips events without a valid timestamp.
 */
export function getTimeSeriesData(
  data: OrgRepoData
): TimeSeriesEntry[] {
  const seriesMap: Map<string, TimeSeriesEntry> = new Map();

  for (const org in data) {
    const orgData = data[org];
    for (const repo in orgData) {
      const repoData = orgData[repo];
      for (const issueOrPr in repoData) {
        const issueData = repoData[issueOrPr];
        for (const contributor in issueData) {
          const analytics: ContributorAnalytics = issueData[contributor];

          if (!analytics) {
            throw new Error(`Missing analytics data for contributor "${contributor}" in issue "${issueOrPr}"`);
          }

          if (typeof analytics.userId !== 'number') {
            throw new Error(`Missing or invalid userId for contributor "${contributor}" in issue "${issueOrPr}"`);
          }

          if (!seriesMap.has(contributor)) {
            seriesMap.set(contributor, {
              contributor,
              userId: analytics.userId,
              series: [],
            });
          }
          const entry = seriesMap.get(contributor)!;

          // Handle task event
          if (analytics.task != null) {
            const { timestamp, reward } = analytics.task;
            if (!timestamp || isNaN(new Date(timestamp).getTime())) {
              throw new Error(`Invalid task timestamp for contributor "${contributor}" in issue "${issueOrPr}"`);
            }

            entry.series.push({
              time: timestamp,
              xp: reward,
              repo,
              issueOrPr,
            });
          }

          // Handle comment events
          const comments = Array.isArray(analytics.comments) ? analytics.comments : [];
          for (const comment of comments) {
            const { timestamp, score, id } = comment;

            if (!timestamp || isNaN(new Date(timestamp).getTime())) {
              throw new Error(`Invalid comment timestamp for comment ${id} from contributor "${contributor}" in issue "${issueOrPr}"`);
            }

            entry.series.push({
              time: timestamp,
              xp: score.reward,
              repo,
              issueOrPr,
            });
          }
        }
      }
    }
  }

  // Sort each contributor's series by actual timestamp
  for (const entry of seriesMap.values()) {
    entry.series.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }

  const result = Array.from(seriesMap.values());
  console.log("getTimeSeriesData results:", {
    contributors: result.length,
    samplesPerContributor: result.map(entry => ({
      contributor: entry.contributor,
      totalEvents: entry.series.length,
      sampleEvents: entry.series.slice(0, 2),
      totalXP: entry.series.reduce((sum, event) => sum + event.xp, 0)
    }))
  });
  return result;
}
