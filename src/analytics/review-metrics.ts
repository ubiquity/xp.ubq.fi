import type { OrgRepoStructure, ContributorAnalytics } from "../data-transform";

// Define the structure for review metrics
export type ReviewMetrics = {
  totalReviewsConducted: number; // Count of distinct review actions/groups
  totalLinesAddedReviewed: number;
  totalLinesDeletedReviewed: number;
  totalReviewReward: number;
  averageReviewReward: number;
  pullsReviewedCount: number; // Count of unique PRs reviewed
};

// Type for the result map
export type ReviewMetricsResult = {
  [contributor: string]: ReviewMetrics;
};

/**
 * Calculates review metrics for each contributor.
 *
 * @param data The OrgRepoStructure containing contribution data for a specific run.
 * @returns A map where keys are contributor names and values are their review metrics.
 */
export function calculateReviewMetrics(data: OrgRepoStructure): ReviewMetricsResult {
  const metrics: ReviewMetricsResult = {};

  // Temporary storage for aggregation
  const tempMetrics: {
    [contributor: string]: {
      reviewCount: number;
      linesAddedSum: number;
      linesDeletedSum: number;
      rewardSum: number;
      reviewedPrUrls: Set<string>; // Track unique PR URLs reviewed
    };
  } = {};

  for (const repo in data) {
    const repoData = data[repo];
    for (const issueOrPr in repoData) {
      const issueData = repoData[issueOrPr];
      for (const contributor in issueData) {
        const analytics: ContributorAnalytics = issueData[contributor];

        // Initialize temp storage for contributor if not present
        if (!tempMetrics[contributor]) {
          tempMetrics[contributor] = {
            reviewCount: 0,
            linesAddedSum: 0,
            linesDeletedSum: 0,
            rewardSum: 0,
            reviewedPrUrls: new Set(),
          };
        }
        const userTempMetrics = tempMetrics[contributor];

        const reviewRewards = Array.isArray(analytics.reviewRewards) ? analytics.reviewRewards : [];
        for (const rewardGroup of reviewRewards) {
           // Add the PR URL to the set for unique counting
           if (rewardGroup.url) {
             userTempMetrics.reviewedPrUrls.add(rewardGroup.url);
           }

           if (Array.isArray(rewardGroup.reviews)) {
             userTempMetrics.reviewCount += rewardGroup.reviews.length; // Count individual review actions
             for (const review of rewardGroup.reviews) {
               userTempMetrics.linesAddedSum += review.effect?.addition ?? 0;
               userTempMetrics.linesDeletedSum += review.effect?.deletion ?? 0;
               userTempMetrics.rewardSum += review.reward ?? 0;
             }
           }
        }
      }
    }
  }

  // Calculate final metrics
  for (const contributor in tempMetrics) {
    const totals = tempMetrics[contributor];
    const count = totals.reviewCount;
    metrics[contributor] = {
      totalReviewsConducted: count,
      totalLinesAddedReviewed: totals.linesAddedSum,
      totalLinesDeletedReviewed: totals.linesDeletedSum,
      totalReviewReward: totals.rewardSum,
      averageReviewReward: count > 0 ? totals.rewardSum / count : 0,
      pullsReviewedCount: totals.reviewedPrUrls.size,
    };
  }

  return metrics;
}
