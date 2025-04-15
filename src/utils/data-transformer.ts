import { get, groupBy, maxBy, meanBy, minBy, sumBy } from 'lodash';
import type { ActivityData, CommentData, DataDimension } from '../types/data-types';

/**
 * Transform ActivityData array based on selected dimensions for visualization
 */
export function transformDataForVisualization(
  data: ActivityData[],
  dimensions: DataDimension[]
): any[] {
  if (!data || data.length === 0 || !dimensions || dimensions.length === 0) {
    return [];
  }

  try {
    // For a single dimension, return simple aggregated data
    if (dimensions.length === 1) {
      return transformForSingleDimension(data, dimensions[0]);
    }

    // For two dimensions, create a 2D dataset
    if (dimensions.length === 2) {
      return transformForTwoDimensions(data, dimensions[0], dimensions[1]);
    }

    // For three or more dimensions, create a complex dataset
    return transformForMultipleDimensions(data, dimensions);
  } catch (error) {
    console.error('Error transforming data for visualization:', error);
    return [];
  }
}

/**
 * Transform data for a single dimension
 */
function transformForSingleDimension(data: ActivityData[], dimension: DataDimension): any[] {
  // Extract data based on dimension's accessor
  let extractedData: any[] = [];

  if (dimension.accessor.startsWith('comments.')) {
    // Handle comment-level data
    data.forEach(activity => {
      activity.comments.forEach(comment => {
        const value = getValueFromAccessor(comment, dimension.accessor.replace('comments.', ''));
        if (value !== undefined) {
          extractedData.push({
            name: dimension.name,
            value,
            // Include additional context
            commentType: comment.type,
            issueId: activity.issue.id,
            author: comment.author
          });
        }
      });
    });
  } else if (dimension.accessor.startsWith('issue.')) {
    // Handle issue-level data
    data.forEach(activity => {
      const value = getValueFromAccessor(activity.issue, dimension.accessor.replace('issue.', ''));
      if (value !== undefined) {
        extractedData.push({
          name: dimension.name,
          value,
          // Include additional context
          issueId: activity.issue.id,
          repository: activity.issue.repository
        });
      }
    });
  } else if (dimension.accessor.startsWith('contributors.')) {
    // Handle contributor-level data
    data.forEach(activity => {
      activity.contributors.forEach(contributor => {
        const value = getValueFromAccessor(
          contributor,
          dimension.accessor.replace('contributors.', '')
        );
        if (value !== undefined) {
          extractedData.push({
            name: dimension.name,
            value,
            // Include additional context
            contributorLogin: contributor.login,
            issueId: activity.issue.id
          });
        }
      });
    });
  } else {
    // Handle activity-level data
    data.forEach(activity => {
      const value = getValueFromAccessor(activity, dimension.accessor);
      if (value !== undefined) {
        extractedData.push({
          name: dimension.name,
          value,
          // Include additional context
          issueId: activity.issue.id,
          timestamp: activity.timestamp
        });
      }
    });
  }

  // Aggregate data based on dimension's dataType and aggregation
  return aggregateData(extractedData, dimension);
}

/**
 * Transform data for two dimensions
 */
