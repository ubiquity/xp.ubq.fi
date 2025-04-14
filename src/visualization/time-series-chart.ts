/**
 * Time Series Chart Renderer (SVG)
 * - Multi-line chart for contributor XP over time.
 * - Uses two complementary colors (good: cyan, bad: red) with shades for visual hierarchy.
 * - All other elements are greyscale for minimal, high-contrast UI.
 * - Color variables can be adjusted for theme.
 */

import type { TimeSeriesEntry } from "../data-transform";
import { drawYAxisTicks } from "./chart-helpers/draw-y-axis-ticks";
import { drawXAxisTicks } from "./chart-helpers/draw-x-axis-ticks";
import { processChartData, type ProcessedContributorData } from "./chart-helpers/process-chart-data";
import { drawLegend } from "./chart-helpers/draw-legend";
import { drawContributorLine } from "./chart-helpers/draw-contributor-line";

// Define the structure for points mapped to SVG coordinates
// (CumulativePoint is now defined within process-chart-data.ts)

// Define the structure for points mapped to SVG coordinates
type SvgPoint = {
    x: number;
    y: number;
    time: number;
    xp: number;
};


/**
 * Renders a multi-line time series chart into the given container.
 * @param data TimeSeriesEntry[] - Expects data filtered by contributor, but NOT by time cutoff.
 * @param container HTMLElement
 * @param options Optional config
 */
