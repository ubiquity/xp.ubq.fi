import React, { useEffect, useState } from 'react';
import type { ChartConfig, ChartTypeRecommendation } from '../types/chart-types';
import type { DataDimension } from '../types/data-types';
import { generateChartConfig, recommendChartType } from '../utils/chart-config-engine';
import { transformDataForVisualization } from '../utils/data-transformer';
import ChartFactory from '../visualizations/chart-factory';

interface VisualizationPanelProps {
  data: any[];
  selectedDimensions: DataDimension[];
  issueFilter?: string; // Add optional issue filter prop
  width?: number;
  height?: number;
}

/**
 * Panel that displays the visualization and chart options
 */
const VisualizationPanel: React.FC<VisualizationPanelProps> = ({
  data,
  selectedDimensions,
  issueFilter, // Destructure the new prop
  width = 800,
  height = 500
}) => {
  // State for chart recommendations and configuration
  const [chartRecommendation, setChartRecommendation] = useState<ChartTypeRecommendation | null>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [transformedData, setTransformedData] = useState<any[]>([]);

  // Update chart recommendations when dimensions change
  useEffect(() => {
    if (selectedDimensions.length > 0) {
      // Get chart recommendations based on selected dimensions
      const recommendation = recommendChartType(selectedDimensions);
      setChartRecommendation(recommendation);

      // Generate chart configuration based on primary recommendation
      const config = generateChartConfig(recommendation.primaryRecommendation, selectedDimensions);
      setChartConfig(config);
    } else {
      // Reset if no dimensions selected
      setChartRecommendation(null);
      setChartConfig(null);
    }
  }, [selectedDimensions]);

  // Transform data when dimensions or chart config changes
  useEffect(() => {
    if (data.length > 0 && selectedDimensions.length > 0 && chartConfig) {
      const transformed = transformDataForVisualization(data, selectedDimensions);
      setTransformedData(transformed);
    } else {
      setTransformedData([]);
    }
  }, [data, selectedDimensions, chartConfig]);

  // Select a different chart type from the recommendations
  const handleChartTypeChange = (chartType: string) => {
    if (chartRecommendation && selectedDimensions.length > 0) {
      const newConfig = generateChartConfig(chartType as any, selectedDimensions);
      setChartConfig(newConfig);
    }
  };

  // Show empty state if no dimensions selected
  if (selectedDimensions.length === 0) {
    return (
      <div className="visualization-panel empty-state" style={{ width, height }}>
        <div className="empty-message">
          <h3>Select dimensions to visualize</h3>
          <p>Use the dimension selector to choose data dimensions for visualization.</p>
        </div>
      </div>
    );
  }

  // Show loading state if data is being transformed
  if (selectedDimensions.length > 0 && !transformedData.length) {
    return (
      <div className="visualization-panel loading-state" style={{ width, height }}>
        <div className="loading-message">
          <h3>Preparing visualization...</h3>
          <p>Transforming data for the selected dimensions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="visualization-panel" style={{ width }}>
      <div className="chart-options">
        {chartRecommendation && (
          <>
            <div className="chart-recommendation">
              <h3>Recommended Chart Type</h3>
              <p>{chartRecommendation.reason}</p>
            </div>
            <div className="chart-type-selector">
              <label htmlFor="chart-type">Chart Type:</label>
              <select
                id="chart-type"
                value={chartConfig?.type}
                onChange={(e) => handleChartTypeChange(e.target.value)}
              >
                <option value={chartRecommendation.primaryRecommendation}>
                  {chartRecommendation.primaryRecommendation} (Recommended)
                </option>
                {chartRecommendation.alternativeRecommendations.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      <div className="visualization-container">
        {chartConfig && transformedData.length > 0 ? (
          <ChartFactory
            config={chartConfig}
            data={transformedData} // Data is already transformed, filtering happens inside ChartFactory/TimeSeriesChart
            issueFilter={issueFilter} // Pass the filter down
            width={width}
            height={height - 100} // Adjust for chart options height
          />
        ) : (
          <div className="no-data-message" style={{ height: height - 100 }}>
            <p>No data available for the selected dimensions.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualizationPanel;
