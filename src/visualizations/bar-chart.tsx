import React, { useMemo } from 'react';
import {
    Bar,
    CartesianGrid,
    Legend,
    BarChart as RechartsBarChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import type { ChartConfig } from '../types/chart-types';
import { ChartType } from '../types/chart-types';
import BaseChart from './base-chart';

interface BarChartProps {
  config: ChartConfig;
  data: any[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Bar Chart component using Recharts
 */
const BarChart: React.FC<BarChartProps> = ({
  config,
  data,
  width = 600,
  height = 400,
  className = ''
}) => {
  // Prepare data and chart settings
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Get dimension information
    const xDimension = config.dimensions.x;
    const yDimension = config.dimensions.y;
    const categoryDimension = config.dimensions.category;

    // If we have a category dimension, we need to structure data differently
    if (categoryDimension && config.type === ChartType.GROUPED_BAR) {
      // For grouped bar charts, maintain original data structure
      return data;
    }

    // For standard bar charts, ensure data has name/value properties
    return data.map(item => {
      const result: any = { ...item };

      // For X-axis, use the name from x dimension if available
      if (xDimension && xDimension.name) {
        result.name = item[xDimension.name];
      }

      return result;
    });
  }, [data, config]);

  // Get information about the Y-axis data series
  const yKeys = useMemo(() => {
    if (!data || data.length === 0) return [];

    const yDimension = config.dimensions.y;

    // If we have a specific y dimension, use it
    if (yDimension) {
      return [yDimension.name];
    }

    // Otherwise, try to find any numerical fields
    const firstItem = data[0];
    return Object.keys(firstItem).filter(key => {
      return (
        typeof firstItem[key] === 'number' &&
        key !== 'id' &&
        key !== 'issueId' &&
        !key.endsWith('_count')
      );
    });
  }, [data, config]);

  // If no data or yKeys, show base chart with no data message
  if (!chartData.length || !yKeys.length) {
    return <BaseChart config={config} data={[]} width={width} height={height} className={className} />;
  }

  // Define colors for the bars
  const colors = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F',
    '#FFBB28', '#FF8042', '#A4DE6C', '#d0ed57'
  ];

  // Determine the layout based on the chart configuration
  const isHorizontal = config.options?.horizontal === true;

  return (
    <div className={`chart-container ${className}`} style={{ width, height }}>
      <div className="chart-title">{config.title}</div>
      {config.description && <div className="chart-description">{config.description}</div>}

      <ResponsiveContainer width="100%" height={height - 60}>
        <RechartsBarChart
          data={chartData}
          layout={isHorizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 20, right: 30, left: 30, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />

          {isHorizontal ? (
            <>
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" />
            </>
          ) : (
            <>
              <XAxis dataKey="name" />
              <YAxis />
            </>
          )}

          <Tooltip />
          <Legend />

          {yKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              fill={colors[index % colors.length]}
              name={key}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarChart;
