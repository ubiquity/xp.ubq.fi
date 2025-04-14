/**
 * Draws the X-axis ticks and labels (Time Scale) for the time series chart.
 */
interface DrawXAxisTicksOptions {
  svg: SVGSVGElement;
  svgNS: string;
  minTime: number;
  maxTime: number;
  width: number;
  height: number;
  leftMargin: number;
  rightMargin: number;
  bottomMargin: number;
  GREY: string;
  GREY_LIGHT: string;
}

export function drawXAxisTicks({
  svg,
  svgNS,
  minTime,
  maxTime,
  width,
  height,
  leftMargin,
  rightMargin,
  bottomMargin,
  GREY,
  GREY_LIGHT,
}: DrawXAxisTicksOptions): void {
  const timeRangeDuration = maxTime - minTime;
  if (timeRangeDuration <= 0) {
    return; // Avoid division by zero or unnecessary work
  }

  const startDate = new Date(minTime);
  const endDate = new Date(maxTime);
  const chartWidth = width - leftMargin - rightMargin;

  // Helper to calculate X position
  const getX = (timestamp: number): number => {
    return leftMargin + ((timestamp - minTime) / timeRangeDuration) * chartWidth;
  };

  // --- Weekly Ticks (Minor) ---
  let currentWeek = new Date(startDate);
  // Adjust to the start of the week (e.g., Sunday)
  currentWeek.setDate(startDate.getDate() - startDate.getDay());
  currentWeek.setHours(0, 0, 0, 0);

  // Iterate through weeks, adding 7 days each time
  while (currentWeek <= endDate) {
    const weekTimestamp = currentWeek.getTime();
    // Only draw if the tick falls within the actual min/max time range
    if (weekTimestamp >= minTime && weekTimestamp <= maxTime) {
      const x = getX(weekTimestamp);
      const tickMark = document.createElementNS(svgNS, "line");
      tickMark.setAttribute("x1", x.toString());
      tickMark.setAttribute("x2", x.toString());
      tickMark.setAttribute("y1", (height - bottomMargin).toString());
      tickMark.setAttribute("y2", (height - bottomMargin + 4).toString()); // Minor tick length
      tickMark.setAttribute("stroke", GREY);
      tickMark.setAttribute("stroke-width", "1");
      svg.appendChild(tickMark);
    }
    // Move to the next week
    currentWeek.setDate(currentWeek.getDate() + 7);
  }

  // --- Monthly Ticks (Major) ---
  let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (currentMonth <= endDate) {
    const monthTimestamp = currentMonth.getTime();
    // Only draw if the tick falls within the actual min/max time range
    if (monthTimestamp >= minTime && monthTimestamp <= maxTime) {
      const x = getX(monthTimestamp);

      // Major tick mark
      const tickMark = document.createElementNS(svgNS, "line");
      tickMark.setAttribute("x1", x.toString());
      tickMark.setAttribute("x2", x.toString());
      tickMark.setAttribute("y1", (height - bottomMargin).toString());
      tickMark.setAttribute("y2", (height - bottomMargin + 8).toString()); // Major tick length
      tickMark.setAttribute("stroke", GREY_LIGHT); // Brighter for major ticks
      tickMark.setAttribute("stroke-width", "1");
      svg.appendChild(tickMark);

      // Month number label
      const monthLabel = document.createElementNS(svgNS, "text");
      monthLabel.setAttribute("x", x.toString());
      monthLabel.setAttribute("y", (height - bottomMargin + 20).toString()); // Position below major tick
      monthLabel.setAttribute("text-anchor", "middle");
              monthLabel.setAttribute("font-size", "10");
              monthLabel.setAttribute("fill", GREY_LIGHT);
              const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
              monthLabel.textContent = monthNames[currentMonth.getMonth()]; // Shorthand month name
              svg.appendChild(monthLabel);
          }
    // Move to the next month
    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }
}
