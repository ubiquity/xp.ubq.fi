import { ChartType, type ChartConfig, type ChartTypeRecommendation } from '../types/chart-types';
import type { DataDimension } from '../types/data-types';
import type { LeaderboardEntry, TimeSeriesEntry } from '../data-transform';
import type { OverviewResult } from '../analytics/contribution-overview';
import type { QualityResult } from '../analytics/comment-quality';
import type { ReviewMetricsResult } from '../analytics/review-metrics';
import { generateChartConfig, recommendChartType } from '../utils/chart-config-engine';
// Removed unused import: import { transformDataForVisualization } from '../utils/data-transformer';
import { renderChartFactory } from '../visualizations/chart-factory'; // Import .ts version

// Define the structure for the comprehensive data state
type DashboardDataState = {
  leaderboard: LeaderboardEntry[];
  timeSeries: TimeSeriesEntry[];
  overview: OverviewResult | null;
  quality: QualityResult | null;
  reviews: ReviewMetricsResult | null;
};

interface VisualizationPanelProps {
  data: DashboardDataState | null;
  selectedDimensions: DataDimension[];
  currentChartConfig: ChartConfig | null; // Panel now receives the config
  onChartTypeChange: (newConfig: ChartConfig) => void; // Callback to update config
  issueFilter?: string;
  width?: number;
  height?: number;
}

/**
 * Renders the visualization panel and chart options into a container element.
 * @param container - The HTMLElement to render the panel into.
 * @param props - The properties for the visualization panel.
 */
