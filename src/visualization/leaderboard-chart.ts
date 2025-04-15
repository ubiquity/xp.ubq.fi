/**
 * Leaderboard Chart Renderer (SVG)
 * - Horizontal stacked bar chart for contributor XP.
 * - Uses two complementary colors (good: cyan, bad: red) with shades for visual hierarchy.
 * - All other elements are greyscale for minimal, high-contrast UI.
 * - Color variables can be adjusted for theme.
 */

import type { LeaderboardEntry } from "../data-transform";

/**
 * Renders a horizontal stacked bar chart leaderboard into the given container.
 * @param data LeaderboardEntry[]
 * @param container HTMLElement
 * @param options Optional config
 */
export function renderLeaderboardChart(
  data: LeaderboardEntry[],
  container: HTMLElement,
  options?: {
    width?: number;
    height?: number;
    barHeight?: number;
    barGap?: number;
    leftMargin?: number;
    rightMargin?: number;
    topMargin?: number;
    bottomMargin?: number;
    repoKeys?: string[]; // Optional: consistent repo order
    highlightContributor?: string; // Optionally highlight a contributor
    errorContributors?: string[]; // Optionally mark contributors as "bad"
    ranks?: { [contributor: string]: number }; // Add ranks option
    scaleMode?: 'linear' | 'log'; // Add scale mode option
    overallMaxXP?: number; // Add option for overall max XP for consistent scaling
  }
) {
  // Get CSS variables
  const computedStyle = getComputedStyle(document.documentElement);
  const GOOD = computedStyle.getPropertyValue('--chart-color-good').trim();
  const BAD = computedStyle.getPropertyValue('--chart-color-bad').trim();
  const GREY_DARK = computedStyle.getPropertyValue('--chart-color-grey-dark').trim();
  const GREY = computedStyle.getPropertyValue('--chart-color-grey').trim();
  const GREY_LIGHT = computedStyle.getPropertyValue('--chart-color-grey-light').trim();
  const BG = computedStyle.getPropertyValue('--chart-color-bg').trim();

  // --- Config ---
  // SVG namespace
  const svgNS = "http://www.w3.org/2000/svg";

  // Responsive width: use container's width or fallback to 600
  const width = options?.width ?? (container.clientWidth || container.getBoundingClientRect().width || 600);
  const height = options?.height ?? Math.max(200, data.length * 32 + 64);
  const barHeight = options?.barHeight ?? 24;
  const barGap = options?.barGap ?? 8;

  // Calculate dynamic margins based on label widths
  const tempSvg = document.createElementNS(svgNS, "svg");
  tempSvg.style.visibility = "hidden";
  document.body.appendChild(tempSvg);

  // Measure contributor label widths (including potential rank)
  let maxContributorWidth = 0;
  const ranks = options?.ranks ?? {};
  data.forEach(entry => {
    const rank = ranks[entry.contributor];
    const rankPrefix = rank ? `#${rank} ` : ""; // Add "#rank " prefix if rank exists
    const labelText = `${rankPrefix}${entry.contributor}`;

    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("font-size", "16");
    label.textContent = labelText; // Use text with prefix for measurement
    tempSvg.appendChild(label);
    const labelWidth = label.getBBox().width;
    maxContributorWidth = Math.max(maxContributorWidth, labelWidth);
  });

  // Measure XP label widths
  let maxXpWidth = 0;
  data.forEach(entry => {
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("font-size", "14");
    label.textContent = `${entry.totalXP.toFixed(2)} XP`;
    tempSvg.appendChild(label);
    const labelWidth = label.getBBox().width;
    maxXpWidth = Math.max(maxXpWidth, labelWidth);
  });

  document.body.removeChild(tempSvg);

  // Set margins with padding
  const leftMargin = options?.leftMargin ?? Math.max(120, maxContributorWidth + 32); // base padding of 32px
  const rightMargin = options?.rightMargin ?? Math.max(32, maxXpWidth + 32); // base padding of 32px
  const topMargin = options?.topMargin ?? 32;
  const bottomMargin = options?.bottomMargin ?? 32;
  const highlightContributor = options?.highlightContributor ?? data[0]?.contributor;
  const errorContributors = options?.errorContributors ?? [];

  // Determine all issue keys (for consistent stacking order)
  // Issue key format: repo#issueNumber
  const allIssueKeys = Array.from(
    new Set(data.flatMap(entry => Object.keys(entry.issueBreakdown)))
  );

  // Find max XP of currently displayed data (for bar widths relative to current view)
  const currentMaxXP = Math.max(...data.map(entry => entry.totalXP), 1);
  // Use overallMaxXP for axis/grid/tick scaling if provided, otherwise use current max
  const maxXP = options?.overallMaxXP ?? currentMaxXP;

  // SVG root
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", height.toString());
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.display = "block";
  svg.style.background = BG;

  // Clear container and append SVG
  container.innerHTML = "";
  container.appendChild(svg);

  // --- Scale Mode Setup ---
  const scaleMode = options?.scaleMode ?? 'linear';
  const logMaxXP = Math.log10(Math.max(1, maxXP)); // Use log10(1)=0 for maxXP <= 1
  // Ensure chartWidth is non-negative
  const chartWidth = Math.max(0, width - leftMargin - rightMargin);

  // --- Draw Vertical Grid Lines & X-Axis Ticks (Aligned) ---
  const numSegments = 4; // Always use 4 segments for 5 lines/ticks
  for (let i = 0; i <= numSegments; i++) {
      // 1. Calculate the LINEAR value this tick represents (0%, 25%, ..., 100% of maxXP)
      const linearTickValue = (i / numSegments) * maxXP;

      // 2. Calculate the POSITION 'x' based on the CURRENT scale mode
      let x = leftMargin; // Default to left margin
      if (scaleMode === 'log' && maxXP > 1) { // Log scale only makes sense if maxXP > 1
          // Map the linear value [0, maxXP] to the log range [log10(1), log10(maxXP)]
          // Add 1 before taking log to handle linearTickValue=0 correctly (log10(1)=0)
          // Use maxXP directly for the max log value since we established maxXP > 1
          const logValue = Math.log10(linearTickValue + 1);
          const logMaxValue = Math.log10(maxXP + 1); // Use maxXP+1 for the range end

          if (logMaxValue > 0) { // Avoid division by zero if maxXP was exactly 1 (though filtered above)
              x = leftMargin + (logValue / logMaxValue) * chartWidth;
          } else {
              // Fallback for edge case maxXP=1, treat as linear
              x = leftMargin + (i / numSegments) * chartWidth;
          }
      } else { // Default to linear scale
          x = leftMargin + (i / numSegments) * chartWidth;
      }
      // Ensure x is a valid number, default to leftMargin if not
      x = Number.isFinite(x) ? x : leftMargin;


      // 3. Draw Vertical Grid Line at the calculated position 'x'
      const gridLine = document.createElementNS(svgNS, "line");
      gridLine.setAttribute("x1", x.toString());
      gridLine.setAttribute("x2", x.toString());
      gridLine.setAttribute("y1", topMargin.toString()); // Span from top margin
      gridLine.setAttribute("y2", (height - bottomMargin).toString()); // To bottom margin
      gridLine.setAttribute("stroke", GREY_DARK); // Use same color as timeline grid
      gridLine.setAttribute("stroke-width", "1");
      svg.appendChild(gridLine);

      // 4. Draw X-Axis Tick Mark at the calculated position 'x'
      const tickMark = document.createElementNS(svgNS, "line");
      tickMark.setAttribute("x1", x.toString());
      tickMark.setAttribute("x2", x.toString());
      tickMark.setAttribute("y1", (height - bottomMargin).toString());
      tickMark.setAttribute("y2", (height - bottomMargin + 6).toString()); // Tick length
      tickMark.setAttribute("stroke", GREY_LIGHT);
      tickMark.setAttribute("stroke-width", "1");
      svg.appendChild(tickMark);

      // 5. Draw X-Axis Tick Label (showing the LINEAR value) at position 'x'
      const tickLabel = document.createElementNS(svgNS, "text");
      tickLabel.setAttribute("x", x.toString());
      tickLabel.setAttribute("y", (height - bottomMargin + 20).toString()); // Position below tick
      tickLabel.setAttribute("text-anchor", "middle");
      tickLabel.setAttribute("font-size", "10");
      tickLabel.setAttribute("fill", GREY_LIGHT);
      // Format the LINEAR tick value
      if (linearTickValue >= 1000) {
          tickLabel.textContent = Math.round(linearTickValue / 1000).toString() + 'k';
      } else {
          tickLabel.textContent = Math.round(linearTickValue).toString();
      }
      svg.appendChild(tickLabel);
  }

  // Create tooltip div
  const tooltip = document.createElement("div");
  tooltip.style.position = "fixed";
  tooltip.style.padding = "8px 12px";
  tooltip.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
  tooltip.style.color = "#fff";
  tooltip.style.borderRadius = "4px";
  tooltip.style.fontSize = "12px";
  tooltip.style.pointerEvents = "none";
  tooltip.style.display = "none";
  tooltip.style.zIndex = "1000";
  container.appendChild(tooltip);

  // Sort issue keys by XP for each contributor
  const sortIssuesByXP = (contributor: LeaderboardEntry) => {
    return Object.entries(contributor.issueBreakdown)
      .sort(([, xp1], [, xp2]) => xp2 - xp1) // Sort by XP descending
      .map(([issueKey]) => issueKey);
  };

  // --- Draw bars ---
  data.forEach((entry, idx) => {
    let currentX = leftMargin; // Use currentX to track position within the bar
    const y = topMargin + idx * (barHeight + barGap);

    // Highlight logic
    const isHighlight = entry.contributor === highlightContributor;
    const isError = errorContributors.includes(entry.contributor);

    // Get sorted issues for this contributor
    const contributorIssues = sortIssuesByXP(entry);
    const totalIssues = contributorIssues.length;
    const baseOpacity = 1 / totalIssues;

    // Draw stacked segments for each issue
    contributorIssues.forEach((issueKey, position) => {
      const issueXP = entry.issueBreakdown[issueKey] ?? 0;
      if (issueXP > 0) {
        let barW = 0;
        if (scaleMode === 'log') {
            // Calculate width based on log scale
            // Map XP to log10(max(1, xp)) to handle 0 and values < 1 correctly
            const logXP = Math.log10(Math.max(1, issueXP));
            // The width represents the contribution of this segment on the log scale
            // This is tricky for stacked bars. A direct log width isn't right.
            // We need to calculate the start and end points on the log scale.
            // Let's rethink: Apply log scale to the *total* bar width and ticks,
            // but keep segment widths proportional *within* the bar's scaled total width.

            // Calculate total bar width based on scale mode first
            const logTotalXP = Math.log10(Math.max(1, entry.totalXP));
            const barTotalWidth = scaleMode === 'log' && logMaxXP > 0
                ? (logTotalXP / logMaxXP) * chartWidth
                : (entry.totalXP / maxXP) * chartWidth;

            // Segment width is proportional to its XP contribution to the total XP
            // Segment width is proportional to its XP contribution to the total XP
            // Ensure totalXP is not zero to avoid NaN
            barW = entry.totalXP > 0 ? (issueXP / entry.totalXP) * barTotalWidth : 0;

        } else {
            // Linear scale width calculation (use currentMaxXP for bar segment width relative to current view max)
            barW = (issueXP / currentMaxXP) * chartWidth;
        }

        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", currentX.toString()); // Use currentX
        rect.setAttribute("y", y.toString());
        rect.setAttribute("width", barW.toString());
        rect.setAttribute("height", barHeight.toString());

        // Calculate original opacity factor based on position (0 to 1)
        // segmentOpacity ranges from baseOpacity to 1.0
        const segmentOpacityFactor = (baseOpacity * (position + 1)); // Ranges roughly from (1/totalIssues) to 1.0

        // Remap to target range [0.125, 0.875]
        const minTargetOpacity = 0.125; // New min
        const maxTargetOpacity = 0.875; // New max
        const targetRange = maxTargetOpacity - minTargetOpacity; // New range (0.75)

        // Apply remapping
        let mappedOpacity = minTargetOpacity + segmentOpacityFactor * targetRange;

        // Clamp to ensure it stays within [0.25, 0.75]
        mappedOpacity = Math.max(minTargetOpacity, Math.min(maxTargetOpacity, mappedOpacity));

        // Apply error state (use max target opacity) or highlight boost (cap at max)
        const finalOpacity = isError
            ? maxTargetOpacity
            : (isHighlight ? Math.min(maxTargetOpacity, mappedOpacity * 1.3) : mappedOpacity); // Allow highlight boost but cap

        // Use single color with calculated opacity
        rect.setAttribute("fill", isError ? BAD : GOOD);
        rect.setAttribute("opacity", finalOpacity.toString());

        // Store data for tooltip
        rect.setAttribute("data-issue", issueKey);
        rect.setAttribute("data-xp", issueXP.toString());
        rect.setAttribute("data-base-opacity", baseOpacity.toString());

        // Make it look clickable
        rect.style.cursor = "pointer";

        // Add hover and click interactivity
        rect.addEventListener("mouseenter", (e) => {
          const target = e.target as SVGRectElement;
          target.setAttribute("opacity", "1");
          tooltip.style.display = "block";

          // Format tooltip content
          // Example: ubiquity-os-marketplace/text-conversation-rewards#279
          const [repoPath, issueNum] = issueKey.split("#");
          tooltip.innerHTML = `
            <div><strong>${repoPath}</strong></div>
            <div>Issue #${issueNum}</div>
            <div>${issueXP.toFixed(2)} XP</div>
          `;

          // Position tooltip near mouse but ensure it stays in view
          const rect = target.getBoundingClientRect();
          const tooltipX = Math.min(
            rect.right + 10,
            window.innerWidth - tooltip.offsetWidth - 10
          );
          const tooltipY = Math.min(
            rect.top,
            window.innerHeight - tooltip.offsetHeight - 10
          );
          tooltip.style.left = `${tooltipX}px`;
          tooltip.style.top = `${tooltipY}px`;
        });

        rect.addEventListener("mouseleave", (e) => {
          const target = e.target as SVGRectElement;
          const baseOpacityFactor = parseFloat(target.getAttribute("data-base-opacity") || "0"); // Should be baseOpacity = 1/totalIssues
          const position = contributorIssues.indexOf(target.getAttribute("data-issue") || "");
          // Recalculate the original factor and remap it for restore
          const originalSegmentFactor = baseOpacityFactor * (position + 1);
          // Use the updated min/max for remapping
          const minRestoreOpacity = 0.125;
          const maxRestoreOpacity = 0.875;
          const restoreRange = maxRestoreOpacity - minRestoreOpacity;
          let restoreOpacity = minRestoreOpacity + originalSegmentFactor * restoreRange;
          restoreOpacity = Math.max(minRestoreOpacity, Math.min(maxRestoreOpacity, restoreOpacity));
          // Apply highlight boost if needed, capped at max
          restoreOpacity = isHighlight ? Math.min(maxRestoreOpacity, restoreOpacity * 1.3) : restoreOpacity;

          target.setAttribute("opacity", restoreOpacity.toString());
          tooltip.style.display = "none";
        });

        // Add click handler
        rect.addEventListener("click", () => {
          const [repoPath, issueNum] = issueKey.split("#");
          // Example URL: https://github.com/ubiquity-os-marketplace/text-conversation-rewards/issues/279
          window.open(`https://github.com/${repoPath}/issues/${issueNum}`, "_blank");
        });

        svg.appendChild(rect);
        currentX += barW; // Increment currentX
      }
    });

    // Calculate the final bar end position based on scale mode for label placement
    // Calculate the final bar end position based on scale mode for label placement (use currentMaxXP for positioning relative to current view max)
    const logTotalXP = Math.log10(Math.max(1, entry.totalXP));
    const logCurrentMaxXP = Math.log10(Math.max(1, currentMaxXP)); // Log of current max for positioning
    const finalBarEndX = scaleMode === 'log' && logCurrentMaxXP > 0
        ? leftMargin + (logTotalXP / logCurrentMaxXP) * chartWidth
        : leftMargin + (entry.totalXP / currentMaxXP) * chartWidth; // Use currentMaxXP here

    // Contributor label (left, dynamically clamp to avoid overflow)
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("font-size", "16");
    label.setAttribute("fill", isError ? BAD : isHighlight ? GOOD : GREY);
    label.setAttribute("font-weight", isHighlight ? "bold" : "normal");
    label.setAttribute("text-anchor", "end");
    // Add rank prefix to the displayed label
    const rank = ranks[entry.contributor];
    const rankPrefix = rank ? `#${rank} ` : "";
    label.textContent = `${rankPrefix}${entry.contributor}`;
    // Temporarily position off-screen to measure
    label.setAttribute("x", "0");
    label.setAttribute("y", "-9999");
    svg.appendChild(label);
    // Measure text width
    const labelWidth = label.getBBox().width;
    // Clamp so label fits within left edge
    const unclampedLabelX = leftMargin - 8;
    const minLabelX = labelWidth + 4;
    const labelX = Math.max(unclampedLabelX, minLabelX);
    label.setAttribute("x", labelX.toString());
    label.setAttribute("y", (y + barHeight / 2 + 6).toString());

    // XP label (right, dynamically clamp to avoid overflow)
    const xpLabel = document.createElementNS(svgNS, "text");
    xpLabel.setAttribute("font-size", "14");
    xpLabel.setAttribute("fill", isError ? BAD : isHighlight ? GOOD : GREY_LIGHT);
    xpLabel.setAttribute("text-anchor", "start");
    xpLabel.textContent = `${entry.totalXP.toFixed(2)} XP`;
    // Temporarily position off-screen to measure
    xpLabel.setAttribute("x", "0");
    xpLabel.setAttribute("y", "-9999");
    svg.appendChild(xpLabel); // Append temporarily to measure

    // --- Conditional XP Label Placement (using finalBarEndX) ---
    const xpLabelWidth = xpLabel.getBBox().width;
    // Compare label width to the *rendered* bar width (finalBarEndX - leftMargin)
    const renderedBarWidth = finalBarEndX - leftMargin;
    const labelPadding = 8; // Padding inside/outside the bar

    // Ensure renderedBarWidth is a positive number before comparison
    if (renderedBarWidth > 0 && xpLabelWidth + labelPadding < renderedBarWidth) {
        // Fits inside: Render black text, right-aligned inside the bar
        xpLabel.setAttribute("fill", "#000"); // Black text
        xpLabel.setAttribute("text-anchor", "end");
        const labelX = finalBarEndX - labelPadding; // Position relative to the calculated end
        xpLabel.setAttribute("x", labelX.toString());
    } else {
        // Doesn't fit inside: Render standard color, left-aligned outside the bar
        xpLabel.setAttribute("fill", isError ? BAD : isHighlight ? GOOD : GREY_LIGHT); // Original color logic
        xpLabel.setAttribute("text-anchor", "start");
        // Clamp position to the right edge
        const unclampedXpLabelX = finalBarEndX + labelPadding; // Position relative to the calculated end
        const maxXpLabelX = width - rightMargin - xpLabelWidth; // Ensure it doesn't overflow chart
        const labelX = Math.min(unclampedXpLabelX, maxXpLabelX);
        xpLabel.setAttribute("x", labelX.toString());
    }
    // Set vertical position (same for both cases)
    xpLabel.setAttribute("y", (y + barHeight / 2 + 6).toString());

  });

  // --- Removed Y-axis title ---
  // const yTitle = document.createElementNS(svgNS, "text");
  // yTitle.setAttribute("x", (leftMargin - 8).toString());
  // yTitle.setAttribute("y", (topMargin - 16).toString());
  // yTitle.setAttribute("text-anchor", "end");
  // yTitle.setAttribute("font-size", "14");
  // yTitle.setAttribute("fill", GREY_LIGHT);
  // yTitle.textContent = "Contributor";
  // svg.appendChild(yTitle);

  // --- Removed X-axis title ---
  // const xTitle = document.createElementNS(svgNS, "text");
  // ... (rest of title code) ...
  // svg.appendChild(xTitle);

  // --- X-Axis Ticks and Grid Lines are now drawn together above ---


  // --- Removed Legend ---
  /*
  // Legend (repo patterns) - This should be *after* the tick drawing logic block
  // Responsive legend layout
  // Create a simplified legend container
  const legendContainer = document.createElement("div");
  legendContainer.style.position = "absolute";
  legendContainer.style.left = `${leftMargin}px`;
  legendContainer.style.bottom = `${bottomMargin - 32}px`; // Position above the bottom margin
  legendContainer.style.width = `${width - leftMargin - rightMargin}px`;
  legendContainer.style.height = "40px";
  legendContainer.style.backgroundColor = BG;
  container.appendChild(legendContainer);

  // Add a single legend item with gradient
  const legendItem = document.createElement("div");
  legendItem.style.display = "inline-block";
  legendItem.style.marginRight = "16px";

  const gradientBox = document.createElement("div");
  gradientBox.style.display = "inline-block";
  gradientBox.style.width = "80px";
  gradientBox.style.height = "16px";
  gradientBox.style.background = `linear-gradient(to right, ${GOOD}00, ${GOOD})`;
  gradientBox.style.verticalAlign = "middle";

  const legendLabel = document.createElement("span");
  legendLabel.style.marginLeft = "8px";
  legendLabel.style.color = GREY;
  legendLabel.style.fontSize = "12px";
  legendLabel.style.verticalAlign = "middle";
  legendLabel.textContent = "Issue XP Distribution";

  legendItem.appendChild(gradientBox);
  legendItem.appendChild(legendLabel);
  legendContainer.appendChild(legendItem);

  // Add error legend if needed
  if (errorContributors.length > 0) {
    const errorItem = document.createElement("div");
    errorItem.style.display = "inline-block";
    errorItem.style.marginLeft = "24px";
    errorItem.style.marginRight = "16px";
    errorItem.innerHTML = `
      <div style="display: inline-block; width: 24px; height: 16px; background: ${BAD}; opacity: 0.85; vertical-align: middle;"></div>
      <span style="margin-left: 8px; color: ${BAD}; font-size: 12px; vertical-align: middle;">Error/Flagged</span>
    `;
    legendContainer.appendChild(errorItem);
  }
  */
} // End of renderLeaderboardChart function