function transformForTwoDimensions(
  data: ActivityData[],
  dimension1: DataDimension,
  dimension2: DataDimension
): any[] {
  // Extract data points with both dimensions
  const dataPoints: any[] = [];

  // Process based on the type of data we're dealing with
  if (
    dimension1.accessor.startsWith('comments.') &&
    dimension2.accessor.startsWith('comments.')
  ) {
    // Both dimensions are at the comment level
    data.forEach(activity => {
      activity.comments.forEach(comment => {
        const value1 = getValueFromAccessor(
          comment,
          dimension1.accessor.replace('comments.', '')
        );
        const value2 = getValueFromAccessor(
          comment,
          dimension2.accessor.replace('comments.', '')
        );

        if (value1 !== undefined && value2 !== undefined) {
          dataPoints.push({
            [dimension1.name]: value1,
            [dimension2.name]: value2,
            // Additional context
            commentType: comment.type,
            issueId: activity.issue.id,
            author: comment.author
          });
        }
      });
    });
  } else if (
    dimension1.accessor.startsWith('contributors.') ||
    dimension2.accessor.startsWith('contributors.')
  ) {
    // At least one dimension is at the contributor level
    data.forEach(activity => {
      activity.contributors.forEach(contributor => {
        let value1: any;
        let value2: any;

        if (dimension1.accessor.startsWith('contributors.')) {
          value1 = getValueFromAccessor(
            contributor,
            dimension1.accessor.replace('contributors.', '')
          );
        } else if (dimension1.accessor.startsWith('comments.')) {
          // Get average or sum of comment-related values for this contributor
          const contributorComments = activity.comments.filter(c => c.author === contributor.login);
          value1 = aggregateCommentValues(
            contributorComments,
            dimension1.accessor.replace('comments.', ''),
            dimension1.aggregation || 'sum'
          );
        } else {
          value1 = getValueFromAccessor(activity, dimension1.accessor);
        }

        if (dimension2.accessor.startsWith('contributors.')) {
          value2 = getValueFromAccessor(
            contributor,
            dimension2.accessor.replace('contributors.', '')
          );
        } else if (dimension2.accessor.startsWith('comments.')) {
          // Get average or sum of comment-related values for this contributor
          const contributorComments = activity.comments.filter(c => c.author === contributor.login);
          value2 = aggregateCommentValues(
            contributorComments,
            dimension2.accessor.replace('comments.', ''),
            dimension2.aggregation || 'sum'
          );
        } else {
          value2 = getValueFromAccessor(activity, dimension2.accessor);
        }

        if (value1 !== undefined && value2 !== undefined) {
          dataPoints.push({
            [dimension1.name]: value1,
            [dimension2.name]: value2,
            // Additional context
            contributorLogin: contributor.login,
            issueId: activity.issue.id
          });
        }
      });
    });
  } else {
    // Handle generic case (e.g., issue level, activity level)
    data.forEach(activity => {
      let value1: any;
      let value2: any;

      if (dimension1.accessor.startsWith('comments.')) {
        // Aggregate comment values for this activity
        value1 = aggregateCommentValues(
          activity.comments,
          dimension1.accessor.replace('comments.', ''),
          dimension1.aggregation || 'sum'
        );
      } else if (dimension1.accessor.startsWith('issue.')) {
        value1 = getValueFromAccessor(activity.issue, dimension1.accessor.replace('issue.', ''));
      } else {
        value1 = getValueFromAccessor(activity, dimension1.accessor);
      }

      if (dimension2.accessor.startsWith('comments.')) {
        // Aggregate comment values for this activity
        value2 = aggregateCommentValues(
          activity.comments,
          dimension2.accessor.replace('comments.', ''),
          dimension2.aggregation || 'sum'
        );
      } else if (dimension2.accessor.startsWith('issue.')) {
        value2 = getValueFromAccessor(activity.issue, dimension2.accessor.replace('issue.', ''));
      } else {
        value2 = getValueFromAccessor(activity, dimension2.accessor);
      }

      if (value1 !== undefined && value2 !== undefined) {
        dataPoints.push({
          [dimension1.name]: value1,
          [dimension2.name]: value2,
          // Additional context
          issueId: activity.issue.id,
          repository: activity.issue.repository,
          timestamp: activity.timestamp
        });
      }
    });
  }

  // Aggregate the data points if needed
  if (
    (dimension1.dataType === 'categorical' && dimension2.dataType === 'numerical') ||
    (dimension1.dataType === 'numerical' && dimension2.dataType === 'categorical')
  ) {
    // Aggregate numerical values by categorical dimension
    const categoricalDim =
      dimension1.dataType === 'categorical' ? dimension1 : dimension2;
    const numericalDim =
      dimension1.dataType === 'numerical' ? dimension1 : dimension2;

    return aggregateByCategory(dataPoints, categoricalDim.name, numericalDim.name);
  }

  return dataPoints;
}

/**
 * Transform data for three or more dimensions
 */
