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
  // Use container height if available and no option is passed, fallback to 320
  const height = options?.height ?? (container.clientHeight || container.getBoundingClientRect().height || 320);

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
  document.body.removeChild(tempSvg);

  const leftMargin = options?.leftMargin ?? 64;
  const rightMargin = options?.rightMargin ?? Math.max(32, maxContributorWidth + 32);
  const topMargin = options?.topMargin ?? 32;
  const bottomMargin = options?.bottomMargin ?? 48;
  const highlightContributor = options?.highlightContributor ?? data[0]?.contributor;
  const errorContributors = options?.errorContributors ?? [];
  const showLegend = options?.showLegend ?? true;

  // --- Axis Scaling ---
  const minTime = options?.minTime ?? Math.min(Date.now(), ...data.flatMap(entry => entry.series.map(pt => new Date(pt.time).getTime())));
  const maxTime = options?.maxTime ?? Math.max(Date.now(), ...data.flatMap(entry => entry.series.map(pt => new Date(pt.time).getTime())));
  let maxXP = options?.maxYValue ?? 1;
  if (!options?.maxYValue) {
     data.forEach(entry => {
       let cumulative = 0;
       entry.series.forEach(pt => {
         cumulative += pt.xp;
         if (cumulative > maxXP) maxXP = cumulative;
       });
     });
  }

  // --- Data Processing (Cumulative Sum, Filtering, Interpolation) ---
  const finalContributorData = data.map(entry => {
    const sortedSeries = [...entry.series].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    let cumulative = 0;
    const allCalculatedPoints = sortedSeries.map(pt => {
      cumulative += pt.xp;
      return { time: new Date(pt.time).getTime(), xp: cumulative };
    });

    let pointsToRender = allCalculatedPoints;
    if (options?.cutoffTimeMs !== undefined && allCalculatedPoints.length > 0) {
      let lastVisibleIndex = -1;
      for (let i = 0; i < allCalculatedPoints.length; i++) {
        if (allCalculatedPoints[i].time <= options.cutoffTimeMs) {
          lastVisibleIndex = i;
        } else {
          break;
        }
      }

      if (lastVisibleIndex === -1) {
         if (options.cutoffTimeMs >= allCalculatedPoints[0].time) {
             pointsToRender = allCalculatedPoints.slice(0, 1);
         } else {
             pointsToRender = [];
         }
      } else {
        pointsToRender = allCalculatedPoints.slice(0, lastVisibleIndex + 1);
        const nextPoint = allCalculatedPoints[lastVisibleIndex + 1];
        if (nextPoint && options.cutoffTimeMs > allCalculatedPoints[lastVisibleIndex].time) {
           const prevPoint = allCalculatedPoints[lastVisibleIndex];
           const timeDiff = nextPoint.time - prevPoint.time;
           if (timeDiff > 0) {
             const fraction = (options.cutoffTimeMs - prevPoint.time) / timeDiff;
             const interpolatedXP = prevPoint.xp + (nextPoint.xp - prevPoint.xp) * fraction;
             pointsToRender.push({ time: options.cutoffTimeMs, xp: interpolatedXP });
           }
        }
      }
    }
     if (allCalculatedPoints.length > 0 && pointsToRender.length === 0 && options?.cutoffTimeMs && options.cutoffTimeMs >= allCalculatedPoints[0].time) {
        pointsToRender = allCalculatedPoints.slice(0, 1);
     }
    return { ...entry, points: pointsToRender };
  }).filter(entry => entry.points.length > 0);

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

  // --- Sort for Rendering Order ---
  const sortedContributorData = [...finalContributorData].sort((a, b) => {
    const aIsHighlight = a.contributor === highlightContributor;
    const bIsHighlight = b.contributor === highlightContributor;
    if (aIsHighlight && !bIsHighlight) return 1;
    if (!aIsHighlight && bIsHighlight) return -1;
    return 0;
  });

  // --- Draw Contributor Lines ---
  sortedContributorData.forEach((entry) => {
    const isHighlight = entry.contributor === highlightContributor;
    const isError = errorContributors.includes(entry.contributor);

    // --- Opacity Calculation ---
    let rankOpacity = 0.5; // Default base opacity if ranks not provided or invalid rank
    const minRankOpacity = 0.2; // Define minimum rank opacity
    if (options?.ranks) {
      const rank = options.ranks[entry.contributor];
      if (rank && rank > 0) {
         rankOpacity = Math.max(minRankOpacity, 1 / rank); // Use rank opacity directly, with floor
      } else {
         rankOpacity = minRankOpacity; // Use floor if rank invalid
      }
    }

    // Apply animation modulation
    let modulatedOpacity = rankOpacity;
    if (options?.animationProgress !== undefined && options.animationProgress < 1) {
       modulatedOpacity = Math.max(0.05, rankOpacity * options.animationProgress);
    }

    // Calculate final opacities for line/label and points
    let finalLineOpacity = modulatedOpacity; // Line opacity is modulated rank opacity
    let finalPointOpacity = Math.min(1.0, finalLineOpacity + 0.25); // Point opacity = line + 25%

    // Apply highlight/error overrides
    if (isHighlight) {
      finalLineOpacity = 1.0;
      finalPointOpacity = 1.0;
    }
    if (isError) {
       finalLineOpacity = 0.85; // Error takes precedence
       finalPointOpacity = 0.85;
    }
    // Minimum visibility is handled by minRankOpacity and animation modulation floor


    // --- Map Points to SVG Coords ---
    const points = entry.points.map((pt) => {
      const timeRangeDuration = (maxTime && minTime) ? (maxTime - minTime) : 1;
      const x = leftMargin + (((pt.time ?? minTime ?? 0) - (minTime ?? 0)) / timeRangeDuration) * (width - leftMargin - rightMargin);
      const y = topMargin + (1 - pt.xp / maxXP) * (height - topMargin - bottomMargin);
      return { x, y, xp: pt.xp, time: pt.time };
    });

    // --- Draw Line Path ---
    if (points.length > 1) {
      const path = document.createElementNS(svgNS, "path");
      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        d += ` L ${points[i].x} ${points[i].y}`;
      }
      path.setAttribute("d", d);
      path.setAttribute("stroke", isError ? BAD : GOOD);
      path.setAttribute("stroke-width", "2");
      path.setAttribute("fill", "none");
      path.setAttribute("opacity", finalLineOpacity.toString()); // Use finalLineOpacity
      svg.appendChild(path);
    }

    // --- Draw Points (Circles) ---
    points.forEach((pt) => {
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", pt.x.toString());
      circle.setAttribute("cy", pt.y.toString());
      circle.setAttribute("r", "2");
      circle.setAttribute("fill", isError ? BAD : GOOD);
      circle.setAttribute("opacity", finalPointOpacity.toString()); // Use finalPointOpacity
      svg.appendChild(circle);
    });

    // --- Draw Contributor Label ---
    if (points.length > 0) {
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("font-size", "14");
      label.setAttribute("fill", isError ? BAD : GOOD);
      label.setAttribute("opacity", finalLineOpacity.toString()); // Use finalLineOpacity for label too
      label.setAttribute("text-anchor", "start");
      label.textContent = entry.contributor;

      const lastSvgPoint = points[points.length - 1];
      label.setAttribute("x", "0");
      label.setAttribute("y", "-9999");
      svg.appendChild(label);
      const textWidth = label.getBBox().width;
      const unclampedX = lastSvgPoint.x + 8;
      const maxX = width - rightMargin - textWidth;
      let labelX = Math.min(unclampedX, maxX);
      const minLabelX = lastSvgPoint.x + 12;
      if (labelX < minLabelX) {
        labelX = minLabelX;
      }
      label.setAttribute("x", labelX.toString());
      label.setAttribute("y", (lastSvgPoint.y + 4).toString());
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

  // --- Draw Legend ---
  if (showLegend) {
    let lx = leftMargin;
    const ly = height - bottomMargin + 8;
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
    }
  }
}
