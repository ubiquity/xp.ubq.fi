import React from 'react';
import type { ChartConfig } from '../types/chart-types';

interface BaseChartProps {
  config: ChartConfig;
  data: any[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Base chart component that all other chart types will extend
 */
const BaseChart: React.FC<BaseChartProps> = ({
  config,
  data,
  width = 600,
  height = 400,
  className = ''
}) => {
  // Fallback content if no data is available
  if (!data || data.length === 0) {
    return (
      <div
        className={`chart-container ${className}`}
        style={{ width, height, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        <div className="no-data-message">
          <p>No data available</p>
        </div>
      </div>
    );
  }

  // Base chart only renders a container with metadata
  // This component is meant to be extended by specific chart implementations
  return (
    <div
      className={`chart-container ${className}`}
      style={{ width, height }}
    >
      <div className="chart-title">{config.title}</div>
      {config.description && <div className="chart-description">{config.description}</div>}
      <div className="chart-content">
        {/* Chart content will be rendered by specific chart implementations */}
      </div>
    </div>
  );
};

export default BaseChart;
