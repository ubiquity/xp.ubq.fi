import { ChartType, type ChartConfig, type ChartTypeRecommendation } from '../types/chart-types';
import type { DataDimension } from '../types/data-types';
import { DataDimensionCategory } from '../types/data-types';

/**
 * Recommends appropriate chart types based on the selected data dimensions
 */
export function recommendChartType(
  dimensions: DataDimension[]
): ChartTypeRecommendation {
  // Default recommendation if we can't determine a better one
  const defaultRecommendation: ChartTypeRecommendation = {
    primaryRecommendation: ChartType.TABLE,
    alternativeRecommendations: [ChartType.BAR],
    reason: "Default recommendation for this data combination."
  };

  // We need at least one dimension to make a recommendation
  if (!dimensions || dimensions.length === 0) {
    return defaultRecommendation;
  }

  // Single dimension case
  if (dimensions.length === 1) {
    return recommendForSingleDimension(dimensions[0]);
  }

  // Two dimensions case
  if (dimensions.length === 2) {
    return recommendForTwoDimensions(dimensions[0], dimensions[1]);
  }

  // Three or more dimensions case
  return recommendForMultipleDimensions(dimensions);
}

/**
 * Generate chart configuration based on data dimensions and chart type
 */
export function generateChartConfig(
  chartType: ChartType,
  dimensions: DataDimension[]
): ChartConfig {
  // Start with a basic chart configuration
  const config: ChartConfig = {
    type: chartType,
    title: generateChartTitle(chartType, dimensions),
    dimensions: {}
  };

  // Configure dimensions based on chart type and available dimensions
  switch (chartType) {
    case ChartType.BAR:
    case ChartType.LINE:
    case ChartType.AREA:
      // For these chart types, we typically need an x and y axis
      if (dimensions.length >= 1) {
        config.dimensions.x = dimensions[0];
      }
      if (dimensions.length >= 2) {
        config.dimensions.y = dimensions[1];
      }
      // If we have a third dimension, use it for grouping/categorization
      if (dimensions.length >= 3) {
        config.dimensions.category = dimensions[2];
      }
      break;

    case ChartType.PIE:
      // Pie charts typically use a categorical dimension and a numeric dimension
      const categoryDimension = dimensions.find(d => d.dataType === 'categorical');
      const valueDimension = dimensions.find(d => d.dataType === 'numerical');

      if (categoryDimension) {
        config.dimensions.category = categoryDimension;
      }
      if (valueDimension) {
        config.dimensions.y = valueDimension;
      }
      break;

    case ChartType.SCATTER:
      // Scatter plots typically use 2 numerical dimensions, and optionally a third for point size
      const numericalDimensions = dimensions.filter(d => d.dataType === 'numerical');
      if (numericalDimensions.length >= 1) {
        config.dimensions.x = numericalDimensions[0];
      }
      if (numericalDimensions.length >= 2) {
        config.dimensions.y = numericalDimensions[1];
      }
      if (numericalDimensions.length >= 3) {
        config.dimensions.z = numericalDimensions[2];
      }

      // If there's a categorical dimension, use it for grouping points
      const categoricalDim = dimensions.find(d => d.dataType === 'categorical');
      if (categoricalDim) {
        config.dimensions.category = categoricalDim;
      }
      break;

    case ChartType.STACKED_BAR:
    case ChartType.GROUPED_BAR:
      // These charts typically use a categorical x-axis, a numerical y-axis, and a categorical group
      const catDimension = dimensions.find(d => d.dataType === 'categorical');
      const numDimension = dimensions.find(d => d.dataType === 'numerical');
      const groupDimension = dimensions.filter(d => d.dataType === 'categorical' && d !== catDimension)[0];

      if (catDimension) {
        config.dimensions.x = catDimension;
      }
      if (numDimension) {
        config.dimensions.y = numDimension;
      }
      if (groupDimension) {
        config.dimensions.category = groupDimension;
      }
      break;

    case ChartType.HEATMAP:
      // Heatmaps typically use two categorical dimensions and one numerical dimension
      const categoricalDimensions = dimensions.filter(d => d.dataType === 'categorical');
      const numericalDimension = dimensions.find(d => d.dataType === 'numerical');

      if (categoricalDimensions.length >= 1) {
        config.dimensions.x = categoricalDimensions[0];
      }
      if (categoricalDimensions.length >= 2) {
        config.dimensions.y = categoricalDimensions[1];
      }
      if (numericalDimension) {
        config.dimensions.z = numericalDimension;
      }
      break;

    case ChartType.TABLE:
      // Tables can display all dimensions
      config.dimensions.series = dimensions;
      break;

    default:
      // For other chart types, just assign dimensions sequentially
      if (dimensions.length >= 1) {
        config.dimensions.x = dimensions[0];
      }
      if (dimensions.length >= 2) {
        config.dimensions.y = dimensions[1];
      }
      if (dimensions.length >= 3) {
        config.dimensions.z = dimensions[2];
      }
  }

  return config;
}

