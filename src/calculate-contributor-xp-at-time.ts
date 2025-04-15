import type { TimeSeriesEntry } from "./data-transform";

/**
 * Calculates the total cumulative XP for each contributor up to a specific cutoff time.
 *
 * @param timeSeriesData The complete time series data.
 * @param cutoffTimeMs The timestamp (in milliseconds) to calculate the XP up to.
 * @returns A map where keys are contributor names and values are their total XP at the cutoff time.
 */
export function calculateContributorXpAtTime(
    timeSeriesData: TimeSeriesEntry[],
    cutoffTimeMs: number
): { [contributor: string]: number } {
    const contributorTotals: { [contributor: string]: number } = {};

    for (const entry of timeSeriesData) {
        const contributor = entry.contributor;
        if (contributorTotals[contributor] === undefined) {
            contributorTotals[contributor] = 0;
        }

        let cumulativeXpForContributor = 0;
        // Sort series by time to ensure correct cumulative calculation if not already sorted
        const sortedSeries = [...entry.series].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        for (const point of sortedSeries) {
            const pointTimeMs = new Date(point.time).getTime();
            if (pointTimeMs <= cutoffTimeMs) {
                cumulativeXpForContributor += point.xp;
            } else {
                // Since points are sorted, we can break early
                break;
            }
        }
        // Store the final cumulative XP for this contributor at the cutoff
        contributorTotals[contributor] = cumulativeXpForContributor;
    }

    return contributorTotals;
}
