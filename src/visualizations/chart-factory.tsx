import React, { useEffect, useRef } from 'react'; // Add useEffect, useRef
import { ChartType, type ChartConfig } from '../types/chart-types';
import type { TimeSeriesEntry, LeaderboardEntry } from '../data-transform'; // Import TimeSeriesEntry AND LeaderboardEntry
import { renderTimeSeriesChart } from '../visualization/time-series-chart'; // Import the custom renderer
import BarChart from './bar-chart';
import BaseChart from './base-chart';
import LeaderboardChart from './leaderboard-chart'; // Import the new leaderboard chart
// Remove LineChart import if it's only used for the custom chart now
// import LineChart from './line-chart';

interface ChartFactoryProps {
  config: ChartConfig;
  data: any[];
  issueFilter?: string; // Add optional issue filter prop
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Chart Factory component that renders the appropriate chart based on the config
 */
const ChartFactory: React.FC<ChartFactoryProps> = ({
  config,
  data,
  issueFilter, // Destructure the new prop
  width = 600,
  height = 400,
  className = ''
}) => {
  // Select the appropriate chart component based on chart type
  switch (config.type) {
    case ChartType.BAR:
      return (
        <BarChart
          config={config}
          data={data}
          width={width}
          height={height}
          className={className}
        />
      );

    case ChartType.GROUPED_BAR:
      return (
        <BarChart
          config={config}
          data={data}
          width={width}
          height={height}
          className={className}
        />
      );

    case ChartType.STACKED_BAR:
      // For the MVP, we'll use the same BarChart component for stacked bars
      return (
        <BarChart
          config={{...config, options: {...config.options, stacked: true}}}
          data={data}
          width={width}
          height={height}
          className={className}
        />
      );

    case ChartType.LINE: // Assuming LINE is used for our custom time series
    case ChartType.AREA: // Assuming AREA is also used for our custom time series
      // Use a container div and call the custom rendering function
      const containerRef = useRef<HTMLDivElement>(null);

      useEffect(() => {
        if (containerRef.current && data && data.length > 0) {
          // Ensure data is in the expected TimeSeriesEntry[] format
          // This might require adjustment based on how data is transformed upstream
          const timeSeriesData = data as TimeSeriesEntry[];

          renderTimeSeriesChart(timeSeriesData, containerRef.current, {
            width,
            height,
            // Pass other relevant options from config if needed
            // e.g., highlightContributor: config.options?.highlight,
            // ranks: config.options?.ranks,
            scaleMode: config.options?.scaleMode as ('linear' | 'log' | undefined),
            issueFilter: issueFilter // Pass the filter here
          });
        }
      }, [data, config, width, height, issueFilter]); // Re-render if these change

      return <div ref={containerRef} className={`chart-container ${className}`} style={{ width, height }}></div>;

    case ChartType.LEADERBOARD:
      // Ensure data is in LeaderboardEntry[] format
      const leaderboardData = data as LeaderboardEntry[];
      return (
        <LeaderboardChart
          data={leaderboardData}
          className={className}
          // Pass config if needed later
        />
      );

    // For MVP, we'll implement a subset of chart types
    // Future implementations would add more chart types here

    default:
      // If the chart type is not supported yet, use the base chart
      return (
        <BaseChart
          config={{
            ...config,
            description: `Chart type ${config.type} is not implemented yet.`
          }}
          data={data}
          width={width}
          height={height}
          className={className}
        />
      );
  }
};

export default ChartFactory;
