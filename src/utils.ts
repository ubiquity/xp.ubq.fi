/**
 * Returns the runId from the URL query string (?run=...)
 */
export function getRunIdFromQuery(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("run");
}

/**
 * Groups flat artifact data into org -> repo -> issue/pr -> contributor structure.
 * Input: { [filename]: artifactData }
 * Output: { [org]: { [repo]: { [issueOrPr]: { [contributor]: ContributorAnalytics } } } }
 */
export function groupArtifactsByOrgRepoIssue(flatArtifacts: Record<string, any>) {
  const grouped: Record<string, Record<string, Record<string, any>>> = {};

  for (const key in flatArtifacts) {
    // Example key: results-ubiquity-os-marketplace
    const [_, org, ...repoParts] = key.split('-');
    if (!org) continue;

    const repo = repoParts.join('-');
    const data = flatArtifacts[key];

    // Initialize org and repo objects if needed
    if (!grouped[org]) grouped[org] = {};
    if (!grouped[org][repo]) grouped[org][repo] = {};

    // Each array item contains contributor data for a specific issue
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        // Skip non-object items or empty objects
        if (!item || typeof item !== "object") return;

        // Create a container for this issue's contributors
        const contributors: Record<string, any> = {};

        // Each key in the item should be a contributor name
        // Except for metadata keys like "id", "url", etc.
        for (const key in item) {
          if (typeof item[key] === "object" && item[key]?.userId !== undefined) {
            // This is a contributor entry
            contributors[key] = item[key];
          }
        }

        if (Object.keys(contributors).length > 0) {
          grouped[org][repo][`${index}`] = contributors;
        }
      });
    }
  }

  return grouped;
}
