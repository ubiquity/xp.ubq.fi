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
  task?: { reward: number; multiplier: number };
  // Ensure comments array elements have expected structure for time series
  comments?: Array<{
    id?: number | string;
    timestamp?: string; // Expecting ISO 8601 string
    score?: { reward?: number };
    // other comment properties...
  }>;
  evaluationCommentHtml?: string;
};

export type LeaderboardEntry = {
  contributor: string;
  userId: number;
  totalXP: number;
  repoBreakdown: { [repo: string]: number };
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
type OrgRepoData = {
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
  // contributorKey: { userId, totalXP, repoBreakdown }
  const leaderboard: Map<string, LeaderboardEntry> = new Map();

  for (const org in data) {
    const orgData = data[org];
    for (const repo in orgData) {
      const repoData = orgData[repo];
      for (const issueOrPr in repoData) {
        const issueData = repoData[issueOrPr];
        for (const contributor in issueData) {
          const analytics: ContributorAnalytics = issueData[contributor];
          // Ensure analytics object and userId exist before processing
          if (analytics && typeof analytics.userId === 'number') {
            if (!leaderboard.has(contributor)) {
              leaderboard.set(contributor, {
                contributor,
                userId: analytics.userId,
                totalXP: 0,
                repoBreakdown: {},
              });
            }
            const entry = leaderboard.get(contributor)!;
            entry.totalXP += analytics.total || 0;
            entry.repoBreakdown[repo] = (entry.repoBreakdown[repo] || 0) + (analytics.total || 0);
          } else {
            console.warn(`Skipping leaderboard entry for ${contributor} in issue ${issueOrPr} due to missing data.`);
          }
        }
      }
    }
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

  for (const entry of aggregatedData) {
    // Basic validation of entry structure
    if (!entry || typeof entry !== 'object' || !entry.repo || !entry.issueId || !entry.metadata) {
        console.warn("Skipping invalid entry in aggregatedData:", entry);
        continue;
    }
    const { repo, issueId, metadata } = entry;

    // Ensure org level exists (should always be runId)
    if (!transformed[runId]) {
      transformed[runId] = {};
    }
    // Ensure repo level exists
    if (!transformed[runId][repo]) {
      transformed[runId][repo] = {};
    }
    // Assign metadata directly under the issueId
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
  const errorLog: { class: string; message: string; context: any }[] = [];

  for (const org in data) {
    const orgData = data[org];
    for (const repo in orgData) {
      const repoData = orgData[repo];
      for (const issueOrPr in repoData) { // issueOrPr is the issue number string
        const issueData = repoData[issueOrPr];
        for (const contributor in issueData) {
          const analytics: ContributorAnalytics = issueData[contributor];

          // Strict validation: userId must be present
          if (!analytics || typeof analytics.userId !== 'number') {
            errorLog.push({
              class: "missing_userId",
              message: `Contributor analytics missing userId for contributor "${contributor}", issue "${issueOrPr}", repo "${repo}".`,
              context: { contributor, issueOrPr, repo }
            });
            continue;
          }

          if (!seriesMap.has(contributor)) {
            seriesMap.set(contributor, {
              contributor,
              userId: analytics.userId,
              series: [],
            });
          }
          const entry = seriesMap.get(contributor)!;

          // Strict validation for task event (if present)
          if (analytics.task && analytics.task.reward) {
            if (!('timestamp' in analytics.task) || typeof (analytics.task as any).timestamp !== 'string' || !(analytics.task as any).timestamp) {
              errorLog.push({
                class: "missing_task_timestamp",
                message: `Task reward is missing a timestamp value for contributor "${contributor}", issue "${issueOrPr}", repo "${repo}".`,
                context: { contributor, issueOrPr, repo }
              });
            } else {
              const taskTimestamp = (analytics.task as any).timestamp;
              if (isNaN(new Date(taskTimestamp).getTime())) {
                errorLog.push({
                  class: "invalid_task_timestamp",
                  message: `Task reward has invalid timestamp format "${taskTimestamp}" for contributor "${contributor}", issue "${issueOrPr}", repo "${repo}".`,
                  context: { contributor, issueOrPr, repo, taskTimestamp }
                });
              } else {
                entry.series.push({
                  time: taskTimestamp,
                  xp: analytics.task.reward,
                  repo,
                  issueOrPr,
                });
              }
            }
          }

          // Strict validation for comment XP events
          if (Array.isArray(analytics.comments)) {
            analytics.comments.forEach((comment) => {
              if (!comment || typeof comment.timestamp !== 'string' || !comment.timestamp) {
                errorLog.push({
                  class: "missing_comment_timestamp",
                  message: `Comment event is missing a timestamp value for contributor "${contributor}", issue "${issueOrPr}", comment ID "${comment?.id}", repo "${repo}".`,
                  context: { contributor, issueOrPr, repo, commentId: comment?.id }
                });
                return;
              }
              if (isNaN(new Date(comment.timestamp).getTime())) {
                errorLog.push({
                  class: "invalid_comment_timestamp",
                  message: `Comment event has invalid timestamp format "${comment.timestamp}" for contributor "${contributor}", issue "${issueOrPr}", comment ID "${comment.id}", repo "${repo}".`,
                  context: { contributor, issueOrPr, repo, commentId: comment.id, timestamp: comment.timestamp }
                });
                return;
              }
              if (typeof comment.score?.reward !== 'number') {
                errorLog.push({
                  class: "missing_comment_reward",
                  message: `Comment event is missing a numeric reward for contributor "${contributor}", issue "${issueOrPr}", comment ID "${comment.id}", repo "${repo}".`,
                  context: { contributor, issueOrPr, repo, commentId: comment.id }
                });
                return;
              }
              entry.series.push({
                time: comment.timestamp,
                xp: comment.score.reward,
                repo,
                issueOrPr,
              });
            });
          }
        }
      }
    }
  }

  // If any errors were collected, throw a summary error
  if (errorLog.length > 0) {
    // Group by class and count
    const classCounts: Record<string, number> = {};
    errorLog.forEach(e => { classCounts[e.class] = (classCounts[e.class] || 0) + 1; });
    const uniqueClasses = Object.keys(classCounts).map(cls => `${cls}: ${classCounts[cls]}`).join(", ");
    const errorSummary = `Data validation failed. Unique error classes: ${uniqueClasses}\nFirst 5 errors:\n` +
      errorLog.slice(0, 5).map(e => `- [${e.class}] ${e.message}`).join("\n");
    throw new Error(errorSummary);
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
