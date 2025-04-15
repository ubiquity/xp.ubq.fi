/**
 * Data transformation utilities for developer analytics visualizations.
 * - Leaderboard: Aggregate XP per contributor, grouped by repository.
 * - Time Series: Extract XP events per contributor, mapped to a timeline.
 */

// Define the structure for the score object within comments
export type CommentScoreDetails = {
  reward: number;
  formatting?: { // Make formatting optional as it might not always be present
    content?: { [key: string]: { score: number; elementCount: number } };
    result?: number;
  };
  priority?: number;
  words?: {
    wordCount: number;
    wordValue: number;
    result: number;
  };
  readability?: {
    fleschKincaid: number;
    syllables: number;
    sentences: number;
    score: number;
  };
  multiplier?: number;
  relevance?: number;
};

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
    content?: string; // Add optional content field
    timestamp: string; // Required ISO 8601 string
    score: CommentScoreDetails; // Use the detailed score type
    url?: string; // Optional URL for the comment
    commentType?: string; // Optional type of comment (e.g., ISSUE_AUTHOR)
  }>;
  reviewRewards?: Array<{
    reviews: Array<{
      reviewId: number;
      effect: { addition: number; deletion: number };
      reward: number;
      priority: number;
    }>;
    url?: string; // Optional URL for the review context
  }>;
  evaluationCommentHtml: string | null;
};

export type LeaderboardEntry = {
  contributor: string;
  userId: number;
  totalXP: number;
  repoOverview: { [repo: string]: number };
  issuePrCountOverview: { [repo: string]: number }; // Number of unique issues/prs per repo
  issueOverview: { [issue: string]: number }; // XP per issue (issue = repo#issueNumber)
};

export type TimeSeriesDataPoint = {
  time: string; // Store as ISO string
  xp: number;
  repo: string;
  issueOrPr: string;
  eventType: string; // e.g., 'task', 'comment', 'ISSUE_AUTHOR'
  url?: string; // Optional URL for the event
  scoreDetails?: CommentScoreDetails; // Optional detailed score info
  contentPreview?: string; // Optional preview of comment content
};

export type TimeSeriesEntry = {
  contributor: string;
  userId: number;
  series: TimeSeriesDataPoint[];
};

// Structure of the data stored under a runId key in IndexedDB
export type OrgRepoStructure = {
    [repo: string]: { // Key is repo name (e.g., "ubiquity-os/repo-name")
      [issue: string]: { // Key is issue number as string
        [contributor: string]: ContributorAnalytics;
      };
    };
};

// Represents the overall data potentially keyed by runId or org (adjust as needed)
// This type might be used if fetching data for multiple runs/orgs at once.
export type OrgRepoData = {
  [key: string]: OrgRepoStructure; // Top-level key could be runId or org
};

/**
 * Aggregates leaderboard data from the OrgRepoStructure (data stored per runId).
 * Returns an array of contributors with total XP and per-repo overview.
 */
