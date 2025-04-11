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
  const height = options?.height ?? 320;
  const leftMargin = options?.leftMargin ?? 64;
  const rightMargin = options?.rightMargin ?? 32;
  const topMargin = options?.topMargin ?? 32;
  const bottomMargin = options?.bottomMargin ?? 48;
  const highlightContributor = options?.highlightContributor ?? data[0]?.contributor;
  const errorContributors = options?.errorContributors ?? [];
  const showLegend = options?.showLegend ?? true;

  // --- Data flattening and axis scaling ---
  // Collect all time points (numeric or string)
  const allPoints = data.flatMap(entry => entry.series);
  const allTimes = allPoints.map(pt => pt.time);
  // Try to coerce all times to numbers if possible
  const numericTimes = allTimes.every(t => typeof t === "number");
  const timeVals = numericTimes
    ? (allTimes as number[])
    : allTimes.map((t, i) => i);

  const minTime = Math.min(...timeVals);
  const maxTime = Math.max(...timeVals);

  // Find max XP (cumulative)
  let maxXP = 1;
  data.forEach(entry => {
    let sum = 0;
    entry.series.forEach(pt => {
      sum += pt.xp;
      if (sum > maxXP) maxXP = sum;
    });
  });

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

  // --- Draw lines for each contributor ---
  data.forEach((entry, idx) => {
    const isHighlight = entry.contributor === highlightContributor;
    const isError = errorContributors.includes(entry.contributor);

    // Build cumulative XP series
    let sum = 0;
    const points = entry.series.map(pt => {
      sum += pt.xp;
      const t = numericTimes
        ? (pt.time as number)
        : allTimes.indexOf(pt.time);
      const x =
        leftMargin +
        ((t - minTime) / (maxTime - minTime || 1)) *
          (width - leftMargin - rightMargin);
      const y =
        topMargin +
        (1 - sum / maxXP) * (height - topMargin - bottomMargin);
      return { x, y, raw: pt };
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
      circle.setAttribute("r", isHighlight ? "4" : "3");
      circle.setAttribute(
        "fill",
        isError ? BAD : isHighlight ? GOOD : GREY_LIGHT
      );
      circle.setAttribute("opacity", isError ? "0.85" : isHighlight ? "1" : "0.7");
      svg.appendChild(circle);
    });

    // Contributor label (right side)
    if (points.length > 0) {
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", (points[points.length - 1].x + 8).toString());
      label.setAttribute("y", (points[points.length - 1].y + 4).toString());
      label.setAttribute("font-size", "14");
      label.setAttribute("fill", isError ? BAD : isHighlight ? GOOD : GREY);
      label.setAttribute("font-weight", isHighlight ? "bold" : "normal");
      label.textContent = entry.contributor;
      svg.appendChild(label);
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
