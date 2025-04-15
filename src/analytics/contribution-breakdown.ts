import type { OrgRepoStructure, ContributorAnalytics } from "../data-transform";

// Define the structure for the contribution breakdown
export type ContributionBreakdown = {
  tasksAssigned: number;
  issueSpecifications: number;
  pullSpecifications: number;
  issueComments: number; // General comments on issues
  pullComments: number; // General comments on PRs (reviews, discussions)
  reviewsConducted: number; // Number of distinct review actions/groups
  // Add more categories as needed based on commentType analysis
};

// Type for the result map
export type BreakdownResult = {
  [contributor: string]: ContributionBreakdown;
};

/**
 * Calculates the breakdown of contribution types for each contributor.
 *
 * @param data The OrgRepoStructure containing contribution data for a specific run.
 * @returns A map where keys are contributor names and values are their contribution breakdown counts.
 */
export function calculateContributionBreakdown(data: OrgRepoStructure): BreakdownResult {
  const breakdown: BreakdownResult = {};

  for (const repo in data) {
    const repoData = data[repo];
    for (const issueOrPr in repoData) {
      const issueData = repoData[issueOrPr];
      for (const contributor in issueData) {
        const analytics: ContributorAnalytics = issueData[contributor];

        // Initialize breakdown for contributor if not present
        if (!breakdown[contributor]) {
          breakdown[contributor] = {
            tasksAssigned: 0,
            issueSpecifications: 0,
            pullSpecifications: 0,
            issueComments: 0,
            pullComments: 0,
            reviewsConducted: 0,
          };
        }
        const userBreakdown = breakdown[contributor];

        // Count assigned tasks (assuming reward > 0 means assigned/completed)
        if (analytics.task?.reward && analytics.task.reward > 0) {
          userBreakdown.tasksAssigned += 1;
        }

        // Count comment types
        const comments = Array.isArray(analytics.comments) ? analytics.comments : [];
        for (const comment of comments) {
          switch (comment.commentType) {
            case "ISSUE_SPECIFICATION":
              userBreakdown.issueSpecifications += 1;
              break;
            case "PULL_SPECIFICATION":
              userBreakdown.pullSpecifications += 1;
              break;
            case "ISSUE_AUTHOR": // Treat author comments like regular comments for now
            case "ISSUE_COLLABORATOR":
            case "ISSUE_CONTRIBUTOR": // Assuming general issue comments fall here
              userBreakdown.issueComments += 1;
              break;
            case "PULL_AUTHOR": // Treat author comments like regular comments for now
            case "PULL_COLLABORATOR":
            case "PULL_CONTRIBUTOR": // Assuming general PR comments fall here
              userBreakdown.pullComments += 1;
              break;
            default:
              // Count unknown types as general comments based on URL? Needs refinement.
              // For now, let's tentatively categorize based on issue/PR context if type unknown
              if (comment.url?.includes("/issues/")) {
                 userBreakdown.issueComments += 1;
              } else if (comment.url?.includes("/pull/")) {
                 userBreakdown.pullComments += 1;
              }
              break;
          }
        }

        // Count review actions/groups
        const reviewRewards = Array.isArray(analytics.reviewRewards) ? analytics.reviewRewards : [];
        // Count each reward group as one "review conducted" instance for simplicity
        userBreakdown.reviewsConducted += reviewRewards.length;
        // Alternatively, count individual reviews:
        // reviewRewards.forEach(group => {
        //   if (Array.isArray(group.reviews)) {
        //     userBreakdown.reviewsConducted += group.reviews.length;
        //   }
        // });
      }
    }
  }

  return breakdown;
}
