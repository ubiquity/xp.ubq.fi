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

  // Measure contributor label widths
  let maxContributorWidth = 0;
  data.forEach(entry => {
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("font-size", "16");
    label.textContent = entry.contributor;
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

  // Find max XP for scaling
  const maxXP = Math.max(...data.map(entry => entry.totalXP), 1);

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
    let x = leftMargin;
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
        const barW = (issueXP / maxXP) * (width - leftMargin - rightMargin);
        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", x.toString());
        rect.setAttribute("y", y.toString());
        rect.setAttribute("width", barW.toString());
        rect.setAttribute("height", barHeight.toString());

        // Calculate opacity based on position
        // Later positions (right side) get higher opacity
        const segmentOpacity = baseOpacity * (position + 1);
        const finalOpacity = isError ? 0.85 : (isHighlight ? Math.min(1, segmentOpacity * 1.3) : segmentOpacity);

        // Use single color with calculated opacity
        rect.setAttribute("fill", isError ? BAD : GOOD);
        rect.setAttribute("opacity", finalOpacity.toString());

        // Store data for tooltip
        rect.setAttribute("data-issue", issueKey);
        rect.setAttribute("data-xp", issueXP.toString());
        rect.setAttribute("data-base-opacity", baseOpacity.toString());

        // Add hover interactivity
        rect.addEventListener("mouseenter", (e) => {
          const target = e.target as SVGRectElement;
          target.setAttribute("opacity", "1");
          tooltip.style.display = "block";

          // Format tooltip content
          const [repo, issue] = issueKey.split("#");
          tooltip.innerHTML = `
            <div><strong>${repo}</strong></div>
            <div>Issue #${issue}</div>
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
          const baseOpacity = parseFloat(target.getAttribute("data-base-opacity") || "1");
          const position = contributorIssues.indexOf(target.getAttribute("data-issue") || "");
          const restoreOpacity = baseOpacity * (position + 1);
          target.setAttribute("opacity", isHighlight ? Math.min(1, restoreOpacity * 1.3).toString() : restoreOpacity.toString());
          tooltip.style.display = "none";
        });

        svg.appendChild(rect);
        x += barW;
      }
    });

    // Contributor label (left, dynamically clamp to avoid overflow)
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("font-size", "16");
    label.setAttribute("fill", isError ? BAD : isHighlight ? GOOD : GREY);
    label.setAttribute("font-weight", isHighlight ? "bold" : "normal");
    label.setAttribute("text-anchor", "end");
    label.textContent = entry.contributor;
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
    svg.appendChild(xpLabel);
    // Measure text width
    const xpLabelWidth = xpLabel.getBBox().width;
    // Clamp so label fits within right edge
    const unclampedXpLabelX = x + 8;
    const maxXpLabelX = width - rightMargin - xpLabelWidth;
    const xpLabelX = Math.min(unclampedXpLabelX, maxXpLabelX);
    xpLabel.setAttribute("x", xpLabelX.toString());
    xpLabel.setAttribute("y", (y + barHeight / 2 + 6).toString());

  });

  // Y-axis title
  const yTitle = document.createElementNS(svgNS, "text");
  yTitle.setAttribute("x", (leftMargin - 8).toString());
  yTitle.setAttribute("y", (topMargin - 16).toString());
  yTitle.setAttribute("text-anchor", "end");
  yTitle.setAttribute("font-size", "14");
  yTitle.setAttribute("fill", GREY_LIGHT);
  yTitle.textContent = "Contributor";
  svg.appendChild(yTitle);

  // X-axis title
  const xTitle = document.createElementNS(svgNS, "text");
  xTitle.setAttribute("x", (width - rightMargin).toString());
  xTitle.setAttribute("y", (height - bottomMargin + 24).toString());
  xTitle.setAttribute("text-anchor", "end");
  xTitle.setAttribute("font-size", "14");
  xTitle.setAttribute("fill", GREY_LIGHT);
  xTitle.textContent = "XP";
  svg.appendChild(xTitle);

  // Legend (repo patterns)
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
}
