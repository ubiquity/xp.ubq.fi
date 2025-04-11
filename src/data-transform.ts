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
  comments?: Array<any>;
  evaluationCommentHtml?: string;
};

export type LeaderboardEntry = {
  contributor: string;
  userId: number;
  totalXP: number;
  repoBreakdown: { [repo: string]: number };
};

export type TimeSeriesEntry = {
  contributor: string;
  userId: number;
  series: Array<{ time: string | number; xp: number; repo: string; issueOrPr: string }>;
};

/**
 * Aggregates leaderboard data from nested artifact analytics.
 * Returns an array of contributors with total XP and per-repo breakdown.
 */
type OrgRepoData = {
  [org: string]: {
    [repo: string]: {
      [issue: string]: {
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
        }
      }
    }
  }

  const result = Array.from(leaderboard.values()).sort((a, b) => b.totalXP - a.totalXP);
  console.log("getLeaderboardData result:", result);
  return result;
}

/**
 * Extracts time series XP events for each contributor.
 * Returns an array of contributors with their XP event series.
 * If no timestamp is available, uses synthetic order.
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
          if (!seriesMap.has(contributor)) {
            seriesMap.set(contributor, {
              contributor,
              userId: analytics.userId,
              series: [],
            });
          }
          const entry = seriesMap.get(contributor)!;

          // Add task XP as an event (synthetic time: issueOrPr)
          if (analytics.task && analytics.task.reward) {
            entry.series.push({
              time: issueOrPr, // Could be replaced with a real timestamp if available
              xp: analytics.task.reward,
              repo,
              issueOrPr,
            });
          }

          // Add comment XP events
          if (Array.isArray(analytics.comments)) {
            analytics.comments.forEach((comment, idx) => {
              // Use comment.id or synthetic time
              entry.series.push({
                time: comment.id || `${issueOrPr}-comment-${idx}`,
                xp: comment.score?.reward || 0,
                repo,
                issueOrPr,
              });
            });
          }
        }
      }
    }
  }

  // Sort each contributor's series by time (if numeric), else by insertion order
  for (const entry of seriesMap.values()) {
    entry.series.sort((a, b) => {
      if (typeof a.time === "number" && typeof b.time === "number") {
        return a.time - b.time;
      }
      return 0;
    });
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
