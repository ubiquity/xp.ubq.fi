/**
 * Draws the Y-axis ticks and labels (XP Scale) for the time series chart.
 */
interface DrawYAxisTicksOptions {
  svg: SVGSVGElement;
  svgNS: string;
  maxXP: number;
  height: number;
  topMargin: number;
  bottomMargin: number;
  leftMargin: number;
  GREY: string;
  GREY_LIGHT: string;
}

export function drawYAxisTicks({
  svg,
  svgNS,
  maxXP,
  height,
  topMargin,
  bottomMargin,
  leftMargin,
  GREY,
  GREY_LIGHT,
}: DrawYAxisTicksOptions): void {
  const chartHeight = height - topMargin - bottomMargin;
  const numSegments = 4; // Corresponds to the 5 grid lines (0 to 4)

  // Iterate through the 5 grid line positions (0 to 4)
  for (let i = 0; i <= numSegments; i++) {
      // Calculate the Y position exactly like the grid lines
      // i=0 corresponds to the top grid line (maxXP), i=4 corresponds to the bottom grid line (0 XP)
      const y = topMargin + chartHeight * (i / numSegments); // y goes from topMargin to topMargin + chartHeight

      // Calculate the corresponding XP value for this grid line position
      // When i=0 (top), value is maxXP. When i=4 (bottom), value is 0.
      const tickValue = maxXP * (1 - (i / numSegments));

      // Draw the tick mark
      const tickMark = document.createElementNS(svgNS, "line");
      tickMark.setAttribute("x1", (leftMargin - 4).toString());
      tickMark.setAttribute("x2", leftMargin.toString());
      tickMark.setAttribute("y1", y.toString());
      tickMark.setAttribute("y2", y.toString());
      tickMark.setAttribute("stroke", GREY);
      tickMark.setAttribute("stroke-width", "1");
      svg.appendChild(tickMark);

      // Draw the tick label
      const tickLabel = document.createElementNS(svgNS, "text");
      tickLabel.setAttribute("x", (leftMargin - 8).toString());
      tickLabel.setAttribute("y", (y + 4).toString()); // Adjust vertical alignment
      tickLabel.setAttribute("text-anchor", "end");
      tickLabel.setAttribute("font-size", "10");
      tickLabel.setAttribute("fill", GREY_LIGHT);
      // Format label as whole numbers (e.g., 5000 -> 5k, 1200 -> 1k, 560 -> 1k, 499 -> 0k (or 500?), 500 -> 1k)
      // Let's round to nearest integer for k values, and nearest integer for non-k values.
      if (tickValue >= 1000) {
          // Round the value in thousands to the nearest whole number
          tickLabel.textContent = Math.round(tickValue / 1000).toString() + 'k';
      } else {
          // Round values less than 1000 to the nearest whole number
          tickLabel.textContent = Math.round(tickValue).toString();
      }
      svg.appendChild(tickLabel);
  }
}
