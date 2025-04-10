import React from 'react';
import { ChartType, type ChartConfig } from '../types/chart-types';
import BarChart from './bar-chart';
import BaseChart from './base-chart';
import LineChart from './line-chart';

interface ChartFactoryProps {
  config: ChartConfig;
  data: any[];
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

    case ChartType.LINE:
    case ChartType.AREA:
      return (
        <LineChart
          config={config}
          data={data}
          width={width}
          height={height}
          className={className}
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
