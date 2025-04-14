/**
 * Draws the line, points, and label for a single contributor on the time series chart.
 */
import type { ProcessedContributorData } from "./process-chart-data";

// Define the structure for points mapped to SVG coordinates
type SvgPoint = {
    x: number;
    y: number;
    time: number;
    xp: number;
};

interface DrawContributorLineOptions {
    svg: SVGSVGElement;
    svgNS: string;
    entry: ProcessedContributorData;
    isHighlight: boolean;
    isError: boolean;
    minTime: number;
    maxTime: number;
    maxXP: number;
    width: number;
    height: number;
    leftMargin: number;
    rightMargin: number;
    topMargin: number;
    bottomMargin: number;
    GOOD: string;
    BAD: string;
    ranks?: { [contributor: string]: number };
    animationProgress?: number;
    cutoffTimeMs?: number;
    startRadius: number;
    endRadius: number;
    scaleMode?: 'linear' | 'log'; // Add scale mode option
}

export function drawContributorLine({
    svg,
    svgNS,
    entry,
    isHighlight,
    isError,
    minTime,
    maxTime,
    maxXP,
    width,
    height,
    leftMargin,
    rightMargin,
    topMargin,
    bottomMargin,
    GOOD,
    BAD,
    ranks,
    animationProgress,
    cutoffTimeMs,
    startRadius,
    endRadius,
    scaleMode = 'linear', // Default to linear
}: DrawContributorLineOptions): void {

    // --- Opacity Calculation ---
    let rankOpacity = 0.5;
    const minRankOpacity = 0.2;
    if (ranks) {
        const rank = ranks[entry.contributor];
        rankOpacity = (rank && rank > 0) ? Math.max(minRankOpacity, 1 / rank) : minRankOpacity;
    }
    let targetOpacity = rankOpacity;
    if (isError) { targetOpacity = 0.85; }

    let modulatedOpacity = targetOpacity;
    if (animationProgress !== undefined && animationProgress < 1) {
        modulatedOpacity = targetOpacity * animationProgress;
    }

    let finalLineOpacity = modulatedOpacity * 0.5;
    let finalPointOpacity = Math.min(1.0, finalLineOpacity + 0.25);

    // Removed the special case for isHighlight
    // if (isHighlight) {
    //     finalLineOpacity = 1.0 * (animationProgress ?? 1);
    //     finalPointOpacity = 1.0 * (animationProgress ?? 1);
    // }

    // Error state still overrides opacity
    if (isError) {
        finalLineOpacity = 0.85; // Keep error highlight strong
        finalPointOpacity = 0.85; // Keep error highlight strong
    }

    if (!isHighlight && !isError) {
        finalLineOpacity = Math.max(0.05, finalLineOpacity);
        finalPointOpacity = Math.max(0.05, finalPointOpacity);
    }

    // --- Map Points to SVG Coords ---
    const timeRangeDuration = (maxTime && minTime) ? (maxTime - minTime) : 1; // Avoid division by zero
    const chartWidth = width - leftMargin - rightMargin;
    const chartHeight = height - topMargin - bottomMargin;

    const logMaxXP = Math.log10(Math.max(1, maxXP)); // Pre-calculate for log scale

    // Map the points used for drawing the line path
    const linePoints = entry.pointsForLine.map((pt) => {
        const x = leftMargin + (((pt.time ?? minTime ?? 0) - (minTime ?? 0)) / timeRangeDuration) * chartWidth;
        let y = topMargin + chartHeight; // Default to bottom
        if (scaleMode === 'log' && maxXP > 1) {
            const logXP = Math.log10(Math.max(1, pt.xp));
            y = topMargin + chartHeight * (1 - (logMaxXP > 0 ? logXP / logMaxXP : 0));
        } else { // Linear scale
            y = topMargin + chartHeight * (1 - (maxXP > 0 ? pt.xp / maxXP : 0));
        }
        y = Number.isFinite(y) ? y : topMargin + chartHeight; // Fallback
        return { x, y }; // Only need x, y for path
    });

    // Map *all* original points to SVG Coords for drawing circles
    const circlePoints: SvgPoint[] = entry.allPoints.map((pt) => {
        const x = leftMargin + (((pt.time ?? minTime ?? 0) - (minTime ?? 0)) / timeRangeDuration) * chartWidth;
        let y = topMargin + chartHeight; // Default to bottom
        if (scaleMode === 'log' && maxXP > 1) {
            const logXP = Math.log10(Math.max(1, pt.xp));
            y = topMargin + chartHeight * (1 - (logMaxXP > 0 ? logXP / logMaxXP : 0));
        } else { // Linear scale
            y = topMargin + chartHeight * (1 - (maxXP > 0 ? pt.xp / maxXP : 0));
        }
        y = Number.isFinite(y) ? y : topMargin + chartHeight; // Fallback
        // Include original time/xp
        return { x, y, time: pt.time, xp: pt.xp };
    });


    // --- Draw Line Path ---
    if (linePoints.length > 1) {
        const path = document.createElementNS(svgNS, "path");
        let d = `M ${linePoints[0].x} ${linePoints[0].y}`;
        for (let i = 1; i < linePoints.length; i++) {
            d += ` L ${linePoints[i].x} ${linePoints[i].y}`;
        }
        path.setAttribute("d", d);
        path.setAttribute("stroke", isError ? BAD : GOOD);
        path.setAttribute("stroke-width", "2");
        path.setAttribute("fill", "none");
        path.setAttribute("opacity", finalLineOpacity.toString());
        svg.appendChild(path);
    }

    // --- Draw Points (Circles) ---
    // Iterate over *all* points to draw circles with potentially varying radius
    circlePoints.forEach((pt) => {
        // Only draw circles whose time is at or before the current cutoff time
        const isPointVisible = cutoffTimeMs === undefined || pt.time <= cutoffTimeMs;

        if (isPointVisible) {
            const circle = document.createElementNS(svgNS, "circle");
            circle.setAttribute("cx", pt.x.toString());
            circle.setAttribute("cy", pt.y.toString());
            // Calculate radius dynamically based on cutoff time
            let currentRadius = startRadius;
            if (cutoffTimeMs !== undefined) {
                if (pt.time <= cutoffTimeMs) {
                    currentRadius = endRadius;
                }
            } else {
                currentRadius = endRadius; // Default small if animation finished
            }
            circle.setAttribute("r", currentRadius.toString());
            circle.setAttribute("fill", isError ? BAD : GOOD);
            circle.setAttribute("opacity", finalPointOpacity.toString());
            svg.appendChild(circle);
        }
    });

    // --- Draw Contributor Label ---
    // Label should only appear if there are points *rendered* for the line
    if (linePoints.length > 0) {
        const label = document.createElementNS(svgNS, "text");
    label.setAttribute("font-size", "14");
    label.setAttribute("fill", isError ? BAD : GOOD);
    label.setAttribute("opacity", finalLineOpacity.toString());
    label.setAttribute("text-anchor", "start");
    // Add rank prefix if available
    const rank = ranks ? ranks[entry.contributor] : undefined;
    const rankPrefix = rank ? `#${rank} ` : "";
    label.textContent = `${rankPrefix}${entry.contributor}`;

    // Position label relative to the *last rendered point* on the line
        const lastSvgPoint = linePoints[linePoints.length - 1];
        label.setAttribute("x", "0"); // Set initial position for bounding box calculation
        label.setAttribute("y", "-9999"); // Position off-screen initially
        svg.appendChild(label); // Append temporarily to calculate width

        // Assert type to SVGTextElement to access getBBox
        const textWidth = (label as SVGTextElement).getBBox().width;
        const unclampedX = lastSvgPoint.x + 8; // Desired position right of the point
        const maxXAllowed = width - rightMargin - textWidth; // Max X to prevent overflow
        let labelX = Math.min(unclampedX, maxXAllowed); // Clamp X to stay within bounds

        // Ensure label doesn't overlap the point itself if clamped
        const minLabelX = lastSvgPoint.x + 12; // Minimum distance from point
        if (labelX < minLabelX) {
            labelX = minLabelX;
        }

        // Final positioning
        label.setAttribute("x", labelX.toString());
        label.setAttribute("y", (lastSvgPoint.y + 4).toString()); // Vertically align near the point
    }
}
