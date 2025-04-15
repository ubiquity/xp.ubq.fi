import React, { useEffect, useState, useMemo } from 'react'; // Add useMemo
import { fetchActivityData } from '../api/activity-data-service';
import type { DataDimension } from '../types/data-types';
import { DataDimensionCategory } from '../types/data-types';
import DimensionSelector from './dimension-selector';
import VisualizationPanel from './visualization-panel';

/**
 * Main dashboard component that integrates all the pieces together
 */
const Dashboard: React.FC = () => {
  // State for data and loading
  const [activityData, setActivityData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // State for dimensions and selections
  const [availableDimensions, setAvailableDimensions] = useState<DataDimension[]>([]);
  const [selectedDimensions, setSelectedDimensions] = useState<DataDimension[]>([]);
  const [issueFilter, setIssueFilter] = useState<string>(''); // State for issue filter

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const data = await fetchActivityData();
        setActivityData(data);

        // Generate available dimensions from the data
        if (data.length > 0) {
          setAvailableDimensions(generateDimensionsFromData(data));
        }

        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load activity data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handler for selecting a dimension
  const handleSelectDimension = (dimension: DataDimension) => {
    setSelectedDimensions([...selectedDimensions, dimension]);
  };

  // Handler for removing a dimension
  const handleRemoveDimension = (dimension: DataDimension) => {
    setSelectedDimensions(selectedDimensions.filter(dim => dim.id !== dimension.id));
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="dashboard loading">
        <h2>Loading Developer Performance Dashboard...</h2>
        <div className="loading-indicator">Loading...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="dashboard error">
        <h2>Error</h2>
        <div className="error-message">{error}</div>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Developer Performance Analytics Dashboard</h1>
      </header>

      <main className="dashboard-content">
        <div className="dashboard-sidebar">
          <DimensionSelector
            availableDimensions={availableDimensions}
            selectedDimensions={selectedDimensions}
            onSelectDimension={handleSelectDimension}
            onRemoveDimension={handleRemoveDimension}
            maxSelections={3}
          />
          {/* Add Issue Filter Input */}
          <div className="dashboard-filter">
            <label htmlFor="issue-filter">Filter by Issue #:</label>
            <input
              type="text"
              id="issue-filter"
              value={issueFilter}
              onChange={(e) => setIssueFilter(e.target.value)}
              placeholder="e.g., 249"
            />
          </div>
        </div>

        <div className="dashboard-main">
          <VisualizationPanel
            data={activityData} // Pass original data for now, filtering will happen downstream
            selectedDimensions={selectedDimensions}
            width={800}
            height={500}
          />
        </div>
      </main>
    </div>
  );
};

/**
 * Helper function to generate dimensions from activity data
 */
function generateDimensionsFromData(data: any[]): DataDimension[] {
  // For the MVP, we'll define some sample dimensions
  // In a real implementation, this would analyze the data structure more thoroughly

  const dimensions: DataDimension[] = [
    // Comment-related dimensions
    {
      id: 'comment-type',
      name: 'Comment Type',
      category: DataDimensionCategory.COMMENT_TYPE,
      accessor: 'comments.type',
      dataType: 'categorical'
    },
    {
      id: 'word-count',
      name: 'Word Count',
      category: DataDimensionCategory.QUALITY_METRIC,
      accessor: 'comments.quality.wordCount',
      dataType: 'numerical',
      aggregation: 'average'
    },
    {
      id: 'readability-score',
      name: 'Readability Score',
      category: DataDimensionCategory.QUALITY_METRIC,
      accessor: 'comments.quality.readabilityScore',
      dataType: 'numerical',
      aggregation: 'average'
    },
    {
      id: 'relevance-score',
      name: 'Relevance Score',
      category: DataDimensionCategory.QUALITY_METRIC,
      accessor: 'comments.quality.relevanceScore',
      dataType: 'numerical',
      aggregation: 'average'
    },

    // Review-related dimensions
    {
      id: 'lines-reviewed',
      name: 'Lines Reviewed',
      category: DataDimensionCategory.REVIEW_STATISTIC,
      accessor: 'reviews.linesReviewed',
      dataType: 'numerical',
      aggregation: 'sum'
    },
    {
      id: 'review-state',
      name: 'Review State',
      category: DataDimensionCategory.REVIEW_STATISTIC,
      accessor: 'reviews.reviewState',
      dataType: 'categorical'
    },
    {
      id: 'review-time',
      name: 'Review Time (min)',
      category: DataDimensionCategory.REVIEW_STATISTIC,
      accessor: 'reviews.timeToReview',
      dataType: 'numerical',
      aggregation: 'average'
    },

    // HTML entity dimensions
    {
      id: 'code-snippets',
      name: 'Code Snippets',
      category: DataDimensionCategory.HTML_ENTITY,
      accessor: 'comments.htmlEntities.codeSnippets',
      dataType: 'numerical',
      aggregation: 'sum'
    },
    {
      id: 'images',
      name: 'Images',
      category: DataDimensionCategory.HTML_ENTITY,
      accessor: 'comments.htmlEntities.images',
      dataType: 'numerical',
      aggregation: 'sum'
    },
    {
      id: 'links',
      name: 'Links',
      category: DataDimensionCategory.HTML_ENTITY,
      accessor: 'comments.htmlEntities.links',
      dataType: 'numerical',
      aggregation: 'sum'
    },

    // Contributor dimensions
    {
      id: 'contributor',
      name: 'Contributor',
      category: DataDimensionCategory.CONTRIBUTOR,
      accessor: 'contributors.login',
      dataType: 'categorical'
    },
    {
      id: 'contribution-count',
      name: 'Contribution Count',
      category: DataDimensionCategory.CONTRIBUTOR,
      accessor: 'contributors.contributions',
      dataType: 'numerical',
      aggregation: 'sum'
    },

    // Issue/PR dimensions
    {
      id: 'repository',
      name: 'Repository',
      category: DataDimensionCategory.REPOSITORY,
      accessor: 'issue.repository',
      dataType: 'categorical'
    },
    {
      id: 'issue-state',
      name: 'Issue State',
      category: DataDimensionCategory.GITHUB_EVENT,
      accessor: 'issue.state',
      dataType: 'categorical'
    },
    {
      id: 'issue-created',
      name: 'Issue Created Date',
      category: DataDimensionCategory.TIME,
      accessor: 'issue.createdAt',
      dataType: 'temporal'
    },
    {
      id: 'activity-timestamp',
      name: 'Activity Timestamp',
      category: DataDimensionCategory.TIME,
      accessor: 'timestamp',
      dataType: 'temporal'
    }
  ];

  return dimensions;
}

export default Dashboard;
