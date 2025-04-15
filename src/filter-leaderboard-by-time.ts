import type { LeaderboardEntry, TimeSeriesEntry } from "./data-transform";

/**
 * Filters and adjusts leaderboard data to reflect the state at a specific cutoff time.
 * It recalculates totalXP and issueOverview based on time series data up to the cutoff.
 * Other properties like userId, repoOverview, issuePrCountOverview are preserved from the original data.
 *
 * @param fullLeaderboardData The complete, original leaderboard data.
 * @param fullTimeSeriesData The complete time series data.
 * @param cutoffTimeMs The timestamp (in milliseconds) to filter up to.
 * @returns A new LeaderboardEntry[] array representing the state at the cutoff time.
 */
export function filterLeaderboardDataByTime(
    fullLeaderboardData: LeaderboardEntry[],
    fullTimeSeriesData: TimeSeriesEntry[],
    cutoffTimeMs: number
): LeaderboardEntry[] {

    // 1. Calculate cumulative XP per issue per contributor up to cutoffTimeMs
    const cumulativeXpAtCutoff: { [contributor: string]: { [issueKey: string]: number } } = {};

    for (const entry of fullTimeSeriesData) {
        const contributor = entry.contributor;
        if (!cumulativeXpAtCutoff[contributor]) {
            cumulativeXpAtCutoff[contributor] = {};
        }

        for (const point of entry.series) {
            const pointTimeMs = new Date(point.time).getTime();
            if (pointTimeMs <= cutoffTimeMs) {
                // Assuming TimeSeriesEntry has org/repo and point has issue identifier
                // Adjust this based on the actual structure if different
                const issueKey = `${entry.org}/${entry.repo}#${point.issue}`; // Construct the key
                if (!cumulativeXpAtCutoff[contributor][issueKey]) {
                    cumulativeXpAtCutoff[contributor][issueKey] = 0;
                }
                cumulativeXpAtCutoff[contributor][issueKey] += point.xp;
            }
        }
    }

    // 2. Create a deep copy and adjust based on cumulative XP at cutoff
    const adjustedLeaderboard: LeaderboardEntry[] = JSON.parse(JSON.stringify(fullLeaderboardData));

    for (const entry of adjustedLeaderboard) {
        let newTotalXP = 0;
        const contributorCutoffData = cumulativeXpAtCutoff[entry.contributor] ?? {};

        // Adjust issueOverview
        for (const issueKey in entry.issueOverview) {
            const xpAtCutoff = contributorCutoffData[issueKey] ?? 0;
            // The XP for an issue at cutoff cannot exceed its original total XP
            // (This assumes issueOverview in fullLeaderboardData is the final total)
            // We actually just want the cumulative value calculated up to the cutoff.
            entry.issueOverview[issueKey] = xpAtCutoff;
            newTotalXP += xpAtCutoff;
        }

        // Update totalXP
        entry.totalXP = newTotalXP;

        // Note: repoOverview and issuePrCountOverview are NOT recalculated here.
        // They reflect the overall counts from the original data.
        // Recalculating them based on time would require more complex data/logic.
    }

    // 3. Re-sort by the new totalXP
    adjustedLeaderboard.sort((a, b) => b.totalXP - a.totalXP);

    return adjustedLeaderboard;
}