/**
 * Recommend chart type for a single dimension
 */
function recommendForSingleDimension(dimension: DataDimension): ChartTypeRecommendation {
  // Determine the appropriate chart type based on the dimension's data type
  if (dimension.dataType === 'categorical') {
    return {
      primaryRecommendation: ChartType.PIE,
      alternativeRecommendations: [ChartType.BAR, ChartType.TABLE],
      reason: "Pie charts or bar charts are good for showing distribution across categories."
    };
  }

  if (dimension.dataType === 'numerical') {
    return {
      primaryRecommendation: ChartType.BAR,
      alternativeRecommendations: [ChartType.TABLE],
      reason: "Bar charts are good for showing distribution of a single numerical variable."
    };
  }

  if (dimension.dataType === 'temporal') {
    return {
      primaryRecommendation: ChartType.LINE,
      alternativeRecommendations: [ChartType.BAR, ChartType.TABLE],
      reason: "Line charts are suitable for showing trends over time."
    };
  }

  // Default case
  return {
    primaryRecommendation: ChartType.TABLE,
    alternativeRecommendations: [ChartType.BAR],
    reason: "A table is the safest way to display this type of data."
  };
}

/**
 * Recommend chart type for two dimensions
 */
function recommendForTwoDimensions(dimension1: DataDimension, dimension2: DataDimension): ChartTypeRecommendation {
  // Check for time series data (one temporal dimension + one numerical)
  if (
    (dimension1.dataType === 'temporal' && dimension2.dataType === 'numerical') ||
    (dimension2.dataType === 'temporal' && dimension1.dataType === 'numerical')
  ) {
    return {
      primaryRecommendation: ChartType.LINE,
      alternativeRecommendations: [ChartType.AREA, ChartType.BAR],
      reason: "Line charts are excellent for showing how numerical values change over time."
    };
  }

  // Check for category + number combination
  if (
    (dimension1.dataType === 'categorical' && dimension2.dataType === 'numerical') ||
    (dimension2.dataType === 'categorical' && dimension1.dataType === 'numerical')
  ) {
    return {
      primaryRecommendation: ChartType.BAR,
      alternativeRecommendations: [ChartType.PIE, ChartType.TABLE],
      reason: "Bar charts are good for comparing numerical values across different categories."
    };
  }

  // Check for two numerical dimensions
  if (dimension1.dataType === 'numerical' && dimension2.dataType === 'numerical') {
    return {
      primaryRecommendation: ChartType.SCATTER,
      alternativeRecommendations: [ChartType.LINE, ChartType.TABLE],
      reason: "Scatter plots are ideal for showing the relationship between two numerical variables."
    };
  }

  // Check for two categorical dimensions
  if (dimension1.dataType === 'categorical' && dimension2.dataType === 'categorical') {
    return {
      primaryRecommendation: ChartType.HEATMAP,
      alternativeRecommendations: [ChartType.GROUPED_BAR, ChartType.TABLE],
      reason: "Heatmaps can show the relationship between two categorical variables."
    };
  }

  // Default case
  return {
    primaryRecommendation: ChartType.TABLE,
    alternativeRecommendations: [ChartType.BAR],
    reason: "A table is the most flexible way to display this combination of data."
  };
}

