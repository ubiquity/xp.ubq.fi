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
  // --- Color Variables ---
  // Good (attention): cyan (hue 180º)
  const GOOD = "#00e0ff";
  // Bad (error): red (hue 0º)
  const BAD = "#ff2d2d";
  // Greys
  const GREY_DARK = "#222";
  const GREY = "#888";
  const GREY_LIGHT = "#ccc";
  const BG = "#181a1b";

  // --- Config ---
  const width = options?.width ?? 600;
  const height = options?.height ?? Math.max(200, data.length * 32 + 64);
  const barHeight = options?.barHeight ?? 24;
  const barGap = options?.barGap ?? 8;
  const leftMargin = options?.leftMargin ?? 120;
  const rightMargin = options?.rightMargin ?? 32;
  const topMargin = options?.topMargin ?? 32;
  const bottomMargin = options?.bottomMargin ?? 32;
  const highlightContributor = options?.highlightContributor ?? data[0]?.contributor;
  const errorContributors = options?.errorContributors ?? [];

  // Determine all repo keys (for consistent stacking order)
  const allRepoKeys = options?.repoKeys ?? Array.from(
    new Set(data.flatMap(entry => Object.keys(entry.repoBreakdown)))
  );

  // Find max XP for scaling
  const maxXP = Math.max(...data.map(entry => entry.totalXP), 1);

  // SVG root
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", width.toString());
  svg.setAttribute("height", height.toString());
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.display = "block";
  svg.style.background = BG;

  // Clear container and append SVG
  container.innerHTML = "";
  container.appendChild(svg);

  // --- Patterns for repo breakdowns ---
  // Use GOOD color for the first repo, greys for others
  allRepoKeys.forEach((repo, i) => {
    const pattern = document.createElementNS(svgNS, "pattern");
    pattern.setAttribute("id", `repo-pattern-${i}`);
    pattern.setAttribute("patternUnits", "userSpaceOnUse");
    pattern.setAttribute("width", "8");
    pattern.setAttribute("height", "8");
    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("width", "8");
    rect.setAttribute("height", "8");
    rect.setAttribute("fill", i === 0 ? GOOD : GREY_LIGHT);
    pattern.appendChild(rect);
    const line = document.createElementNS(svgNS, "rect");
    line.setAttribute("width", "8");
    line.setAttribute("height", "4");
    line.setAttribute("fill", i === 0 ? "rgba(0,224,255,0.4)" : GREY);
    pattern.appendChild(line);
    svg.appendChild(pattern);
  });

  // --- Draw bars ---
  data.forEach((entry, idx) => {
    let x = leftMargin;
    const y = topMargin + idx * (barHeight + barGap);

    // Highlight logic
    const isHighlight = entry.contributor === highlightContributor;
    const isError = errorContributors.includes(entry.contributor);

    // Draw stacked segments for each repo
    allRepoKeys.forEach((repo, i) => {
      const repoXP = entry.repoBreakdown[repo] ?? 0;
      if (repoXP > 0) {
        const barW = (repoXP / maxXP) * (width - leftMargin - rightMargin);
        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", x.toString());
        rect.setAttribute("y", y.toString());
        rect.setAttribute("width", barW.toString());
        rect.setAttribute("height", barHeight.toString());
        // Color logic: highlight = GOOD, error = BAD, else pattern
        if (isError) {
          rect.setAttribute("fill", BAD);
          rect.setAttribute("opacity", "0.85");
        } else if (isHighlight && i === 0) {
          rect.setAttribute("fill", GOOD);
          rect.setAttribute("opacity", "1");
        } else if (i === 0) {
          rect.setAttribute("fill", GOOD);
          rect.setAttribute("opacity", "0.5");
        } else {
          rect.setAttribute("fill", `url(#repo-pattern-${i})`);
          rect.setAttribute("opacity", "1");
        }
        rect.setAttribute("data-repo", repo);
        rect.setAttribute("data-xp", repoXP.toString());
        svg.appendChild(rect);
        x += barW;
      }
    });

    // Contributor label
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", (leftMargin - 8).toString());
    label.setAttribute("y", (y + barHeight / 2 + 6).toString());
    label.setAttribute("text-anchor", "end");
    label.setAttribute("font-size", "16");
    label.setAttribute("fill", isError ? BAD : isHighlight ? GOOD : GREY);
    label.setAttribute("font-weight", isHighlight ? "bold" : "normal");
    label.textContent = entry.contributor;
    svg.appendChild(label);

    // XP label
    const xpLabel = document.createElementNS(svgNS, "text");
    xpLabel.setAttribute("x", (x + 8).toString());
    xpLabel.setAttribute("y", (y + barHeight / 2 + 6).toString());
    xpLabel.setAttribute("text-anchor", "start");
    xpLabel.setAttribute("font-size", "14");
    xpLabel.setAttribute("fill", isError ? BAD : isHighlight ? GOOD : GREY_LIGHT);
    xpLabel.textContent = `${entry.totalXP.toFixed(2)} XP`;
    svg.appendChild(xpLabel);
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
  allRepoKeys.forEach((repo, i) => {
    const lx = leftMargin + i * 96;
    const ly = height - bottomMargin + 8;
    const legendRect = document.createElementNS(svgNS, "rect");
    legendRect.setAttribute("x", lx.toString());
    legendRect.setAttribute("y", ly.toString());
    legendRect.setAttribute("width", "24");
    legendRect.setAttribute("height", "16");
    legendRect.setAttribute("fill", i === 0 ? GOOD : `url(#repo-pattern-${i})`);
    legendRect.setAttribute("opacity", i === 0 ? "0.7" : "1");
    svg.appendChild(legendRect);

    const legendLabel = document.createElementNS(svgNS, "text");
    legendLabel.setAttribute("x", (lx + 32).toString());
    legendLabel.setAttribute("y", (ly + 14).toString());
    legendLabel.setAttribute("font-size", "12");
    legendLabel.setAttribute("fill", GREY);
    legendLabel.textContent = repo;
    svg.appendChild(legendLabel);
  });

  // Error legend (if any)
  if (errorContributors.length > 0) {
    const lx = leftMargin + allRepoKeys.length * 96;
    const ly = height - bottomMargin + 8;
    const errorRect = document.createElementNS(svgNS, "rect");
    errorRect.setAttribute("x", lx.toString());
    errorRect.setAttribute("y", ly.toString());
    errorRect.setAttribute("width", "24");
    errorRect.setAttribute("height", "16");
    errorRect.setAttribute("fill", BAD);
    errorRect.setAttribute("opacity", "0.85");
    svg.appendChild(errorRect);

    const errorLabel = document.createElementNS(svgNS, "text");
    errorLabel.setAttribute("x", (lx + 32).toString());
    errorLabel.setAttribute("y", (ly + 14).toString());
    errorLabel.setAttribute("font-size", "12");
    errorLabel.setAttribute("fill", BAD);
    errorLabel.textContent = "Error/Flagged";
    svg.appendChild(errorLabel);
  }
}