function transformForMultipleDimensions(
  data: ActivityData[],
  dimensions: DataDimension[]
): any[] {
  // Extract primary dimensions (first three)
  const primaryDimensions = dimensions.slice(0, 3);

  // Extract data points with all dimensions
  const dataPoints: any[] = [];

  // Process each activity
  data.forEach(activity => {
    // For simplicity in the MVP, focus on activity-level data aggregation
    const point: any = {
      issueId: activity.issue.id,
      repository: activity.issue.repository,
      timestamp: activity.timestamp
    };

    // Extract values for each dimension
    let hasAllDimensions = true;

    for (const dimension of primaryDimensions) {
      let value: any;

      if (dimension.accessor.startsWith('comments.')) {
        // Aggregate comment values for this activity
        value = aggregateCommentValues(
          activity.comments,
          dimension.accessor.replace('comments.', ''),
          dimension.aggregation || 'sum'
        );
      } else if (dimension.accessor.startsWith('issue.')) {
        value = getValueFromAccessor(activity.issue, dimension.accessor.replace('issue.', ''));
      } else if (dimension.accessor.startsWith('contributors.')) {
        // For contributor dimensions, we need a different approach
        // In an MVP, just use the first contributor's value or skip
        if (activity.contributors.length > 0) {
          value = getValueFromAccessor(
            activity.contributors[0],
            dimension.accessor.replace('contributors.', '')
          );
        }
      } else {
        value = getValueFromAccessor(activity, dimension.accessor);
      }

      if (value === undefined) {
        hasAllDimensions = false;
        break;
      }

      point[dimension.name] = value;
    }

    if (hasAllDimensions) {
      dataPoints.push(point);
    }
  });

  // For certain dimension combinations, we might want to aggregate the data
  const categoricalDimensions = primaryDimensions.filter(d => d.dataType === 'categorical');
  const numericalDimensions = primaryDimensions.filter(d => d.dataType === 'numerical');

  // If we have exactly one categorical dimension and other numerical dimensions,
  // we can aggregate by the categorical dimension
  if (categoricalDimensions.length === 1 && numericalDimensions.length >= 1) {
    return aggregateMultiDimensionalData(
      dataPoints,
      categoricalDimensions[0].name,
      numericalDimensions.map(d => d.name)
    );
  }

  return dataPoints;
}

/**
 * Get a value from an object using a dot-notation accessor
 */
function getValueFromAccessor(obj: any, accessor: string): any {
  return get(obj, accessor);
}

/**
 * Aggregate data based on dimension properties
 */
function aggregateData(data: any[], dimension: DataDimension): any[] {
  if (dimension.dataType === 'categorical') {
    // Group by value and count occurrences
    const grouped = groupBy(data, 'value');
    return Object.entries(grouped).map(([value, items]) => ({
      name: value,
      value: items.length,
      // Include additional context
      items
    }));
  } else if (dimension.dataType === 'numerical') {
    // For numerical data, create a distribution or summary
    return data;
  } else if (dimension.dataType === 'temporal') {
    // Group by time periods (day, week, month)
    // For MVP, just return the raw data
    return data;
  }

  return data;
}

/**
 * Aggregate values from comments based on specified aggregation method
 */
function aggregateCommentValues(
  comments: CommentData[],
  accessor: string,
  aggregation: string
): any {
  if (!comments || comments.length === 0) {
    return undefined;
  }

  // Extract values from comments
  const values = comments
    .map(comment => getValueFromAccessor(comment, accessor))
    .filter(value => value !== undefined);

  if (values.length === 0) {
    return undefined;
  }

  // Apply aggregation
  switch (aggregation) {
    case 'sum':
      return values.reduce((acc, val) => acc + val, 0);
    case 'average':
      return values.reduce((acc, val) => acc + val, 0) / values.length;
    case 'count':
      return values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    default:
      return values;
  }
}

/**
 * Aggregate numerical values by categorical dimension
 */
function aggregateByCategory(
  data: any[],
  categoryField: string,
  valueField: string
): any[] {
  const grouped = groupBy(data, categoryField);

  return Object.entries(grouped).map(([category, items]) => {
    const aggregated: any = {
      [categoryField]: category,
      [`${valueField}_sum`]: sumBy(items, valueField),
      [`${valueField}_avg`]: meanBy(items, valueField),
      [`${valueField}_count`]: items.length,
      // Default to sum for the main value
      [valueField]: sumBy(items, valueField)
    };

    // Add min/max if we have more than one item
    if (items.length > 1) {
      aggregated[`${valueField}_min`] = minBy(items, valueField)[valueField];
      aggregated[`${valueField}_max`] = maxBy(items, valueField)[valueField];
    }

    return aggregated;
  });
}

/**
 * Aggregate multi-dimensional data by a categorical field
 */
function aggregateMultiDimensionalData(
  data: any[],
  categoryField: string,
  valueFields: string[]
): any[] {
  const grouped = groupBy(data, categoryField);

  return Object.entries(grouped).map(([category, items]) => {
    const result: any = {
      [categoryField]: category,
      count: items.length
    };

    // Aggregate each value field
    valueFields.forEach(field => {
      result[`${field}_sum`] = sumBy(items, field);
      result[`${field}_avg`] = meanBy(items, field);
      // Default to sum
      result[field] = sumBy(items, field);

      // Add min/max if we have more than one item
      if (items.length > 1) {
        result[`${field}_min`] = minBy(items, field)[field];
        result[`${field}_max`] = maxBy(items, field)[field];
      }
    });

    return result;
  });
}
