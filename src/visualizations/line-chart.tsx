import { format, parseISO } from 'date-fns';
import React, { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type { ChartConfig } from '../types/chart-types';
import BaseChart from './base-chart';

interface LineChartProps {
  config: ChartConfig;
  data: any[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Line Chart component using Recharts
 * Primarily used for time series data or continuous relationships
 */
const LineChart: React.FC<LineChartProps> = ({
  config,
  data,
  width = 600,
  height = 400,
  className = ''
}) => {
  // Prepare chart data
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Get dimension information
    const xDimension = config.dimensions.x;
    const yDimension = config.dimensions.y;
    const categoryDimension = config.dimensions.category;

    // Determine if the x-axis is temporal
    const isTemporalX = xDimension?.dataType === 'temporal';

    // Create chart data based on dimensions
    let formattedData = [...data];

    // If we have a temporal x dimension, format the data for proper display
    if (isTemporalX && xDimension) {
      formattedData = formattedData.map(item => {
        const dateValue = item[xDimension.name];
        if (dateValue && typeof dateValue === 'string') {
          try {
            // Parse ISO date and format it
            const date = parseISO(dateValue);
            return {
              ...item,
              [xDimension.name]: format(date, 'MMM dd, yyyy'),
              originalDate: dateValue // keep original for sorting
            };
          } catch (e) {
            return item;
          }
        }
        return item;
      });

      // Sort by the original date
      formattedData.sort((a, b) => {
        if (a.originalDate && b.originalDate) {
          return new Date(a.originalDate).getTime() - new Date(b.originalDate).getTime();
        }
        return 0;
      });
    }

    return formattedData;
  }, [data, config]);

  // Extract data series for the chart
  const dataSeries = useMemo(() => {
    if (!data || data.length === 0) return [];

    const yDimension = config.dimensions.y;
    const categoryDimension = config.dimensions.category;

    // If we have a specific y dimension, use it
    if (yDimension) {
      if (categoryDimension) {
        // If we have a category dimension, we need multiple lines
        // Get unique categories
        const categories = Array.from(
          new Set(data.map(item => item[categoryDimension.name]))
        );

        // Return a series for each category
        return categories.map(category => ({
          dataKey: yDimension.name,
          name: `${yDimension.name} (${category})`,
          category
        }));
      }

      // Otherwise, just use the y dimension
      return [{ dataKey: yDimension.name, name: yDimension.name }];
    }

    // If no dimensions specified, find numerical fields
    const firstItem = data[0];
    const numericalFields = Object.keys(firstItem).filter(key => {
      return (
        typeof firstItem[key] === 'number' &&
        key !== 'id' &&
        key !== 'issueId' &&
        !key.endsWith('_count')
      );
    });

    return numericalFields.map(field => ({
      dataKey: field,
      name: field
    }));
  }, [data, config]);

  // If no data or series, show base chart with no data message
  if (!chartData.length || !dataSeries.length) {
    return <BaseChart config={config} data={[]} width={width} height={height} className={className} />;
  }

  // Define colors for the lines
  const colors = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F',
    '#FFBB28', '#FF8042', '#A4DE6C', '#d0ed57'
  ];

  // Determine the x-axis field
  const xAxisDataKey = config.dimensions.x?.name || 'name';

  // Filter data if we have a category dimension
  const categoryDimension = config.dimensions.category;
  const filteredDataSeries = categoryDimension
    ? dataSeries.map(series => {
        // Only return data points that match the category
        // Check if series has a category property
        if ('category' in series) {
          const filteredData = chartData.filter(
            item => item[categoryDimension.name] === series.category
          );
          return { ...series, data: filteredData };
        }
        // Fallback to using all data if no category
        return { ...series, data: chartData };
      })
    : dataSeries.map(series => ({ ...series, data: chartData }));

  return (
    <div className={`chart-container ${className}`} style={{ width, height }}>
      <div className="chart-title">{config.title}</div>
      {config.description && <div className="chart-description">{config.description}</div>}

      <ResponsiveContainer width="100%" height={height - 60}>
        <RechartsLineChart
          margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={xAxisDataKey}
            type="category"
          />
          <YAxis />
          <Tooltip />
          <Legend />

          {filteredDataSeries.map((series, index) => (
            <Line
              key={`${series.dataKey}-${index}`}
              type="monotone"
              data={series.data}
              dataKey={series.dataKey}
              name={series.name}
              stroke={colors[index % colors.length]}
              activeDot={{ r: 8 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LineChart;
