/**
 * Draws the legend for the time series chart.
 */
interface DrawLegendOptions {
  svg: SVGSVGElement;
  svgNS: string;
  showLegend: boolean;
  highlightContributor: string | undefined;
  errorContributors: string[];
  leftMargin: number;
  height: number;
  bottomMargin: number;
  GOOD: string;
  BAD: string;
}

export function drawLegend({
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
}: DrawLegendOptions): void {
  if (!showLegend) {
    return;
  }

  let lx = leftMargin;
  const ly = height - bottomMargin + 8; // Position below X-axis ticks/labels

  // Legend for Highlighted Contributor
  if (highlightContributor) {
    const legendLine = document.createElementNS(svgNS, "rect");
    legendLine.setAttribute("x", lx.toString());
    legendLine.setAttribute("y", (ly + 4).toString()); // Align vertically with text baseline
    legendLine.setAttribute("width", "24");
    legendLine.setAttribute("height", "4");
    legendLine.setAttribute("fill", GOOD);
    legendLine.setAttribute("opacity", "1");
    svg.appendChild(legendLine);

    const legendLabel = document.createElementNS(svgNS, "text");
    legendLabel.setAttribute("x", (lx + 32).toString());
    legendLabel.setAttribute("y", (ly + 12).toString()); // Position text slightly lower
    legendLabel.setAttribute("font-size", "12");
    legendLabel.setAttribute("fill", GOOD); // Use GOOD color for the label as well
    legendLabel.textContent = highlightContributor;
    svg.appendChild(legendLabel);
    // Estimate width and add padding
    lx += highlightContributor.length * 7 + 48; // Adjust spacing based on estimated text width
  }

  // Legend for Error/Flagged Contributors
  if (errorContributors.length > 0) {
    const errorLine = document.createElementNS(svgNS, "rect");
    errorLine.setAttribute("x", lx.toString());
    errorLine.setAttribute("y", (ly + 4).toString()); // Align vertically
    errorLine.setAttribute("width", "24");
    errorLine.setAttribute("height", "4");
    errorLine.setAttribute("fill", BAD);
    errorLine.setAttribute("opacity", "0.85");
    svg.appendChild(errorLine);

    const errorLabel = document.createElementNS(svgNS, "text");
    errorLabel.setAttribute("x", (lx + 32).toString());
    errorLabel.setAttribute("y", (ly + 12).toString()); // Position text slightly lower
    errorLabel.setAttribute("font-size", "12");
    errorLabel.setAttribute("fill", BAD); // Use BAD color for the label
    errorLabel.textContent = "Error/Flagged";
    svg.appendChild(errorLabel);
  }
}