export function renderVisualizationPanel(container: HTMLElement, props: VisualizationPanelProps): void {
  const {
    data,
    selectedDimensions,
    currentChartConfig, // Use the passed-in config
    onChartTypeChange,  // Use the callback
    issueFilter,
    width = 800,
    height = 500
  } = props;

  // Clear previous content
  container.innerHTML = '';
  container.className = 'visualization-panel'; // Base class
  container.style.width = `${width}px`;
  // Note: Height might be dynamically adjusted by content

  // --- Empty State ---
  if (selectedDimensions.length === 0) {
    container.classList.add('empty-state');
    container.style.height = `${height}px`; // Set fixed height for empty/loading
    const emptyMessageDiv = document.createElement('div');
    emptyMessageDiv.className = 'empty-message';
    emptyMessageDiv.innerHTML = `
      <h3>Select dimensions to visualize</h3>
      <p>Use the dimension selector to choose data dimensions for visualization.</p>
    `;
    container.appendChild(emptyMessageDiv);
    return;
  }

  // --- Calculate Recommendation and Config (if not provided) ---
  // Recommendation is always calculated based on dimensions
  const chartRecommendation = recommendChartType(selectedDimensions);
  // Use provided config, or generate initial one if null
  const chartConfig = currentChartConfig ?? generateChartConfig(chartRecommendation.primaryRecommendation, selectedDimensions);

  // --- Calculate Transformed Data ---
  let transformedData: any[] = [];
  if (data && chartConfig) {
    if (chartConfig.type === ChartType.LEADERBOARD) {
      transformedData = data.leaderboard || [];
    } else if (chartConfig.type === ChartType.LINE || chartConfig.type === ChartType.AREA) {
      transformedData = data.timeSeries || [];
    } else {
      // Handle other types or show warning if transformation logic is missing
      console.warn(`Data transformation logic for chart type ${chartConfig.type} might be needed or needs rework.`);
      // For now, pass raw data if not leaderboard/timeseries, specific charts might handle it
      transformedData = data.leaderboard || data.timeSeries || []; // Example fallback
    }
  }

  // --- Loading State ---
  // Check based on selected dimensions vs. transformed data *for the specific chart type*
  let isLoading = false;
  if (selectedDimensions.length > 0) {
      if (chartConfig?.type === ChartType.LEADERBOARD && !data?.leaderboard?.length) isLoading = true;
      else if ((chartConfig?.type === ChartType.LINE || chartConfig?.type === ChartType.AREA) && !data?.timeSeries?.length) isLoading = true;
      // Add checks for other types if necessary
      else if (!transformedData.length && data) isLoading = true; // General check if data exists but transformation failed/empty
  }


  if (isLoading) {
    container.classList.add('loading-state');
    container.style.height = `${height}px`; // Set fixed height for empty/loading
    const loadingMessageDiv = document.createElement('div');
    loadingMessageDiv.className = 'loading-message';
    loadingMessageDiv.innerHTML = `
      <h3>Preparing visualization...</h3>
      <p>Transforming data for the selected dimensions.</p>
    `;
    container.appendChild(loadingMessageDiv);
    return;
  }

  // --- Render Panel Content ---
  container.style.height = 'auto'; // Let content define height now

  // Chart Options Section
  const optionsDiv = document.createElement('div');
  optionsDiv.className = 'chart-options';

  if (chartRecommendation) {
    const recommendationDiv = document.createElement('div');
    recommendationDiv.className = 'chart-recommendation';
    recommendationDiv.innerHTML = `
      <h3>Recommended Chart Type</h3>
      <p>${chartRecommendation.reason}</p>
    `;
    optionsDiv.appendChild(recommendationDiv);

    const selectorDiv = document.createElement('div');
    selectorDiv.className = 'chart-type-selector';

    const label = document.createElement('label');
    label.htmlFor = 'chart-type-select';
    label.textContent = 'Chart Type:';
    selectorDiv.appendChild(label);

    const select = document.createElement('select');
    select.id = 'chart-type-select';
    select.value = chartConfig?.type || '';

    // Add primary recommendation
    const primaryOption = document.createElement('option');
    primaryOption.value = chartRecommendation.primaryRecommendation;
    primaryOption.textContent = `${chartRecommendation.primaryRecommendation} (Recommended)`;
    select.appendChild(primaryOption);

    // Add alternative recommendations
    chartRecommendation.alternativeRecommendations.forEach(type => {
      if (type !== chartRecommendation.primaryRecommendation) { // Avoid duplicate
        const altOption = document.createElement('option');
        altOption.value = type;
        altOption.textContent = type;
        select.appendChild(altOption);
      }
    });

    // Event listener to handle change
    select.addEventListener('change', (e) => {
      const newType = (e.target as HTMLSelectElement).value;
      if (selectedDimensions.length > 0) {
        const newConfig = generateChartConfig(newType as any, selectedDimensions);
        onChartTypeChange(newConfig); // Call the callback to update state externally
      }
    });

    selectorDiv.appendChild(select);
    optionsDiv.appendChild(selectorDiv);
  }
  container.appendChild(optionsDiv);

  // Visualization Container Section
  const vizContainer = document.createElement('div');
  vizContainer.className = 'visualization-container';
  const chartHeight = height - (optionsDiv.offsetHeight || 100); // Adjust height dynamically or use estimate
  vizContainer.style.height = `${chartHeight}px`; // Set height for chart area

  if (chartConfig && transformedData.length > 0) {
    // Call the renderChartFactory function
    renderChartFactory(vizContainer, {
      config: chartConfig,
      data: transformedData,
      issueFilter: issueFilter,
      width: width,
      height: chartHeight
    });
  } else {
    // No data message inside the viz container
    const noDataMessage = document.createElement('div');
    noDataMessage.className = 'no-data-message';
    noDataMessage.style.height = `${chartHeight}px`;
    noDataMessage.style.display = 'flex';
    noDataMessage.style.alignItems = 'center';
    noDataMessage.style.justifyContent = 'center';
    noDataMessage.innerHTML = `<p>No data available for the selected dimensions and chart type.</p>`;
    vizContainer.appendChild(noDataMessage);
  }
  container.appendChild(vizContainer);
}