export function renderTimeSeriesChart(
  data: TimeSeriesEntry[],
  container: HTMLElement,
  options?: {
    width?: number;
    height?: number;
    leftMargin?: number;
    rightMargin?: number;
    topMargin?: number;
    bottomMargin?: number;
    highlightContributor?: string; // Optionally highlight a contributor
    errorContributors?: string[]; // Optionally mark contributors as "bad"
    showLegend?: boolean;
    maxYValue?: number; // Maximum Y value to use for scaling
    ranks?: { [contributor: string]: number }; // Map of contributor ranks for opacity
    minTime?: number | null; // Optional fixed minimum time for X-axis
    maxTime?: number | null; // Optional fixed maximum time for X-axis
    animationProgress?: number; // Optional animation progress (0-1) for fade-in effect
    cutoffTimeMs?: number; // Optional cutoff time for filtering/interpolation
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
  const svgNS = "http://www.w3.org/2000/svg";
  const width = options?.width ?? (container.clientWidth || container.getBoundingClientRect().width || 600);
  const height = options?.height ?? (container.clientHeight || container.getBoundingClientRect().height || 320);
  const startRadius = 48;
  const endRadius = 2;

  // Calculate dynamic margins based on label widths
  const tempSvg = document.createElementNS(svgNS, "svg");
  tempSvg.style.visibility = "hidden";
  document.body.appendChild(tempSvg);
  let maxContributorWidth = 0;
  data.forEach(entry => {
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("font-size", "14");
    label.textContent = entry.contributor;
    tempSvg.appendChild(label);
    const labelWidth = label.getBBox().width;
    maxContributorWidth = Math.max(maxContributorWidth, labelWidth);
  });
  // Keep tempSvg attached for Y-axis label measurement

  // --- Axis Scaling ---
  const minTime = options?.minTime ?? Math.min(Date.now(), ...data.flatMap(entry => entry.series.map(pt => new Date(pt.time).getTime())));
  const maxTime = options?.maxTime ?? Math.max(Date.now(), ...data.flatMap(entry => entry.series.map(pt => new Date(pt.time).getTime())));

  // Calculate actual max cumulative XP from data first
  let calculatedMaxXP = 0;
  if (!options?.maxYValue) {
      data.forEach(entry => {
          let cumulative = 0;
          entry.series.forEach(pt => {
              cumulative += pt.xp;
              if (cumulative > calculatedMaxXP) calculatedMaxXP = cumulative;
          });
      });
  }
  // Use provided maxYValue if available, otherwise use calculated max, ensuring it's at least 1 for scaling purposes.
  const maxXP = options?.maxYValue ?? Math.max(1, calculatedMaxXP);

  // Measure widest Y-axis label
  let maxYAxisLabelWidth = 0;
  const maxYLabelText = maxXP >= 1000 ? `${Math.ceil(maxXP / 1000)}k` : Math.ceil(maxXP).toString(); // Format the max value as it would appear
  const yLabel = document.createElementNS(svgNS, "text");
  yLabel.setAttribute("font-size", "10"); // Match font size used in drawYAxisTicks
  yLabel.textContent = maxYLabelText;
  tempSvg.appendChild(yLabel);
  maxYAxisLabelWidth = yLabel.getBBox().width;

  // Clean up temp SVG
  document.body.removeChild(tempSvg);

  // Calculate dynamic margins
  const yAxisPadding = 16; // Space for tick mark (4px) + label padding (8px) + buffer (4px)
  const requiredLeftMargin = maxYAxisLabelWidth + yAxisPadding;
  const leftMargin = Math.max(options?.leftMargin ?? 0, 64, requiredLeftMargin); // Ensure minimum 64px or calculated space
  const rightMargin = options?.rightMargin ?? Math.max(32, maxContributorWidth + 32); // Keep existing right margin logic
  const topMargin = options?.topMargin ?? 32;
  const bottomMargin = options?.bottomMargin ?? 48;
  const highlightContributor = options?.highlightContributor ?? data[0]?.contributor;
  const errorContributors = options?.errorContributors ?? [];
  const showLegend = options?.showLegend ?? true;

  // --- Data Processing using Helper ---
  const finalContributorData: ProcessedContributorData[] = processChartData({
      data,
      cutoffTimeMs: options?.cutoffTimeMs
  });

  // --- SVG Setup ---
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", height.toString());
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.display = "block";
  svg.style.background = BG;
  container.innerHTML = "";
  container.appendChild(svg);

  // --- Draw grid lines ---
  for (let i = 0; i <= 4; i++) {
    const y = topMargin + ((height - topMargin - bottomMargin) * i) / 4;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", leftMargin.toString());
    line.setAttribute("x2", (width - rightMargin).toString());
    line.setAttribute("y1", y.toString());
    line.setAttribute("y2", y.toString());
    line.setAttribute("stroke", GREY_DARK);
    line.setAttribute("stroke-width", "1");
    svg.appendChild(line);
  }

  // --- Draw Axis Lines ---
  const axisLine = document.createElementNS(svgNS, "line");
  axisLine.setAttribute("x1", leftMargin.toString());
  axisLine.setAttribute("x2", leftMargin.toString());
  axisLine.setAttribute("y1", topMargin.toString());
  axisLine.setAttribute("y2", (height - bottomMargin).toString());
  axisLine.setAttribute("stroke", GREY);
  axisLine.setAttribute("stroke-width", "1");
  svg.appendChild(axisLine);

  const axisLineX = document.createElementNS(svgNS, "line");
  axisLineX.setAttribute("x1", leftMargin.toString());
  axisLineX.setAttribute("x2", (width - rightMargin).toString());
  axisLineX.setAttribute("y1", (height - bottomMargin).toString());
  axisLineX.setAttribute("y2", (height - bottomMargin).toString());
  axisLineX.setAttribute("stroke", GREY);
  axisLineX.setAttribute("stroke-width", "1");
  svg.appendChild(axisLineX);

  // --- Draw Axis Ticks using Helpers ---
  drawYAxisTicks({ svg, svgNS, maxXP, height, topMargin, bottomMargin, leftMargin, GREY, GREY_LIGHT });
  if (minTime !== null && maxTime !== null) {
      drawXAxisTicks({ svg, svgNS, minTime, maxTime, width, height, leftMargin, rightMargin, bottomMargin, GREY, GREY_LIGHT });
  }

  // --- Sort for Rendering Order ---
  const sortedContributorData = [...finalContributorData].sort((a, b) => {
    const aIsHighlight = a.contributor === highlightContributor;
    const bIsHighlight = b.contributor === highlightContributor;
    if (aIsHighlight && !bIsHighlight) return 1;
    if (!aIsHighlight && bIsHighlight) return -1;
    return 0;
  });

  // --- Draw Contributor Lines using Helper ---
  sortedContributorData.forEach((entry) => {
    const isHighlight = entry.contributor === highlightContributor;
    const isError = errorContributors.includes(entry.contributor);

    // Ensure minTime and maxTime are numbers before calling helper
    if (minTime !== null && maxTime !== null) {
        drawContributorLine({
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
            ranks: options?.ranks,
            animationProgress: options?.animationProgress,
            cutoffTimeMs: options?.cutoffTimeMs,
            startRadius,
            endRadius,
        });
    }
  });

  // --- Draw Axis Labels ---
  const yTitle = document.createElementNS(svgNS, "text");
  yTitle.setAttribute("x", (leftMargin - 12).toString());
  yTitle.setAttribute("y", (topMargin - 12).toString());
  yTitle.setAttribute("text-anchor", "end");
  yTitle.setAttribute("font-size", "14");
  yTitle.setAttribute("fill", GREY_LIGHT);
  yTitle.textContent = "Cumulative XP";
  svg.appendChild(yTitle);

  const xTitle = document.createElementNS(svgNS, "text");
  xTitle.setAttribute("x", (width - rightMargin).toString());
  xTitle.setAttribute("y", (height - bottomMargin + 32).toString());
  xTitle.setAttribute("text-anchor", "end");
  xTitle.setAttribute("font-size", "14");
  xTitle.setAttribute("fill", GREY_LIGHT);
  xTitle.textContent = "Time";
  svg.appendChild(xTitle);

  // --- Draw Legend using Helper ---
  drawLegend({
    svg,
    svgNS,
    showLegend,
    highlightContributor,
    errorContributors,
    leftMargin,
    height,
    bottomMargin,
    GOOD,
    BAD,
  });
}
