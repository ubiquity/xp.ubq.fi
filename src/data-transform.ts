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
  // Add the reviewRewards structure
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
  repoBreakdown: { [repo: string]: number };
  issuePrCountBreakdown: { [repo: string]: number }; // Number of unique issues/prs per repo
  issueBreakdown: { [issue: string]: number }; // XP per issue (issue = repo#issueNumber)
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
          // Note: repo already includes org/ prefix
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
  // Initialize with runId as top-level key
  const transformed: OrgRepoData = { [runId]: {} };

  if (!Array.isArray(aggregatedData)) {
    throw new Error("aggregatedData must be an array");
  }

  for (const entry of aggregatedData) {
    // Strict validation of entry structure
    if (!entry || typeof entry !== 'object') {
      throw new Error("Invalid entry: must be an object");
    }

    const { org, repo, issueId, metadata } = entry;

    if (!org || typeof org !== 'string') {
      throw new Error("Missing or invalid org name");
    }

    if (!repo || typeof repo !== 'string') {
      throw new Error("Missing or invalid repo name");
    }

    if (!issueId || typeof issueId !== 'string') {
      throw new Error("Missing or invalid issueId");
    }

    if (!metadata || typeof metadata !== 'object') {
      throw new Error("Missing or invalid metadata");
    }

    // Construct the full repository path (org/repo format)
    const fullRepoPath = `${org}/${repo}`;

    // Initialize nested structure under runId
    transformed[runId] = transformed[runId] || {};
    transformed[runId][fullRepoPath] = transformed[runId][fullRepoPath] || {};
    transformed[runId][fullRepoPath][issueId] = metadata;
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

            // TODO: Check if task object has a URL or identifier we can use
            entry.series.push({
              time: timestamp,
              xp: reward,
              repo,
              issueOrPr,
              eventType: 'task', // Assign event type
              // url: analytics.task.url // If available
              // scoreDetails remains undefined for tasks
            });
          }

          // Handle comment events
          const comments = Array.isArray(analytics.comments) ? analytics.comments : [];
          for (const comment of comments) {
            // Extract fields including content
            const { timestamp, score, id, url, commentType, content } = comment;

            if (!timestamp || isNaN(new Date(timestamp).getTime())) {
              throw new Error(`Invalid comment timestamp for comment ${id} from contributor "${contributor}" in issue "${issueOrPr}"`);
            }

            // Create content preview (truncate if necessary)
            let contentPreview: string | undefined = undefined;
            if (content && typeof content === 'string') {
                const previewLength = 50; // Max length for preview
                contentPreview = content.length > previewLength ? `${content.substring(0, previewLength)}...` : content;
                contentPreview = contentPreview.replace(/\n/g, ' '); // Replace newlines for tooltip
            }


            entry.series.push({
              time: timestamp,
              xp: score.reward,
              repo,
              issueOrPr,
              eventType: commentType || 'comment', // Use commentType or default
              url: url, // Add URL if available
              scoreDetails: score, // Add the full score object
              contentPreview: contentPreview // Add the content preview
            });
          }

          // Handle review rewards events
          const reviewRewards = Array.isArray(analytics.reviewRewards) ? analytics.reviewRewards : [];
          for (const rewardGroup of reviewRewards) {
            const groupUrl = rewardGroup.url; // URL for the whole review group (e.g., PR link)

            // Check if rewardGroup.reviews is actually an array before iterating
            if (Array.isArray(rewardGroup.reviews)) {
              for (const review of rewardGroup.reviews) {
                // We need a timestamp for the time series.
                // Since reviewRewards don't have individual timestamps,
              // we might need to approximate or use the task timestamp if available?
              // Or perhaps the source data needs adjustment.
              // For now, let's use the task timestamp if available, otherwise skip.
              // A better approach might be needed depending on data source capabilities.

              // Let's try using the LAST comment timestamp as a proxy if task timestamp is missing
              // This is an approximation!
              let eventTimestamp = analytics.task?.timestamp;
              if (!eventTimestamp && comments.length > 0) {
                  // Find the latest comment timestamp as a fallback
                  const latestCommentTime = Math.max(...comments.map(c => new Date(c.timestamp).getTime()));
                  if (isFinite(latestCommentTime)) {
                      eventTimestamp = new Date(latestCommentTime).toISOString();
                  }
              }

              if (!eventTimestamp || isNaN(new Date(eventTimestamp).getTime())) {
                console.warn(`Skipping review reward for contributor "${contributor}" in issue "${issueOrPr}" due to missing timestamp. Review ID: ${review.reviewId}`);
                continue; // Skip if no valid timestamp found
              }

              entry.series.push({
                time: eventTimestamp, // Use approximated timestamp
                xp: review.reward,
                repo,
                issueOrPr,
                eventType: 'REVIEW_REWARD', // Assign specific event type
                url: groupUrl, // Use the URL associated with the review group
                // scoreDetails: undefined, // Review rewards don't have comment score details
                // contentPreview: `Review Reward: ${review.reward} XP` // Simple preview
                contentPreview: `Review Reward: +${review.effect.addition}/-${review.effect.deletion} lines` // Preview with diffstat
              });
            } // End inner loop (reviews)
          } // End check for Array.isArray(rewardGroup.reviews)
        } // End outer loop (rewardGroup)
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
