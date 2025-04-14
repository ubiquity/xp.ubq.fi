/**
 * Time Series Chart Renderer (SVG)
 * - Multi-line chart for contributor XP over time.
 * - Uses two complementary colors (good: cyan, bad: red) with shades for visual hierarchy.
 * - All other elements are greyscale for minimal, high-contrast UI.
 * - Color variables can be adjusted for theme.
 */

import type { TimeSeriesEntry } from "../data-transform";

/**
 * Renders a multi-line time series chart into the given container.
 * @param data TimeSeriesEntry[]
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
  const height = options?.height ?? 320;

  // Calculate dynamic margins based on label widths
  const tempSvg = document.createElementNS(svgNS, "svg");
  tempSvg.style.visibility = "hidden";
  document.body.appendChild(tempSvg);

  // Measure contributor label widths
  let maxContributorWidth = 0;
  data.forEach(entry => {
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("font-size", "14");
    label.textContent = entry.contributor;
    tempSvg.appendChild(label);
    const labelWidth = label.getBBox().width;
    maxContributorWidth = Math.max(maxContributorWidth, labelWidth);
  });

  document.body.removeChild(tempSvg);

  // Set margins with padding
  const leftMargin = options?.leftMargin ?? 64;
  const rightMargin = options?.rightMargin ?? Math.max(32, maxContributorWidth + 32); // base padding of 32px
  const topMargin = options?.topMargin ?? 32;
  const bottomMargin = options?.bottomMargin ?? 48;
  const highlightContributor = options?.highlightContributor ?? data[0]?.contributor;
  const errorContributors = options?.errorContributors ?? [];
  const showLegend = options?.showLegend ?? true;

  // --- Data flattening and axis scaling (no global alignment) ---
  // Gather all points and determine global min/max for axis scaling
  const allPoints = data.flatMap(entry => entry.series);
  const allTimesPOSIX = allPoints.map(pt => new Date(pt.time).getTime());
  const minTime = Math.min(...allTimesPOSIX);
  const maxTime = Math.max(...allTimesPOSIX);

  // For each contributor, build a cumulative XP array at their own event times only
  const contributorData = data.map(entry => {
    // Sort events by time
    const sortedSeries = [...entry.series].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    let cumulative = 0;
    const points = sortedSeries.map(pt => {
      cumulative += pt.xp;
      return {
        time: new Date(pt.time).getTime(),
        xp: cumulative
      };
    });
    return {
      contributor: entry.contributor,
      userId: entry.userId,
      points
    };
  });

  // Find max XP (cumulative, across all contributors and all times)
  let maxXP = options?.maxYValue ?? 1;
  if (!options?.maxYValue) {
    contributorData.forEach(entry => {
      entry.points.forEach(pt => {
        if (pt.xp > maxXP) maxXP = pt.xp;
      });
    });
  }

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

  // --- Draw grid lines (greyscale) ---
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

  // --- Draw lines for each contributor (using their own event times) ---
  contributorData.forEach((entry, idx) => {
    const isHighlight = entry.contributor === highlightContributor;
    const isError = errorContributors.includes(entry.contributor);

    // Map contributor's own points to SVG coordinates
    const points = entry.points.map((pt, i) => {
      const x =
        leftMargin +
        ((pt.time - minTime) / (maxTime - minTime || 1)) *
          (width - leftMargin - rightMargin);
      const y =
        topMargin +
        (1 - pt.xp / maxXP) * (height - topMargin - bottomMargin);
      return { x, y, xp: pt.xp, time: pt.time };
    });

    // Draw line
    if (points.length > 1) {
      const path = document.createElementNS(svgNS, "path");
      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        d += ` L ${points[i].x} ${points[i].y}`;
      }
      path.setAttribute("d", d);
      path.setAttribute(
        "stroke",
        isError ? BAD : isHighlight ? GOOD : `rgba(136,136,136,0.5)`
      );
      path.setAttribute("stroke-width", isHighlight ? "3" : "2");
      path.setAttribute("fill", "none");
      path.setAttribute("opacity", isError ? "0.85" : isHighlight ? "1" : "0.7");
      svg.appendChild(path);
    }

    // Draw points
    points.forEach((pt, i) => {
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", pt.x.toString());
      circle.setAttribute("cy", pt.y.toString());
      circle.setAttribute("r", isHighlight ? "2" : "1");
      circle.setAttribute(
        "fill",
        isError ? BAD : isHighlight ? GOOD : GREY_LIGHT
      );
      circle.setAttribute("opacity", isError ? "0.85" : isHighlight ? "1" : "0.7");
      svg.appendChild(circle);
    });

    // Contributor label (right side, dynamically clamp and avoid collision with line/point)
    if (points.length > 0) {
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("font-size", "14");
      label.setAttribute("fill", isError ? BAD : isHighlight ? GOOD : GREY);
      label.setAttribute("font-weight", isHighlight ? "bold" : "normal");
      label.setAttribute("text-anchor", "start");
      label.textContent = entry.contributor;
      // Temporarily position off-screen to measure
      label.setAttribute("x", "0");
      label.setAttribute("y", "-9999");
      svg.appendChild(label);
      // Measure text width
      const textWidth = label.getBBox().width;
      // Calculate unclamped x
      const lastPointX = points[points.length - 1].x;
      const unclampedX = lastPointX + 8;
      // Clamp so label fits within (width - rightMargin)
      const maxX = width - rightMargin - textWidth;
      let labelX = Math.min(unclampedX, maxX);
      // Ensure label does not overlap the last point/line
      const minLabelX = lastPointX + 12; // 12px buffer from last point
      if (labelX < minLabelX) {
        labelX = minLabelX;
      }
      label.setAttribute("x", labelX.toString());
      label.setAttribute("y", (points[points.length - 1].y + 4).toString());
    }
  });

  // --- Axis labels ---
  // Y-axis
  const yTitle = document.createElementNS(svgNS, "text");
  yTitle.setAttribute("x", (leftMargin - 12).toString());
  yTitle.setAttribute("y", (topMargin - 12).toString());
  yTitle.setAttribute("text-anchor", "end");
  yTitle.setAttribute("font-size", "14");
  yTitle.setAttribute("fill", GREY_LIGHT);
  yTitle.textContent = "Cumulative XP";
  svg.appendChild(yTitle);

  // X-axis
  const xTitle = document.createElementNS(svgNS, "text");
  xTitle.setAttribute("x", (width - rightMargin).toString());
  xTitle.setAttribute("y", (height - bottomMargin + 32).toString());
  xTitle.setAttribute("text-anchor", "end");
  xTitle.setAttribute("font-size", "14");
  xTitle.setAttribute("fill", GREY_LIGHT);
  xTitle.textContent = "Time";
  svg.appendChild(xTitle);

  // --- Legend ---
  if (showLegend) {
    let lx = leftMargin;
    const ly = height - bottomMargin + 8;

    // Highlight
    if (highlightContributor) {
      const legendLine = document.createElementNS(svgNS, "rect");
      legendLine.setAttribute("x", lx.toString());
      legendLine.setAttribute("y", ly.toString());
      legendLine.setAttribute("width", "24");
      legendLine.setAttribute("height", "4");
      legendLine.setAttribute("fill", GOOD);
      legendLine.setAttribute("opacity", "1");
      svg.appendChild(legendLine);

      const legendLabel = document.createElementNS(svgNS, "text");
      legendLabel.setAttribute("x", (lx + 32).toString());
      legendLabel.setAttribute("y", (ly + 12).toString());
      legendLabel.setAttribute("font-size", "12");
      legendLabel.setAttribute("fill", GOOD);
      legendLabel.textContent = highlightContributor;
      svg.appendChild(legendLabel);

      lx += 120;
    }

    // Error
    if (errorContributors.length > 0) {
      const errorLine = document.createElementNS(svgNS, "rect");
      errorLine.setAttribute("x", lx.toString());
      errorLine.setAttribute("y", ly.toString());
      errorLine.setAttribute("width", "24");
      errorLine.setAttribute("height", "4");
      errorLine.setAttribute("fill", BAD);
      errorLine.setAttribute("opacity", "0.85");
      svg.appendChild(errorLine);

      const errorLabel = document.createElementNS(svgNS, "text");
      errorLabel.setAttribute("x", (lx + 32).toString());
      errorLabel.setAttribute("y", (ly + 12).toString());
      errorLabel.setAttribute("font-size", "12");
      errorLabel.setAttribute("fill", BAD);
      errorLabel.textContent = "Error/Flagged";
      svg.appendChild(errorLabel);

      lx += 120;
    }
  }
}
