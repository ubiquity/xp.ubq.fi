import type { OrgRepoData } from "./data-transform";

/**
 * No-op normalization: The frontend now gracefully handles missing or undefined comments fields.
 * This function is retained for API compatibility but does not modify the data.
 */
export function normalizeOrgRepoData(data: OrgRepoData, runId: string): OrgRepoData {
  return data;
}
