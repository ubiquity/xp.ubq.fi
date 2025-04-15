import type { ChartConfig } from '../types/chart-types';

export interface BaseChartProps { // Add export keyword
  config: ChartConfig;
  data: any[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Renders a base chart structure (container, title, description) and handles no-data state.
 * Specific chart implementations should append their content to the returned element's 'chart-content' div.
 * @param props - The properties for the base chart.
 * @returns The root HTMLElement for the base chart.
 */
export function renderBaseChart(props: BaseChartProps): HTMLElement {
  const {
    config,
    data,
    width = 600,
    height = 400,
    className = ''
  } = props;

  const container = document.createElement('div');
  container.className = `chart-container ${className}`;
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;

  // Fallback content if no data is available
  if (!data || data.length === 0) {
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';

    const noDataMessage = document.createElement('div');
    noDataMessage.className = 'no-data-message';
    const p = document.createElement('p');
    p.textContent = config.description || 'No data available'; // Use description if provided
    noDataMessage.appendChild(p);
    container.appendChild(noDataMessage);
    return container;
  }

  // Render title
  const titleDiv = document.createElement('div');
  titleDiv.className = 'chart-title';
  titleDiv.textContent = config.title;
  container.appendChild(titleDiv);

  // Render description if available
  if (config.description) {
    const descriptionDiv = document.createElement('div');
    descriptionDiv.className = 'chart-description';
    descriptionDiv.textContent = config.description;
    container.appendChild(descriptionDiv);
  }

  // Create content area for specific charts to populate
  const contentDiv = document.createElement('div');
  contentDiv.className = 'chart-content';
  // Set height for content area, subtracting potential title/description height (estimate)
  contentDiv.style.height = `${height - 60}px`;
  contentDiv.style.width = '100%';
  container.appendChild(contentDiv);

  return container;
}
