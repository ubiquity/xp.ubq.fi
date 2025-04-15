/**
 * Draws the line, points, and label for a single contributor on the time series chart.
 */
import type { ProcessedContributorData } from "./process-chart-data";
import type { CommentScoreDetails } from "../../data-transform"; // Import the score details type

// Define the structure for points mapped to SVG coordinates
type SvgPoint = {
    x: number;
    y: number;
    time: number;
    xp: number;
    eventType: string;
    url?: string;
    scoreDetails?: CommentScoreDetails; // Add score details
    contentPreview?: string; // Add content preview
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

    // --- Opacity Calculation (Remapped to 12.5%-87.5%) ---
    const minTargetOpacity = 0.125; // New min
    const maxTargetOpacity = 0.875; // New max
    const targetRange = maxTargetOpacity - minTargetOpacity; // New range (0.75)

    const originalMinRankOpacity = 0.2; // Previous minimum used for normalization base
    const originalRankRange = 1.0 - originalMinRankOpacity; // 0.8

    let baseMappedOpacity = minTargetOpacity; // Default to minimum if no rank

    if (ranks) {
        const rank = ranks[entry.contributor];
        // Calculate original rank opacity factor (0 to 1, where 1 is rank 1)
        const originalRankFactor = rank && rank > 0
            ? (1 / rank - originalMinRankOpacity) / originalRankRange // Normalize to 0-1 range based on old scale
            : 0; // Rank 0 or undefined maps to the minimum
        // Clamp factor between 0 and 1
        const clampedFactor = Math.max(0, Math.min(1, originalRankFactor));
        // Map to new range [0.25, 0.75]
        baseMappedOpacity = minTargetOpacity + clampedFactor * targetRange;
    }

    // Apply error state (capped at max target)
    let targetOpacity = isError ? maxTargetOpacity : baseMappedOpacity;

    // Apply animation progress
    let finalOpacity = targetOpacity;
    if (animationProgress !== undefined && animationProgress < 1) {
        // Fade in from 0 opacity towards the target opacity
        finalOpacity = targetOpacity * animationProgress;
        // Ensure it doesn't go below a minimum visibility threshold during animation if desired,
        // but for now, let it fade from 0.
    }

    // Ensure final opacity respects the target floor, unless fully faded out by animation
    finalOpacity = Math.max(animationProgress === 0 ? 0 : minTargetOpacity, finalOpacity);
    // Ensure final opacity respects the target ceiling
    finalOpacity = Math.min(maxTargetOpacity, finalOpacity);

    // Use the same final opacity for line and points for simplicity now
    const finalLineOpacity = finalOpacity;
    const finalPointOpacity = finalOpacity;

    // Note: The previous logic slightly boosted point opacity.
    // This is removed to strictly adhere to the 25-75% range.
    // The !isHighlight && !isError check is also implicitly handled by the remapping.
    if (isError) {
        // Error state still uses the max target opacity
        // finalLineOpacity = maxTargetOpacity;
        // finalPointOpacity = maxTargetOpacity;
        // This is already handled above by setting targetOpacity = isError ? maxTargetOpacity : ...
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
        // Include original time/xp and new fields
        return { x, y, time: pt.time, xp: pt.xp, eventType: pt.eventType, url: pt.url, scoreDetails: pt.scoreDetails, contentPreview: pt.contentPreview };
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
        path.setAttribute("stroke-width", "1");
        path.setAttribute("fill", "none");
        path.setAttribute("opacity", finalLineOpacity.toString() );
        svg.appendChild(path);
    }

    // --- Draw Points (Circles / Warning Symbols) ---
    // Create tooltip elements first, but append them *after* points
    const tooltip = document.createElementNS(svgNS, "g") as SVGGElement;
    tooltip.setAttribute("class", "chart-tooltip");
    const tooltipBg = document.createElementNS(svgNS, "rect") as SVGRectElement;
    tooltipBg.setAttribute("class", "chart-tooltip-bg");
    tooltipBg.setAttribute("width", "0");
    tooltipBg.setAttribute("height", "0");
    tooltip.appendChild(tooltipBg);
    const tooltipText = document.createElementNS(svgNS, "text") as SVGTextElement;
    tooltipText.setAttribute("class", "chart-tooltip-text");
    tooltipText.setAttribute("x", "8");
    tooltipText.setAttribute("y", "16");
    tooltip.appendChild(tooltipText);
    // --- End Tooltip Element Creation ---

    // Iterate over *all* points to draw circles with potentially varying radius
    circlePoints.forEach((pt) => {
        // Only draw circles whose time is at or before the current cutoff time
        const isPointVisible = cutoffTimeMs === undefined || pt.time <= cutoffTimeMs;

        if (isPointVisible) {
            let pointElement: SVGElement; // Use a generic type for circle or text

            // Calculate radius dynamically based on cutoff time (only needed for circles)
            let currentRadius = startRadius;
            if (cutoffTimeMs !== undefined) {
                if (pt.time <= cutoffTimeMs) {
                    currentRadius = endRadius;
                }
            } else {
                currentRadius = endRadius; // Default small if animation finished
            }

            if (pt.url) {
                // Create a CIRCLE if URL exists
                const circle = document.createElementNS(svgNS, "circle") as SVGCircleElement;
                circle.setAttribute("cx", pt.x.toString());
                circle.setAttribute("cy", pt.y.toString());
                circle.setAttribute("r", currentRadius.toString()); // Use endRadius (currently 4)
                circle.setAttribute("fill", GOOD); // Cyan for clickable points
                circle.setAttribute("opacity", finalPointOpacity.toString());
                circle.style.cursor = "pointer"; // Add cursor style

                // Add click listener to the circle
                circle.addEventListener("click", () => {
                    if (pt.url) { // Redundant check, but safe
                        window.open(pt.url, '_blank');
                    }
                });
                pointElement = circle;

            } else {
                // Create an 'X' TEXT element if no URL exists
                const warningMark = document.createElementNS(svgNS, "text") as SVGTextElement;
                warningMark.setAttribute("x", pt.x.toString());
                warningMark.setAttribute("y", pt.y.toString());
                warningMark.setAttribute("fill", BAD); // Use BAD color (red)
                warningMark.setAttribute("opacity", finalPointOpacity.toString());
                warningMark.setAttribute("font-size", "24px"); // Adjust size as needed
                warningMark.setAttribute("font-weight", "bold"); // Ensure bold
                warningMark.setAttribute("text-anchor", "middle");
                warningMark.setAttribute("dominant-baseline", "central"); // Use central for better vertical alignment
                warningMark.setAttribute("class", "chart-warning-symbol"); // Add class for CSS targeting
                warningMark.textContent = "⚠"; // Use warning symbol
                // No click listener or pointer cursor for '⚠'
                pointElement = warningMark;
            }


            // Add hover event listeners to the created element (circle or text)
            pointElement.addEventListener("mouseover", () => {
                // Helper function to format numbers with k/M suffixes
                const formatNumber = (num: number): string => {
                    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
                    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
                    return num.toLocaleString();
                };

                // Helper function to format time differences
                const formatTimeDelta = (ms: number): string => {
                    const seconds = Math.floor(ms / 1000);
                    const minutes = Math.floor(seconds / 60);
                    const hours = Math.floor(minutes / 60);
                    const days = Math.floor(hours / 24);

                    if (days > 0) return `${days}d`;
                    if (hours > 0) return `${hours}h`;
                    if (minutes > 0) return `${minutes}m`;
                    return `${seconds}s`;
                };

                // Calculate cumulative XP up to this point
                const pointIndex = entry.allPoints.findIndex(p => p.time === pt.time);
                const cumulativeXP = entry.allPoints
                    .slice(0, pointIndex + 1)
                    .reduce((sum, p) => sum + p.xp, 0);

                // Calculate time since last contribution
                const prevPoint = pointIndex > 0 ? entry.allPoints[pointIndex - 1] : null;
                const timeDelta = prevPoint ? pt.time - prevPoint.time : 0;

                // Calculate time to next contribution
                const nextPoint = pointIndex < entry.allPoints.length - 1 ? entry.allPoints[pointIndex + 1] : null;
                const nextTimeDelta = nextPoint ? nextPoint.time - pt.time : 0;

                // Get current rank if available
                const rank = ranks ? ranks[entry.contributor] : undefined;
                // Removed rankChange calculation as historical rank data is not available

                const date = new Date(pt.time).toLocaleString();
                const pointXP = formatNumber(pt.xp); // XP for this specific point
                const totalXP = formatNumber(cumulativeXP); // Cumulative XP up to this point
                const percentageOfTotal = cumulativeXP > 0 ? ((pt.xp / cumulativeXP) * 100).toFixed(1) : '0.0';
                const rankText = rank ? `Rank: #${rank}` : ''; // Display only current rank
                const timeSinceLastText = prevPoint ? `Time since last: ${formatTimeDelta(timeDelta)}` : 'First contribution';
                const timeToNextText = nextPoint ? `Time to next: ${formatTimeDelta(nextTimeDelta)}` : 'Last contribution';
                const eventTypeText = pt.eventType.replace(/_/g, ' ').toLowerCase(); // Format event type

                // Update tooltip content with sections
                tooltipText.textContent = ''; // Clear previous content
                const lines = [
                    `${entry.contributor}`,
                    '──────────', // Section separator
                    rankText,
                    `Role: ${eventTypeText}`, // Changed label from Event: to Role:
                    `XP: ${pointXP} (${percentageOfTotal}%)`, // Renamed for clarity
                    `Total XP: ${totalXP}`,
                    '──────────',
                    timeSinceLastText,
                    timeToNextText, // Add time to next
                    date,
                    pt.contentPreview ? `Preview: "${pt.contentPreview}"` : null // Add content preview if exists
                    // Removed the explicit URL line: pt.url ? `Link: ${pt.url}` : null
                ].filter(line => line !== null); // Filter out null values

                // Add score details if available
                if (pt.scoreDetails) {
                    lines.push('──────────'); // Separator for score details
                    lines.push('Comment Analysis:');
                    if (pt.scoreDetails.formatting?.result !== undefined) lines.push(`  Format: ${pt.scoreDetails.formatting.result.toFixed(2)}`);
                    if (pt.scoreDetails.words?.result !== undefined) lines.push(`  Words: ${pt.scoreDetails.words.result.toFixed(2)} (${pt.scoreDetails.words.wordCount})`);
                    if (pt.scoreDetails.readability?.score !== undefined) lines.push(`  Readability: ${pt.scoreDetails.readability.score.toFixed(2)}`);
                    if (pt.scoreDetails.relevance !== undefined) lines.push(`  Relevance: ${pt.scoreDetails.relevance.toFixed(2)}`);
                    if (pt.scoreDetails.priority !== undefined) lines.push(`  Priority: ${pt.scoreDetails.priority}`);
                    if (pt.scoreDetails.multiplier !== undefined) lines.push(`  Multiplier: ${pt.scoreDetails.multiplier}`);
                }


                lines.forEach((line, i) => {
                    const tspan = document.createElementNS(svgNS, "tspan") as SVGTSpanElement;
                    tspan.setAttribute("x", "8");
                    tspan.setAttribute("dy", i === 0 ? "0" : "1.2em"); // Adjust line spacing
                    // Display the line content directly
                    tspan.textContent = line;
                    tooltipText.appendChild(tspan);
                });

                // Get tooltip dimensions after adding content
                const bbox = tooltipText.getBBox();
                tooltipBg.setAttribute("width", (bbox.width + 16).toString()); // Add padding
                tooltipBg.setAttribute("height", (bbox.height + 16).toString()); // Add padding

                // Position tooltip above the circle, ensuring it stays within bounds
                const tooltipX = Math.max(leftMargin, Math.min(pt.x - (bbox.width / 2) - 8, width - rightMargin - bbox.width - 16)); // Center above point, clamp within chart area
                const tooltipY = Math.max(topMargin, pt.y - bbox.height - 24); // Position above point, clamp within chart area
                tooltip.setAttribute("transform", `translate(${tooltipX}, ${tooltipY})`);

                // Show tooltip
                (tooltip as unknown as HTMLElement).style.opacity = "1";
            });

            // Keep mouseout to hide tooltip (attach to the generic element)
            pointElement.addEventListener("mouseout", () => {
                (tooltip as unknown as HTMLElement).style.opacity = "0";
            });

            // Click listener is handled conditionally above for circles only

            svg.appendChild(pointElement); // Append the circle or warning symbol
        }
    });

    // --- Append Tooltip Group LAST ---
    // This ensures the tooltip renders on top of the data points for this line
    svg.appendChild(tooltip);

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
