import type { ChartConfig } from '../types/chart-types';
import { ChartType } from '../types/chart-types';

interface BarChartProps {
  config: ChartConfig;
  data: any[];
  width?: number;
  height?: number;
  className?: string;
}

// Basic color palette
const defaultColors = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F',
  '#FFBB28', '#FF8042', '#A4DE6C', '#d0ed57'
];

// Simple utility for creating SVG elements
function createSvgElement<K extends keyof SVGElementTagNameMap>(tagName: K): SVGElementTagNameMap[K] {
  return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}

/**
 * Renders a Bar Chart using SVG into a container element.
 * Note: This is a simplified implementation compared to Recharts.
 * @param container - The HTMLElement to render the chart into.
 * @param props - The properties for the bar chart.
 */
export function renderBarChart(container: HTMLElement, props: BarChartProps): void {
  const {
    config,
    data,
    width = 600,
    height = 400,
    className = ''
  } = props;

  // --- Data Preparation ---
  const xDimensionKey = config.dimensions.x?.name;
  const yDimensionKeys = config.dimensions.y ? [config.dimensions.y.name] :
    (data && data.length > 0 ? Object.keys(data[0]).filter(key => typeof data[0][key] === 'number' && key !== 'id' && key !== 'issueId') : []); // Infer numeric keys

  if (!data || data.length === 0 || !xDimensionKey || yDimensionKeys.length === 0) {
    container.innerHTML = `<div class="chart-container ${className}" style="width:${width}px; height:${height}px;"><p>Insufficient data or configuration for Bar Chart.</p></div>`;
    return;
  }

  // Clear previous content
  container.innerHTML = '';
  container.className = `chart-container ${className}`;
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;

  // --- Chart Setup ---
  const margin = { top: 30, right: 30, bottom: 50, left: 50 }; // Increased bottom/left for labels
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const svg = createSvgElement('svg');
  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.style.display = 'block'; // Prevent extra space below SVG

  const chartGroup = createSvgElement('g');
  chartGroup.setAttribute('transform', `translate(${margin.left}, ${margin.top})`);
  svg.appendChild(chartGroup);

  // Add title
  const title = createSvgElement('text');
  title.setAttribute('x', `${width / 2}`);
  title.setAttribute('y', `${margin.top / 2}`);
  title.setAttribute('text-anchor', 'middle');
  title.setAttribute('dominant-baseline', 'middle');
  title.style.fontSize = '14px';
  title.style.fontWeight = 'bold';
  title.textContent = config.title || 'Bar Chart';
  svg.appendChild(title); // Add title directly to SVG, outside chartGroup transform

  // --- Scales ---
  // X Scale (Categorical)
  const xScale = (index: number) => (index + 0.5) * (chartWidth / data.length); // Center bars in bands
  const barWidth = (chartWidth / data.length) * 0.8; // 80% of band width

  // Y Scale (Linear)
  const yMax = Math.max(...data.map(d => Math.max(...yDimensionKeys.map(key => d[key] || 0))));
  const yScale = (value: number) => chartHeight - (value / yMax) * chartHeight;

  // --- Axes ---
  // X Axis
  const xAxisGroup = createSvgElement('g');
  xAxisGroup.setAttribute('transform', `translate(0, ${chartHeight})`);
  chartGroup.appendChild(xAxisGroup);

  const xAxisLine = createSvgElement('line');
  xAxisLine.setAttribute('x1', '0');
  xAxisLine.setAttribute('y1', '0');
  xAxisLine.setAttribute('x2', `${chartWidth}`);
  xAxisLine.setAttribute('y2', '0');
  xAxisLine.setAttribute('stroke', '#ccc');
  xAxisGroup.appendChild(xAxisLine);

  data.forEach((d, i) => {
    const xPos = xScale(i);
    // Tick mark
    const tick = createSvgElement('line');
    tick.setAttribute('x1', `${xPos}`);
    tick.setAttribute('y1', '0');
    tick.setAttribute('x2', `${xPos}`);
    tick.setAttribute('y2', '5');
    tick.setAttribute('stroke', '#ccc');
    xAxisGroup.appendChild(tick);
    // Label
    const label = createSvgElement('text');
    label.setAttribute('x', `${xPos}`);
    label.setAttribute('y', '15'); // Position below tick
    label.setAttribute('text-anchor', 'middle');
    label.style.fontSize = '10px';
    label.textContent = d[xDimensionKey];
    xAxisGroup.appendChild(label);
  });

  // Y Axis
  const yAxisGroup = createSvgElement('g');
  chartGroup.appendChild(yAxisGroup);

  const yAxisLine = createSvgElement('line');
  yAxisLine.setAttribute('x1', '0');
  yAxisLine.setAttribute('y1', '0');
  yAxisLine.setAttribute('x2', '0');
  yAxisLine.setAttribute('y2', `${chartHeight}`);
  yAxisLine.setAttribute('stroke', '#ccc');
  yAxisGroup.appendChild(yAxisLine);

  // Y Axis Ticks (example: 5 ticks)
  const numTicks = 5;
  for (let i = 0; i <= numTicks; i++) {
    const value = (yMax / numTicks) * i;
    const yPos = yScale(value);
    // Tick mark
    const tick = createSvgElement('line');
    tick.setAttribute('x1', '-5');
    tick.setAttribute('y1', `${yPos}`);
    tick.setAttribute('x2', '0');
    tick.setAttribute('y2', `${yPos}`);
    tick.setAttribute('stroke', '#ccc');
    yAxisGroup.appendChild(tick);
    // Label
    const label = createSvgElement('text');
    label.setAttribute('x', '-10'); // Position left of tick
    label.setAttribute('y', `${yPos}`);
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('dominant-baseline', 'middle');
    label.style.fontSize = '10px';
    label.textContent = value.toFixed(0); // Adjust formatting as needed
    yAxisGroup.appendChild(label);
  }

  // --- Bars ---
  // Note: This simplified version handles only the first yDimensionKey for non-grouped/stacked charts.
  // Grouped/Stacked bars require more complex calculations.
  const yKey = yDimensionKeys[0];
  data.forEach((d, i) => {
    const x = xScale(i) - barWidth / 2;
    const y = yScale(d[yKey] || 0);
    const h = chartHeight - y;

    const bar = createSvgElement('rect');
    bar.setAttribute('x', `${x}`);
    bar.setAttribute('y', `${y}`);
    bar.setAttribute('width', `${barWidth}`);
    bar.setAttribute('height', `${h > 0 ? h : 0}`); // Ensure height is not negative
    bar.setAttribute('fill', defaultColors[0]); // Use first color

    // Basic Tooltip (shows value in title)
    const title = createSvgElement('title');
    title.textContent = `${xDimensionKey}: ${d[xDimensionKey]}, ${yKey}: ${d[yKey]}`;
    bar.appendChild(title);

    chartGroup.appendChild(bar);
  });

  // Append SVG to container
  container.appendChild(svg);
}
