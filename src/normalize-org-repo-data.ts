import type { ContributorAnalytics, OrgRepoData } from "./data-transform";

/**
 * Recursively normalizes OrgRepoData to ensure every ContributorAnalytics object
 * has a valid comments array. Logs a warning to the browser console if normalization is needed.
 */
export function normalizeOrgRepoData(data: OrgRepoData, runId: string): OrgRepoData {
  let normalizationCount = 0;

  for (const org in data) {
    const orgData = data[org];
    for (const repo in orgData) {
      const repoData = orgData[repo];
      for (const issueOrPr in repoData) {
        const issueData = repoData[issueOrPr];
        for (const contributor in issueData) {
          const analytics = issueData[contributor] as ContributorAnalytics;
          if (
            !Array.isArray(analytics.comments)
          ) {
            normalizationCount++;
            // Log a warning with enough context for backend engineers
            // eslint-disable-next-line no-console
            console.warn(
              `[normalizeOrgRepoData] ContributorAnalytics.comments was not an array for contributor="${contributor}", org="${org}", repo="${repo}", issueOrPr="${issueOrPr}", runId="${runId}". Normalizing to [].`,
              { analytics }
            );
            analytics.comments = [];
          }
        }
      }
    }
  }

  if (normalizationCount > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[normalizeOrgRepoData] Performed normalization on ${normalizationCount} ContributorAnalytics objects in runId="${runId}". Please notify backend data engineers to ensure 'comments' is always an array.`
    );
  }

  return data;
}
