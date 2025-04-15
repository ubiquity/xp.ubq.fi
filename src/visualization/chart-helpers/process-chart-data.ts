/**
 * Processes raw time series data for chart rendering.
 * Calculates cumulative XP, filters points based on cutoff time,
 * and interpolates the last visible segment if needed.
 */
import type { TimeSeriesEntry } from "../../data-transform";

// Define the structure for points with cumulative XP
type CumulativePoint = {
  time: number;
  xp: number;
};

// Define the output structure for processed data
export interface ProcessedContributorData extends TimeSeriesEntry {
  pointsForLine: CumulativePoint[]; // Points to use for drawing the line path (filtered/interpolated)
  allPoints: CumulativePoint[]; // All calculated cumulative points (for circles, etc.)
}

interface ProcessChartDataOptions {
  data: TimeSeriesEntry[];
  cutoffTimeMs?: number; // Optional cutoff time for filtering/interpolation
}

export function processChartData({
  data,
  cutoffTimeMs,
}: ProcessChartDataOptions): ProcessedContributorData[] {

  const processedData = data.map(entry => {
    const sortedSeries = [...entry.series].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    let cumulative = 0;

    // Calculate cumulative points
    const allCalculatedPoints: CumulativePoint[] = sortedSeries.map(pt => {
      cumulative += pt.xp;
      const pointTime = new Date(pt.time).getTime();
      return { time: pointTime, xp: cumulative };
    });

    // Filter points based on cutoffTimeMs for line drawing and interpolate the last segment
    let pointsToRenderForLine: CumulativePoint[] = allCalculatedPoints;
    if (cutoffTimeMs !== undefined && allCalculatedPoints.length > 0) {
      let lastVisibleIndex = -1;
      for (let i = 0; i < allCalculatedPoints.length; i++) {
        if (allCalculatedPoints[i].time <= cutoffTimeMs) {
          lastVisibleIndex = i;
        } else {
          break; // Points are sorted, no need to check further
        }
      }

      if (lastVisibleIndex === -1) {
        // If cutoff is before the first point, check if it's exactly at the first point's time
        if (allCalculatedPoints.length > 0 && cutoffTimeMs === allCalculatedPoints[0].time) {
             pointsToRenderForLine = allCalculatedPoints.slice(0, 1);
        }
        // If cutoff is *after* the first point's time but still before it visually (e.g., due to interpolation logic needing a previous point)
        // We might still want to render the first point if the cutoff is relevant.
        // Let's refine: if cutoff is >= first point time, we should at least consider the first point.
        else if (allCalculatedPoints.length > 0 && cutoffTimeMs >= allCalculatedPoints[0].time) {
             // If only one point exists and cutoff is after it, render that point.
             if (allCalculatedPoints.length === 1) {
                 pointsToRenderForLine = allCalculatedPoints.slice(0, 1);
             } else {
                 // If multiple points, but cutoff is before the *second* point,
                 // we might need to interpolate between an implicit start (0,0?) or just show the first point.
                 // For simplicity, let's just show the first point if the cutoff is relevant to it.
                 // A more complex interpolation from time=0 might be needed for perfect accuracy at the start.
                 pointsToRenderForLine = allCalculatedPoints.slice(0, 1); // Default to showing first point if cutoff is past it
             }
        } else {
             // Cutoff is strictly before the first point's time
             pointsToRenderForLine = [];
        }

      } else {
        // Cutoff is after or at the point at lastVisibleIndex
        pointsToRenderForLine = allCalculatedPoints.slice(0, lastVisibleIndex + 1);
        const nextPoint = allCalculatedPoints[lastVisibleIndex + 1];

        // Check if interpolation is needed between the last visible point and the next one
        if (nextPoint && cutoffTimeMs > allCalculatedPoints[lastVisibleIndex].time) {
           const prevPoint = allCalculatedPoints[lastVisibleIndex];
           const timeDiff = nextPoint.time - prevPoint.time;
           if (timeDiff > 0) { // Avoid division by zero
             const fraction = (cutoffTimeMs - prevPoint.time) / timeDiff;
             const interpolatedXP = prevPoint.xp + (nextPoint.xp - prevPoint.xp) * fraction;
             // Add the interpolated point at the exact cutoff time
             pointsToRenderForLine.push({ time: cutoffTimeMs, xp: interpolatedXP });
           }
           // If timeDiff is 0 (duplicate times), just use the point at lastVisibleIndex
        }
      }
    }

     // Safeguard: If filtering resulted in empty but shouldn't have (e.g., cutoff exactly at first point time)
     if (allCalculatedPoints.length > 0 && pointsToRenderForLine.length === 0 && cutoffTimeMs !== undefined && cutoffTimeMs >= allCalculatedPoints[0].time) {
        // Re-check the logic above, but as a fallback, ensure the first point is included if cutoff is at or after it.
        pointsToRenderForLine = allCalculatedPoints.slice(0, 1);
        // Potentially re-run interpolation logic if needed here, though the main block should handle it.
     }

     // Return original entry data spread, plus the calculated points
    return {
        ...entry,
        pointsForLine: pointsToRenderForLine,
        allPoints: allCalculatedPoints
    };

  });

  // Filter out contributors who have no points *at all* after processing
  return processedData.filter(entry => entry.allPoints.length > 0);
}
