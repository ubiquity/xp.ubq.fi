import { ChartType, type ChartConfig } from '../types/chart-types';
import type { TimeSeriesEntry, LeaderboardEntry } from '../data-transform';
import { renderTimeSeriesChart } from '../visualization/time-series-chart';
import { renderBarChart } from './bar-chart'; // Import render function
import { renderBaseChart } from './base-chart'; // Import render function
import { renderLeaderboardChart } from './leaderboard-chart'; // Import render function

interface ChartFactoryProps {
  config: ChartConfig;
  data: any[];
  issueFilter?: string;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Renders the appropriate chart into the container based on the config.
 * @param container - The HTMLElement to render the chart into.
 * @param props - The properties for the chart factory.
 */
export function renderChartFactory(container: HTMLElement, props: ChartFactoryProps): void {
  const {
    config,
    data,
    issueFilter,
    width = 600,
    height = 400,
    className = ''
  } = props;

  // Clear previous content
  container.innerHTML = '';
  // Apply base class, specific chart functions might add more
  container.className = `chart-factory-container ${className}`;
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;


  // Select the appropriate rendering function based on chart type
  switch (config.type) {
    case ChartType.BAR:
    case ChartType.GROUPED_BAR:
      renderBarChart(container, { config, data, width, height, className });
      break;

    case ChartType.STACKED_BAR:
      // Pass stacked option through config
      renderBarChart(container, {
        config: { ...config, options: { ...config.options, stacked: true } },
        data,
        width,
        height,
        className
      });
      break;

    case ChartType.LINE:
    case ChartType.AREA:
      if (data && data.length > 0) {
        const timeSeriesData = data as TimeSeriesEntry[];
        renderTimeSeriesChart(timeSeriesData, container, {
          width,
          height,
          scaleMode: config.options?.scaleMode as ('linear' | 'log' | undefined)
          // Removed issueFilter as it's not accepted by renderTimeSeriesChart
        });
      } else {
         // Handle no data case for time series specifically if needed
         const baseProps: import('./base-chart').BaseChartProps = { config, data: [], width, height, className };
         const baseElement = renderBaseChart(baseProps);
         // Base chart renderer already clears the container, so just append its result
         // We need to clear the factory container first though.
         container.innerHTML = '';
         container.appendChild(baseElement);
      }
      break;

    case ChartType.LEADERBOARD:
      const leaderboardData = data as LeaderboardEntry[];
      renderLeaderboardChart(container, { data: leaderboardData, className });
      break;

    default:
      // If the chart type is not supported yet, use the base chart renderer
      const baseProps: import('./base-chart').BaseChartProps = {
         config: {
           ...config,
           title: config.title || `Chart Type: ${config.type}`, // Add title if missing
           description: `Chart type ${config.type} is not implemented yet.`
         },
         data, // Pass original data to base chart for no-data check
         width,
         height,
         className
       };
      const baseElement = renderBaseChart(baseProps);
      // Base chart renderer already clears the container, so just append its result
      // We need to clear the factory container first though.
      container.innerHTML = '';
      container.appendChild(baseElement);
      break;
  }
}