/**
 * Recommend chart type for three or more dimensions
 */
function recommendForMultipleDimensions(dimensions: DataDimension[]): ChartTypeRecommendation {
  // Count the types of dimensions
  const numericalCount = dimensions.filter(d => d.dataType === 'numerical').length;
  const categoricalCount = dimensions.filter(d => d.dataType === 'categorical').length;
  const temporalCount = dimensions.filter(d => d.dataType === 'temporal').length;

  // Check for common use cases

  // Time series with categories (temporal + numerical + categorical)
  if (temporalCount >= 1 && numericalCount >= 1 && categoricalCount >= 1) {
    return {
      primaryRecommendation: ChartType.LINE,
      alternativeRecommendations: [ChartType.AREA, ChartType.STACKED_BAR],
      reason: "Line charts can show how numerical values for different categories change over time."
    };
  }

  // Multi-category comparison (categorical + numerical + categorical)
  if (categoricalCount >= 2 && numericalCount >= 1) {
    return {
      primaryRecommendation: ChartType.STACKED_BAR,
      alternativeRecommendations: [ChartType.GROUPED_BAR, ChartType.HEATMAP],
      reason: "Stacked or grouped bar charts can compare numerical values across multiple categories."
    };
  }

  // Three numerical dimensions
  if (numericalCount >= 3) {
    return {
      primaryRecommendation: ChartType.SCATTER,
      alternativeRecommendations: [ChartType.TABLE],
      reason: "Scatter plots can show relationships between multiple numerical variables using position and size."
    };
  }

  // Check for contributor-focused data
  const hasContributorDimension = dimensions.some(d =>
    d.category === DataDimensionCategory.CONTRIBUTOR
  );

  if (hasContributorDimension) {
    return {
      primaryRecommendation: ChartType.BAR,
      alternativeRecommendations: [ChartType.RADAR, ChartType.TABLE],
      reason: "Bar charts are good for comparing metrics across contributors."
    };
  }

  // Default for complex data
  return {
    primaryRecommendation: ChartType.TABLE,
    alternativeRecommendations: [ChartType.BAR, ChartType.SCATTER],
    reason: "For complex data combinations, tables provide the most comprehensive view."
  };
}

/**
 * Generate a descriptive title for the chart based on the chart type and dimensions
 */
function generateChartTitle(chartType: ChartType, dimensions: DataDimension[]): string {
  if (!dimensions || dimensions.length === 0) {
    return `${chartType.charAt(0) + chartType.slice(1).toLowerCase()} Chart`;
  }

  // For one dimension
  if (dimensions.length === 1) {
    return `${dimensions[0].name} Distribution`;
  }

  // For two dimensions
  if (dimensions.length === 2) {
    if (chartType === ChartType.SCATTER) {
      return `${dimensions[0].name} vs ${dimensions[1].name}`;
    }

    if (chartType === ChartType.LINE && (dimensions.some(d => d.dataType === 'temporal'))) {
      return `${dimensions.find(d => d.dataType !== 'temporal')?.name} Over Time`;
    }

    return `${dimensions[0].name} by ${dimensions[1].name}`;
  }

  // For three or more dimensions
  const primaryDimension = dimensions[0];
  const secondaryDimension = dimensions[1];
  const tertiaryDimension = dimensions[2];

  if (chartType === ChartType.STACKED_BAR || chartType === ChartType.GROUPED_BAR) {
    return `${primaryDimension.name} by ${secondaryDimension.name} (Grouped by ${tertiaryDimension.name})`;
  }

  // Generic title for complex charts
  return `Analysis of ${primaryDimension.name}, ${secondaryDimension.name}, and ${
    dimensions.length > 2 ? tertiaryDimension.name : 'Other Factors'
  }`;
}