export function getLeaderboardData(
  // Expects the structure containing repos directly, not keyed by org/runId
  data: OrgRepoStructure
): LeaderboardEntry[] {
  console.log("getLeaderboardData input structure:", {
    repos: Object.keys(data),
    sampleIssue: Object.entries(data)[0]?.[1] || null // Show sample issue data from the first repo
  });
  const leaderboard: Map<string, LeaderboardEntry> = new Map();
  const issuePrTracker: Map<string, { [repo: string]: Set<string> }> = new Map();
  const issueOverviewTracker: Map<string, { [issueKey: string]: number }> = new Map();

  // Iterate directly over repos
  for (const repo in data) {
    const repoData = data[repo];
    for (const issueOrPr in repoData) {
      const issueData = repoData[issueOrPr];
      for (const contributor in issueData) {
        const analytics: ContributorAnalytics = issueData[contributor];
        if (!analytics) {
          console.warn(`Missing analytics data for contributor "${contributor}" in issue "${repo}#${issueOrPr}"`);
          continue; // Skip this contributor for this issue
        }

        if (typeof analytics.userId !== 'number') {
          console.warn(`Invalid userId for contributor "${contributor}" in issue "${repo}#${issueOrPr}"`);
          continue;
        }

        if (typeof analytics.total !== 'number') {
          console.warn(`Invalid total XP for contributor "${contributor}" in issue "${repo}#${issueOrPr}"`);
          continue;
        }

        if (!leaderboard.has(contributor)) {
          leaderboard.set(contributor, {
            contributor,
            userId: analytics.userId,
            totalXP: 0,
            repoOverview: {},
            issuePrCountOverview: {},
            issueOverview: {},
          });
        }

        const entry = leaderboard.get(contributor)!;
        entry.totalXP += analytics.total;
        entry.repoOverview[repo] = (entry.repoOverview[repo] || 0) + analytics.total;

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
        if (!issueOverviewTracker.has(contributor)) {
          issueOverviewTracker.set(contributor, {});
        }
        issueOverviewTracker.get(contributor)![issueKey] = (issueOverviewTracker.get(contributor)![issueKey] || 0) + analytics.total;
      }
    }
  }

  // Populate issuePrCountOverview and issueOverview
  for (const [contributor, entry] of leaderboard.entries()) {
    const repoMap = issuePrTracker.get(contributor) || {};
    for (const repo in repoMap) {
      entry.issuePrCountOverview[repo] = repoMap[repo].size;
    }
    entry.issueOverview = issueOverviewTracker.get(contributor) || {};
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
 * OrgRepoData format (keyed by runId containing OrgRepoStructure).
 */
export function transformAggregatedToOrgRepoData(
  aggregatedData: AggregatedResultEntry[],
  runId: string
): OrgRepoData {
  const transformed: OrgRepoData = { [runId]: {} };

  if (!Array.isArray(aggregatedData)) {
    throw new Error("aggregatedData must be an array");
  }

  for (const entry of aggregatedData) {
    if (!entry || typeof entry !== 'object') {
      console.warn("Skipping invalid entry in aggregatedData:", entry);
      continue;
    }

    const { org, repo, issueId, metadata } = entry;

    if (!org || typeof org !== 'string') {
       console.warn("Skipping entry with missing or invalid org name:", entry);
       continue;
    }
    if (!repo || typeof repo !== 'string') {
       console.warn("Skipping entry with missing or invalid repo name:", entry);
       continue;
    }
    if (!issueId || typeof issueId !== 'string') {
       console.warn("Skipping entry with missing or invalid issueId:", entry);
       continue;
    }
    if (!metadata || typeof metadata !== 'object') {
       console.warn("Skipping entry with missing or invalid metadata:", entry);
       continue;
    }

    const fullRepoPath = `${org}/${repo}`;
    transformed[runId][fullRepoPath] = transformed[runId][fullRepoPath] || {};
    transformed[runId][fullRepoPath][issueId] = metadata;
  }

  console.log("Transformed Aggregated Data:", {
    runId: runId,
    repos: Object.keys(transformed[runId]),
    totalIssues: Object.values(transformed[runId]).reduce((acc, issues) => acc + Object.keys(issues).length, 0)
  });

  return transformed;
}

/**
 * Extracts time series XP events for each contributor from the OrgRepoStructure.
 * Returns an array of contributors with their XP event series, sorted by time.
 * Skips events without a valid timestamp.
 */
export function getTimeSeriesData(
  // Expects the structure containing repos directly
  data: OrgRepoStructure
): TimeSeriesEntry[] {
  const seriesMap: Map<string, TimeSeriesEntry> = new Map();

  for (const repo in data) {
    const repoData = data[repo];
    for (const issueOrPr in repoData) {
      const issueData = repoData[issueOrPr];
      for (const contributor in issueData) {
        const analytics: ContributorAnalytics = issueData[contributor];

        if (!analytics) {
          console.warn(`Missing analytics data for contributor "${contributor}" in issue "${repo}#${issueOrPr}"`);
          continue;
        }
        if (typeof analytics.userId !== 'number') {
          console.warn(`Missing or invalid userId for contributor "${contributor}" in issue "${repo}#${issueOrPr}"`);
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

        // Handle task event
        if (analytics.task != null) {
          const { timestamp, reward } = analytics.task;
          if (timestamp && !isNaN(new Date(timestamp).getTime())) {
            entry.series.push({
              time: timestamp,
              xp: reward ?? 0, // Default reward to 0 if undefined
              repo,
              issueOrPr,
              eventType: 'task',
            });
          } else {
            console.warn(`Invalid task timestamp for contributor "${contributor}" in issue "${repo}#${issueOrPr}"`);
          }
        }

        // Handle comment events
        const comments = Array.isArray(analytics.comments) ? analytics.comments : [];
        for (const comment of comments) {
          const { timestamp, score, id, url, commentType, content } = comment;
          if (timestamp && !isNaN(new Date(timestamp).getTime())) {
            let contentPreview: string | undefined = undefined;
            if (content && typeof content === 'string') {
                const previewLength = 50;
                contentPreview = content.length > previewLength ? `${content.substring(0, previewLength)}...` : content;
                contentPreview = contentPreview.replace(/\n/g, ' ');
            }
            entry.series.push({
              time: timestamp,
              xp: score?.reward ?? 0, // Default reward to 0
              repo,
              issueOrPr,
              eventType: commentType || 'comment',
              url: url,
              scoreDetails: score,
              contentPreview: contentPreview
            });
          } else {
             console.warn(`Invalid comment timestamp for comment ${id} from contributor "${contributor}" in issue "${repo}#${issueOrPr}"`);
          }
        }

        // Handle review rewards events
        const reviewRewards = Array.isArray(analytics.reviewRewards) ? analytics.reviewRewards : [];
        for (const rewardGroup of reviewRewards) {
          const groupUrl = rewardGroup.url;
          if (Array.isArray(rewardGroup.reviews)) {
            for (const review of rewardGroup.reviews) {
              let eventTimestamp = analytics.task?.timestamp; // Approximate with task time
              if (!eventTimestamp && comments.length > 0) {
                  const latestCommentTime = Math.max(...comments.filter(c => c.timestamp && !isNaN(new Date(c.timestamp).getTime())).map(c => new Date(c.timestamp).getTime()));
                  if (isFinite(latestCommentTime)) {
                      eventTimestamp = new Date(latestCommentTime).toISOString();
                  }
              }

              if (eventTimestamp && !isNaN(new Date(eventTimestamp).getTime())) {
                entry.series.push({
                  time: eventTimestamp,
                  xp: review.reward ?? 0, // Default reward to 0
                  repo,
                  issueOrPr,
                  eventType: 'REVIEW_REWARD',
                  url: groupUrl,
                  contentPreview: `Review Reward: +${review.effect?.addition ?? 0}/-${review.effect?.deletion ?? 0} lines`
                });
              } else {
                 console.warn(`Skipping review reward for contributor "${contributor}" in issue "${repo}#${issueOrPr}" due to missing timestamp. Review ID: ${review.reviewId}`);
              }
            }
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
      totalXP: entry.series.reduce((sum, event) => sum + (event.xp ?? 0), 0) // Ensure xp is treated as number
    }))
  });
  return result;
}
