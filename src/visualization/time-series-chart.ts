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
    timeRangePercent?: number; // Current timeline percentage (0-100)
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
  // Use provided time range if available, otherwise calculate from data
  const minTime = options?.minTime ?? Math.min(...data.flatMap(entry => entry.series.map(pt => new Date(pt.time).getTime())));
  const maxTime = options?.maxTime ?? Math.max(...data.flatMap(entry => entry.series.map(pt => new Date(pt.time).getTime())));

  // For each contributor, build a cumulative XP array with interpolation
  const contributorData = data.map(entry => {
    // Sort events by time
    const sortedSeries = [...entry.series].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    // Calculate cumulative points
    let cumulative = 0;
    const points = sortedSeries.map(pt => {
      cumulative += pt.xp;
      return {
        time: new Date(pt.time).getTime(),
        xp: cumulative
      };
    });

    // The filtering based on absolute time is now done in main.ts before calling this function.
    // The 'data' parameter received here already contains the correctly filtered points.
    // Therefore, no additional filtering or interpolation based on timeRangePercent is needed here.

    return {
      contributor: entry.contributor,
      userId: entry.userId,
      points: points // Use the points directly from the filtered data passed in
    };
  });

  // Filter points based on cutoffTimeMs and interpolate the last segment
  const finalContributorData = contributorData.map(entry => {
    const allCalculatedPoints = entry.points; // These are already cumulative
    let pointsToRender = allCalculatedPoints;

    if (options?.cutoffTimeMs !== undefined && allCalculatedPoints.length > 0) {
      // Find the index of the last point *at or before* the cutoff time
      let lastVisibleIndex = -1;
      for (let i = 0; i < allCalculatedPoints.length; i++) {
        if (allCalculatedPoints[i].time <= options.cutoffTimeMs) {
          lastVisibleIndex = i;
        } else {
          break; // Points are sorted by time
        }
      }

      if (lastVisibleIndex === -1) {
        // Cutoff is before the first point
        pointsToRender = [];
      } else {
        // Take points up to the last visible one
        pointsToRender = allCalculatedPoints.slice(0, lastVisibleIndex + 1);

        // Check if interpolation is needed between lastVisibleIndex and the next point
        const nextPoint = allCalculatedPoints[lastVisibleIndex + 1];
        if (nextPoint && options.cutoffTimeMs > allCalculatedPoints[lastVisibleIndex].time) {
           const prevPoint = allCalculatedPoints[lastVisibleIndex];
           const timeDiff = nextPoint.time - prevPoint.time;
           if (timeDiff > 0) { // Avoid division by zero
             const fraction = (options.cutoffTimeMs - prevPoint.time) / timeDiff;
             const interpolatedXP = prevPoint.xp + (nextPoint.xp - prevPoint.xp) * fraction;
             pointsToRender.push({
               time: options.cutoffTimeMs,
               xp: interpolatedXP
             });
           }
        }
      }
    }
     // Ensure at least one point if original had points and cutoff is past first point
     if (allCalculatedPoints.length > 0 && pointsToRender.length === 0 && options?.cutoffTimeMs && options.cutoffTimeMs >= allCalculatedPoints[0].time) {
        pointsToRender = allCalculatedPoints.slice(0, 1);
     }


    return { ...entry, points: pointsToRender };

  }).filter(entry => entry.points.length > 0); // Filter out contributors with no points in range


  // Find max XP (cumulative, across all contributors and all times) for Y-axis scaling
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

  // Sort data to draw highlighted contributor last (on top)
  const sortedContributorData = [...finalContributorData].sort((a, b) => {
    const aIsHighlight = a.contributor === highlightContributor;
    const bIsHighlight = b.contributor === highlightContributor;
    if (aIsHighlight && !bIsHighlight) return 1; // a comes after b
    if (!aIsHighlight && bIsHighlight) return -1; // b comes after a
    return 0; // Keep original order otherwise
  });

  // --- Draw lines for each contributor (using their own event times) ---
  sortedContributorData.forEach((entry, idx) => {
    const isHighlight = entry.contributor === highlightContributor;
    const isError = errorContributors.includes(entry.contributor);

    // Calculate opacity based on rank
    let opacity = 0.7; // Default opacity
    const minOpacity = 0.2; // Minimum opacity to ensure visibility
    if (options?.ranks) {
      const rank = options.ranks[entry.contributor];
      if (rank && rank > 0) {
        opacity = Math.max(minOpacity, 1 / rank);
      } else {
        opacity = minOpacity; // Assign minimum if rank is missing or invalid
      }
    }

    // Override opacity for highlight and error states
    if (isHighlight) {
      opacity = 1.0;
    }
    if (isError) {
       opacity = 0.85; // Error opacity takes precedence over highlight
      }
     let finalOpacity = opacity; // Start with rank/highlight/error opacity

     // Apply animation fade-in if progress is provided and less than 1
     if (options?.animationProgress !== undefined && options.animationProgress < 1) {
        // Multiply base opacity by progress, ensuring minimum visibility
        finalOpacity = Math.max(0.05, finalOpacity * options.animationProgress);
     }

      // Map contributor's own points to SVG coordinates using the potentially fixed time range
     const points = entry.points.map((pt, i) => {
       const timeRangeDuration = (maxTime && minTime) ? (maxTime - minTime) : 1; // Avoid division by zero
       const x =
        leftMargin +
        (((pt.time ?? minTime ?? 0) - (minTime ?? 0)) / timeRangeDuration) *
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
      // Stroke is always GOOD unless error
      path.setAttribute(
        "stroke",
         isError ? BAD : GOOD
       );
        path.setAttribute("stroke-width", "2"); // Constant stroke width for all lines
        path.setAttribute("fill", "none");
        path.setAttribute("opacity", finalOpacity.toString()); // Use finalOpacity
       svg.appendChild(path);
     }

    // Draw points
    points.forEach((pt, i) => {
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", pt.x.toString());
       circle.setAttribute("cy", pt.y.toString());
       circle.setAttribute("r", "2"); // Constant radius for all points
       // Fill is always GOOD unless error
       circle.setAttribute(
        "fill",
         isError ? BAD : GOOD
       );
       circle.setAttribute("opacity", finalOpacity.toString()); // Use finalOpacity
       svg.appendChild(circle);
     });

    // Contributor label (right side, dynamically clamp and avoid collision with line/point)
    if (points.length > 0) {
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("font-size", "14");
       // Label color is always GOOD unless error
        label.setAttribute("fill", isError ? BAD : GOOD);
        label.setAttribute("opacity", finalOpacity.toString()); // Use finalOpacity
        // label.setAttribute("font-weight", isHighlight ? "bold" : "normal"); // Remove bold for highlight for consistency
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
