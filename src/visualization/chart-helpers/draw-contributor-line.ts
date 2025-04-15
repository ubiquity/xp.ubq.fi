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
    xp: number; // Note: This is cumulative XP from process-chart-data
    eventType: string;
    issueOrPr: string; // Add issue/PR identifier
    url?: string;
    scoreDetails?: CommentScoreDetails; // Add score details
    contentPreview?: string; // Add content preview
    pointXP: number; // XP gained at this specific point (added in process-chart-data)
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
        const originalRankFactor = rank && rank > 0
            ? (1 / rank - originalMinRankOpacity) / originalRankRange
            : 0;
        const clampedFactor = Math.max(0, Math.min(1, originalRankFactor));
        baseMappedOpacity = minTargetOpacity + clampedFactor * targetRange;
    }

    let targetOpacity = isError ? maxTargetOpacity : baseMappedOpacity;

    let finalOpacity = targetOpacity;
    if (animationProgress !== undefined && animationProgress < 1) {
        finalOpacity = targetOpacity * animationProgress;
    }

    finalOpacity = Math.max(animationProgress === 0 ? 0 : minTargetOpacity, finalOpacity);
    finalOpacity = Math.min(maxTargetOpacity, finalOpacity);

    const finalLineOpacity = finalOpacity;
    const finalPointOpacity = finalOpacity;

    // --- Map Points to SVG Coords ---
    const timeRangeDuration = (maxTime && minTime) ? (maxTime - minTime) : 1;
    const chartWidth = width - leftMargin - rightMargin;
    const chartHeight = height - topMargin - bottomMargin;
    const logMaxXP = Math.log10(Math.max(1, maxXP));

    // Map points for the line path (using cumulative XP from ProcessedContributorData)
    const linePoints = entry.pointsForLine.map((pt) => {
        const x = leftMargin + (((pt.time ?? minTime ?? 0) - (minTime ?? 0)) / timeRangeDuration) * chartWidth;
        let y = topMargin + chartHeight;
        if (scaleMode === 'log' && maxXP > 1) {
            const logXP = Math.log10(Math.max(1, pt.xp)); // pt.xp here is cumulative
            y = topMargin + chartHeight * (1 - (logMaxXP > 0 ? logXP / logMaxXP : 0));
        } else {
            y = topMargin + chartHeight * (1 - (maxXP > 0 ? pt.xp / maxXP : 0)); // pt.xp here is cumulative
        }
        y = Number.isFinite(y) ? y : topMargin + chartHeight;
        return { x, y };
    });

    // Map *all* original points with full details for drawing shapes/tooltips
    const detailedPoints: SvgPoint[] = entry.allPoints.map((pt) => {
        const x = leftMargin + (((pt.time ?? minTime ?? 0) - (minTime ?? 0)) / timeRangeDuration) * chartWidth;
        let y = topMargin + chartHeight;
        if (scaleMode === 'log' && maxXP > 1) {
            const logXP = Math.log10(Math.max(1, pt.xp)); // pt.xp here is cumulative
            y = topMargin + chartHeight * (1 - (logMaxXP > 0 ? logXP / logMaxXP : 0));
        } else {
            y = topMargin + chartHeight * (1 - (maxXP > 0 ? pt.xp / maxXP : 0)); // pt.xp here is cumulative
        }
        y = Number.isFinite(y) ? y : topMargin + chartHeight;
        return {
            x, y,
            time: pt.time,
            xp: pt.xp, // Cumulative XP
            pointXP: pt.pointXP, // XP for this specific point
            eventType: pt.eventType,
            issueOrPr: pt.issueOrPr, // Pass through issue/PR identifier
            url: pt.url,
            scoreDetails: pt.scoreDetails,
            contentPreview: pt.contentPreview
        };
    });


    // --- Draw Line Path ---
    if (linePoints.length > 1) {
        const path = document.createElementNS(svgNS, "path");
        let d = `M ${linePoints[0].x} ${linePoints[0].y}`;
        for (let i = 1; i < linePoints.length; i++) {
            d += ` L ${linePoints[i].x} ${linePoints[i].y}`;
        }
        path.setAttribute("d", d);
        path.setAttribute("stroke", isError ? BAD : GOOD); // Line color still depends on error state
        path.setAttribute("stroke-width", "1"); // Adjusted stroke width
        path.setAttribute("fill", "none");
        path.setAttribute("opacity", finalLineOpacity.toString() );
        svg.appendChild(path);
    }

    // --- Draw Points (Shapes / Warning Symbols) ---
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

    // Retrieve WARNING color once
    const computedStyle = getComputedStyle(document.documentElement);
    const WARNING = computedStyle.getPropertyValue('--chart-color-warning').trim() || '#ffd700';

    // Iterate over *all* points to draw shapes or warning symbols
    detailedPoints.forEach((pt) => {
        // Only draw points whose time is at or before the current cutoff time
        const isPointVisible = cutoffTimeMs === undefined || pt.time <= cutoffTimeMs;

        if (isPointVisible) {
            let pointElement: SVGElement; // Use a generic type for the shape or group

            const pointSize = 8; // Diameter/side length for shapes
            const pointRadius = pointSize / 2; // Radius for circle

            if (pt.url) {
                 // If URL exists, draw shape based on eventType and make it clickable
                 if (pt.eventType === 'task') {
                     const circle = document.createElementNS(svgNS, "circle") as SVGCircleElement;
                     circle.setAttribute("cx", pt.x.toString());
                     circle.setAttribute("cy", pt.y.toString());
                     circle.setAttribute("r", pointRadius.toString());
                     circle.setAttribute("fill", GOOD);
                     circle.setAttribute("opacity", finalPointOpacity.toString());
                     pointElement = circle;
                 } else if (pt.eventType.startsWith('ISSUE_')) {
                     const square = document.createElementNS(svgNS, "rect") as SVGRectElement;
                     square.setAttribute("x", (pt.x - pointRadius).toString());
                     square.setAttribute("y", (pt.y - pointRadius).toString());
                     square.setAttribute("width", pointSize.toString());
                     square.setAttribute("height", pointSize.toString());
                     square.setAttribute("fill", GOOD);
                     square.setAttribute("opacity", finalPointOpacity.toString());
                     pointElement = square;
                 } else if (pt.eventType.startsWith('PULL_')) {
                      const diamond = document.createElementNS(svgNS, "polygon") as SVGPolygonElement;
                      const points = [
                          `${pt.x},${pt.y - pointRadius}`, `${pt.x + pointRadius},${pt.y}`,
                          `${pt.x},${pt.y + pointRadius}`, `${pt.x - pointRadius},${pt.y}`
                      ].join(" ");
                      diamond.setAttribute("points", points);
                      diamond.setAttribute("fill", GOOD);
                      diamond.setAttribute("opacity", finalPointOpacity.toString());
                      pointElement = diamond;
                 } else if (pt.eventType === 'REVIEW_REWARD') { // Specific case for review rewards - Use warning style but green
                      const group = document.createElementNS(svgNS, "g") as SVGGElement;
                      group.setAttribute("opacity", finalPointOpacity.toString()); // Apply opacity to the group
                      const diamondSize = 36; // Size of the diamond background (width/height)
                      const diamondRadius = diamondSize / 2;
                      const textFontSize = 24;

                      // Background Diamond (Green)
                      const bgDiamond = document.createElementNS(svgNS, "polygon") as SVGPolygonElement;
                      const diamondPoints = [
                          `${pt.x},${pt.y - diamondRadius}`, `${pt.x + diamondRadius},${pt.y}`,
                          `${pt.x},${pt.y + diamondRadius}`, `${pt.x - diamondRadius},${pt.y}`
                      ].join(" ");
                      bgDiamond.setAttribute("points", diamondPoints);
                      // Use a specific green color with transparency
                      const explicitGreen = "#28a745"; // Explicit green color
                      bgDiamond.setAttribute("fill", `${explicitGreen}66`); // Green background (~40% opacity using hex alpha)
                      bgDiamond.setAttribute("transform", `translate(0,3)`); // Center the diamond
                      group.appendChild(bgDiamond);

                      // Checkmark Symbol Text (Green)
                      const checkMark = document.createElementNS(svgNS, "text") as SVGTextElement;
                      checkMark.setAttribute("x", pt.x.toString());
                      checkMark.setAttribute("y", pt.y.toString());
                      checkMark.setAttribute("fill", explicitGreen); // Explicit green symbol
                      checkMark.setAttribute("font-size", `${textFontSize}px`); // Set font size
                      checkMark.setAttribute("font-weight", "bold");
                      checkMark.setAttribute("text-anchor", "middle");
                      checkMark.setAttribute("dominant-baseline", "central");
                      checkMark.setAttribute("class", "chart-reward-symbol"); // Use a different class if needed
                      checkMark.textContent = "✔"; // Checkmark symbol
                      group.appendChild(checkMark);

                      pointElement = group;

                      // Make clickable if URL exists (review rewards should have groupUrl)
                      if (pt.url) {
                          pointElement.style.cursor = "pointer";
                          pointElement.addEventListener("click", () => {
                              window.open(pt.url, '_blank');
                          });
                      }

                 } else { // Default case (e.g., 'comment' without specific type)
                      const circle = document.createElementNS(svgNS, "circle") as SVGCircleElement;
                      circle.setAttribute("cx", pt.x.toString());
                      circle.setAttribute("cy", pt.y.toString());
                      circle.setAttribute("r", pointRadius.toString());
                      circle.setAttribute("fill", GOOD);
                      circle.setAttribute("opacity", finalPointOpacity.toString());
                      pointElement = circle;
                 }

                 // Add click listener and cursor pointer because URL exists
                 pointElement.style.cursor = "pointer";
                 pointElement.addEventListener("click", () => {
                     window.open(pt.url, '_blank');
                 });

            } else {
                 // If NO URL exists, draw yellow warning symbol inside a red diamond
                 const group = document.createElementNS(svgNS, "g") as SVGGElement;
                 group.setAttribute("opacity", finalPointOpacity.toString()); // Apply opacity to the group
                 const diamondSize = 36; // Size of the diamond background (width/height)
                 const diamondRadius = diamondSize / 2;
                 const textFontSize = 24;

                 // Background Diamond
                 const bgDiamond = document.createElementNS(svgNS, "polygon") as SVGPolygonElement;
                 const diamondPoints = [
                     `${pt.x},${pt.y - diamondRadius}`, `${pt.x + diamondRadius},${pt.y}`,
                     `${pt.x},${pt.y + diamondRadius}`, `${pt.x - diamondRadius},${pt.y}`
                 ].join(" ");
                 bgDiamond.setAttribute("points", diamondPoints);
                 bgDiamond.setAttribute("fill", "#ff000020"); // Red background
                 bgDiamond.setAttribute("transform", `translate(0,3)`); // Center the diamond
                 // Opacity handled by group
                 group.appendChild(bgDiamond);

                 // Warning Symbol Text
                 const warningMark = document.createElementNS(svgNS, "text") as SVGTextElement;
                 warningMark.setAttribute("x", pt.x.toString());
                 warningMark.setAttribute("y", pt.y.toString());
                 warningMark.setAttribute("fill", WARNING); // Yellow symbol
                 // Opacity handled by group
                 warningMark.setAttribute("font-size", `${textFontSize}px`); // Set font size
                 warningMark.setAttribute("font-weight", "bold");
                 warningMark.setAttribute("text-anchor", "middle");
                 warningMark.setAttribute("dominant-baseline", "central");
                 warningMark.setAttribute("class", "chart-warning-symbol");
                 warningMark.textContent = "⚠";
                 group.appendChild(warningMark);

                 pointElement = group;
            }


            // Add hover event listeners to the created element (shape or group)
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
                // Note: pt.xp from detailedPoints already holds cumulative XP
                const cumulativeXP = pt.xp;

                // Calculate time since last contribution
                const pointIndex = detailedPoints.findIndex(p => p.time === pt.time); // Use detailedPoints index
                const prevPoint = pointIndex > 0 ? detailedPoints[pointIndex - 1] : null;
                const timeDelta = prevPoint ? pt.time - prevPoint.time : 0;

                // Calculate time to next contribution
                const nextPoint = pointIndex < detailedPoints.length - 1 ? detailedPoints[pointIndex + 1] : null;
                const nextTimeDelta = nextPoint ? nextPoint.time - pt.time : 0;

                // Get current rank if available
                const rank = ranks ? ranks[entry.contributor] : undefined;

                const date = new Date(pt.time).toLocaleString();
                // Use pt.pointXP for the specific XP gain of this event
                const pointXP = formatNumber(pt.pointXP);
                const totalXP = formatNumber(cumulativeXP); // Cumulative XP
                // Calculate percentage based on pointXP relative to cumulativeXP *at that point*
                const percentageOfTotal = cumulativeXP > 0 ? ((pt.pointXP / cumulativeXP) * 100).toFixed(1) : '0.0';
                const rankText = rank ? `Rank: #${rank}` : '';
                const timeSinceLastText = prevPoint ? `Time since last: ${formatTimeDelta(timeDelta)}` : 'First contribution';
                const timeToNextText = nextPoint ? `Time to next: ${formatTimeDelta(nextTimeDelta)}` : 'Last contribution';
                const eventTypeText = pt.eventType.replace(/_/g, ' ').toLowerCase();

                // Update tooltip content with sections
                tooltipText.textContent = '';
                const lines = [
                    `${entry.contributor}`,
                    '──────────',
                    rankText,
                    `Issue/PR: #${pt.issueOrPr}`, // Add Issue/PR number
                    `Role: ${eventTypeText}`,
                    `XP: ${pointXP} (${percentageOfTotal}%)`, // Show point XP and its % of current total
                    `Total XP: ${totalXP}`,
                    '──────────',
                    timeSinceLastText,
                    timeToNextText,
                    date,
                    pt.contentPreview ? `Preview: "${pt.contentPreview}"` : null
                ].filter(line => line !== null);

                // Add score details if available
                if (pt.scoreDetails) {
                    lines.push('──────────');
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
                    tspan.setAttribute("dy", i === 0 ? "0" : "1.2em");
                    tspan.textContent = line;
                    tooltipText.appendChild(tspan);
                });

                const bbox = tooltipText.getBBox();
                tooltipBg.setAttribute("width", (bbox.width + 16).toString());
                tooltipBg.setAttribute("height", (bbox.height + 16).toString());

                const tooltipX = Math.max(leftMargin, Math.min(pt.x - (bbox.width / 2) - 8, width - rightMargin - bbox.width - 16));
                const tooltipY = Math.max(topMargin, pt.y - bbox.height - 24);
                tooltip.setAttribute("transform", `translate(${tooltipX}, ${tooltipY})`);

                (tooltip as unknown as HTMLElement).style.opacity = "1";
            });

            pointElement.addEventListener("mouseout", () => {
                (tooltip as unknown as HTMLElement).style.opacity = "0";
            });

            svg.appendChild(pointElement);
        }
    });

    // --- Append Tooltip Group LAST ---
    svg.appendChild(tooltip);

    // --- Draw Contributor Label ---
    if (linePoints.length > 0) {
        const label = document.createElementNS(svgNS, "text");
        label.setAttribute("font-size", "14");
        label.setAttribute("fill", isError ? BAD : GOOD);
        label.setAttribute("opacity", finalLineOpacity.toString());
        label.setAttribute("text-anchor", "start");
        const rank = ranks ? ranks[entry.contributor] : undefined;
        const rankPrefix = rank ? `#${rank} ` : "";
        label.textContent = `${rankPrefix}${entry.contributor}`;

        const lastSvgPoint = linePoints[linePoints.length - 1];
        label.setAttribute("x", "0");
        label.setAttribute("y", "-9999");
        svg.appendChild(label);

        const textWidth = (label as SVGTextElement).getBBox().width;
        const unclampedX = lastSvgPoint.x + 8;
        const maxXAllowed = width - rightMargin - textWidth;
        let labelX = Math.min(unclampedX, maxXAllowed);
        const minLabelX = lastSvgPoint.x + 12;
        if (labelX < minLabelX) {
            labelX = minLabelX;
        }

        label.setAttribute("x", labelX.toString());
        label.setAttribute("y", (lastSvgPoint.y + 4).toString());
    }
}
