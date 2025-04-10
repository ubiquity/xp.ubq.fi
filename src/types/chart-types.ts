import type { DataDimension } from './data-types';

export enum ChartType {
  BAR = 'BAR',
  LINE = 'LINE',
  AREA = 'AREA',
  PIE = 'PIE',
  SCATTER = 'SCATTER',
  STACKED_BAR = 'STACKED_BAR',
  GROUPED_BAR = 'GROUPED_BAR',
  HEATMAP = 'HEATMAP',
  RADAR = 'RADAR',
  TABLE = 'TABLE',
}

export interface ChartConfig {
  type: ChartType;
  title: string;
  description?: string;
  dimensions: {
    x?: DataDimension;
    y?: DataDimension;
    z?: DataDimension; // For 3D charts or additional dimension like size, color, etc.
    category?: DataDimension; // For grouping data
    series?: DataDimension[]; // For multiple series
  };
  options?: {
    [key: string]: any;
  };
}

export interface ChartTypeRecommendation {
  primaryRecommendation: ChartType;
  alternativeRecommendations: ChartType[];
  reason: string;
}
