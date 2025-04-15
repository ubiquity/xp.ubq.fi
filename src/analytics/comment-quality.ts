import type { OrgRepoStructure, ContributorAnalytics, CommentScoreDetails } from "../data-transform";

// Define the structure for comment quality metrics
export type CommentQualityMetrics = {
  averageFormattingScore: number;
  averageReadabilityScore: number;
  averageRelevanceScore: number;
  commentCount: number;
  totalCommentXp: number; // Sum of XP from comments included in quality calculation
};

// Type for the result map
export type QualityResult = {
  [contributor: string]: CommentQualityMetrics;
};

/**
 * Calculates average comment quality metrics for each contributor.
 *
 * @param data The OrgRepoStructure containing contribution data for a specific run.
 * @returns A map where keys are contributor names and values are their average comment quality metrics.
 */
export function calculateCommentQuality(data: OrgRepoStructure): QualityResult {
  const qualityData: QualityResult = {};

  // Temporary storage for sums and counts before calculating averages
  const tempQuality: {
    [contributor: string]: {
      formattingSum: number;
      readabilitySum: number;
      relevanceSum: number;
      commentXpSum: number; // Add sum for comment XP
      commentCount: number;
    };
  } = {};

  for (const repo in data) {
    const repoData = data[repo];
    for (const issueOrPr in repoData) {
      const issueData = repoData[issueOrPr];
      for (const contributor in issueData) {
        const analytics: ContributorAnalytics = issueData[contributor];

        // Initialize temp storage for contributor if not present
        if (!tempQuality[contributor]) {
          tempQuality[contributor] = {
            formattingSum: 0,
            readabilitySum: 0,
            relevanceSum: 0,
            commentXpSum: 0, // Initialize comment XP sum
            commentCount: 0,
          };
        }
        const userTempQuality = tempQuality[contributor];

        const comments = Array.isArray(analytics.comments) ? analytics.comments : [];
        for (const comment of comments) {
          const score: CommentScoreDetails | undefined = comment.score;
          if (score) {
            userTempQuality.commentCount += 1;
            // Use formatting.result if available, otherwise default to 0
            userTempQuality.formattingSum += score.formatting?.result ?? 0;
            // Use readability.score if available, otherwise default to 0
            userTempQuality.readabilitySum += score.readability?.score ?? 0;
            // Use relevance score if available, otherwise default to 0
            userTempQuality.relevanceSum += score.relevance ?? 0;
            // Sum the comment's reward
            userTempQuality.commentXpSum += score.reward ?? 0;
          }
        }
      }
    }
  }

  // Calculate averages
  for (const contributor in tempQuality) {
    const totals = tempQuality[contributor];
    const count = totals.commentCount;
    qualityData[contributor] = {
      averageFormattingScore: count > 0 ? totals.formattingSum / count : 0,
      averageReadabilityScore: count > 0 ? totals.readabilitySum / count : 0,
      averageRelevanceScore: count > 0 ? totals.relevanceSum / count : 0,
      commentCount: count,
      totalCommentXp: totals.commentXpSum, // Assign the summed comment XP
    };
  }

  return qualityData;
}
