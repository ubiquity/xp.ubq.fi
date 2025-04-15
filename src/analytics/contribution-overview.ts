import type { OrgRepoStructure, ContributorAnalytics } from "../data-transform";

// Define the structure for the contribution overview, including XP sums per category
export type ContributionOverview = {
  // Counts
  tasksAssigned: number;
  issueSpecifications: number;
  pullSpecifications: number;
  issueComments: number;
  pullComments: number;
  reviewsConducted: number; // Note: Review XP is calculated in review-metrics.ts
  // XP Sums
  tasksXp: number;
  issueSpecificationsXp: number;
  pullSpecificationsXp: number;
  issueCommentsXp: number;
  pullCommentsXp: number;
  // Add more categories as needed based on commentType analysis
};

// Type for the result map
export type OverviewResult = {
  [contributor: string]: ContributionOverview;
};

/**
 * Calculates the overview of contribution types for each contributor.
 *
 * @param data The OrgRepoStructure containing contribution data for a specific run.
 * @returns A map where keys are contributor names and values are their contribution overview counts.
 */
export function calculateContributionOverview(data: OrgRepoStructure): OverviewResult {
  const overview: OverviewResult = {};

  for (const repo in data) {
    const repoData = data[repo];
    for (const issueOrPr in repoData) {
      const issueData = repoData[issueOrPr];
      for (const contributor in issueData) {
        const analytics: ContributorAnalytics = issueData[contributor];

        // Initialize overview for contributor if not present
        if (!overview[contributor]) {
          overview[contributor] = {
            // Counts
            tasksAssigned: 0,
            issueSpecifications: 0,
            pullSpecifications: 0,
            issueComments: 0,
            pullComments: 0,
            reviewsConducted: 0,
            // XP Sums
            tasksXp: 0,
            issueSpecificationsXp: 0,
            pullSpecificationsXp: 0,
            issueCommentsXp: 0,
            pullCommentsXp: 0,
          };
        }
        const userOverview = overview[contributor];

        // Count and sum XP for assigned tasks
        if (analytics.task?.reward && analytics.task.reward > 0) {
          userOverview.tasksAssigned += 1;
          userOverview.tasksXp += analytics.task.reward;
        }

        // Count comment types and sum their XP rewards
        const comments = Array.isArray(analytics.comments) ? analytics.comments : [];
        for (const comment of comments) {
          const reward = comment.score?.reward ?? 0; // Get comment reward, default to 0
          switch (comment.commentType) {
            case "ISSUE_SPECIFICATION":
              userOverview.issueSpecifications += 1;
              userOverview.issueSpecificationsXp += reward;
              break;
            case "PULL_SPECIFICATION":
              userOverview.pullSpecifications += 1;
              userOverview.pullSpecificationsXp += reward;
              break;
            case "ISSUE_AUTHOR":
            case "ISSUE_COLLABORATOR":
            case "ISSUE_CONTRIBUTOR":
              userOverview.issueComments += 1;
              userOverview.issueCommentsXp += reward;
              break;
            case "PULL_AUTHOR":
            case "PULL_COLLABORATOR":
            case "PULL_CONTRIBUTOR":
              userOverview.pullComments += 1;
              userOverview.pullCommentsXp += reward;
              break;
            default:
              // Categorize unknown types based on URL and sum XP
              if (comment.url?.includes("/issues/")) {
                 userOverview.issueComments += 1;
                 userOverview.issueCommentsXp += reward;
              } else if (comment.url?.includes("/pull/")) {
                 userOverview.pullComments += 1;
                 userOverview.pullCommentsXp += reward;
              }
              break;
          }
        }

        // Count review actions/groups
        const reviewRewards = Array.isArray(analytics.reviewRewards) ? analytics.reviewRewards : [];
        // Count each reward group as one "review conducted" instance for simplicity
        userOverview.reviewsConducted += reviewRewards.length;
        // Alternatively, count individual reviews:
        // reviewRewards.forEach(group => {
        //   if (Array.isArray(group.reviews)) {
        //     userOverview.reviewsConducted += group.reviews.length;
        //   }
        // });
      }
    }
  }

  return overview;
}
