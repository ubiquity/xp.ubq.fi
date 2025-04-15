import React, { useEffect, useState } from 'react';
import { loadArtifactData } from '../workers/artifact-worker-manager'; // Use worker manager
import type { LeaderboardEntry, TimeSeriesEntry } from '../data-transform'; // Import specific types
import type { OverviewResult } from '../analytics/contribution-overview';
import type { QualityResult } from '../analytics/comment-quality';
import type { ReviewMetricsResult } from '../analytics/review-metrics';
import type { DataDimension } from '../types/data-types';
import { DataDimensionCategory } from '../types/data-types';
import DimensionSelector from './dimension-selector';
import VisualizationPanel from './visualization-panel';

/**
 */

// Define the structure for the comprehensive data state
type DashboardDataState = {
  leaderboard: LeaderboardEntry[];
  timeSeries: TimeSeriesEntry[];
  overview: OverviewResult | null;
  quality: QualityResult | null;
  reviews: ReviewMetricsResult | null;
  // rawData?: OrgRepoData; // Optionally store raw data if needed elsewhere
};

const Dashboard: React.FC = () => {
  // State for the comprehensive data object
  const [dashboardData, setDashboardData] = useState<DashboardDataState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<{ phase: string; percent: number; detail: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // State for dimensions and selections (remains the same)
  const [availableDimensions, setAvailableDimensions] = useState<DataDimension[]>([]);
  const [selectedDimensions, setSelectedDimensions] = useState<DataDimension[]>([]);
  const [issueFilter, setIssueFilter] = useState<string>(''); // State for issue filter

  // Fetch data using loadArtifactData on component mount
  useEffect(() => {
    // TODO: Get the runId dynamically, perhaps from URL params or a selector
    const runId = 'latest'; // Placeholder

    setIsLoading(true);
    setLoadingProgress({ phase: 'Initializing', percent: 0, detail: 'Starting artifact load...' });
    setError(null);

    loadArtifactData(runId, {
      onProgress: (phase, percent, detail) => {
        setLoadingProgress({ phase, percent, detail });
      },
      onError: (err) => {
        console.error('Error loading artifact data:', err);
        setError(`Failed to load data for run ${runId}: ${err.message}`);
        setIsLoading(false);
        setLoadingProgress(null);
      },
      onComplete: (data) => {
        setDashboardData({
          leaderboard: data.leaderboard,
          timeSeries: data.timeSeries,
          overview: data.overview,
          quality: data.quality,
          reviews: data.reviews,
          // rawData: data.rawData // Optionally store raw data
        });

        // Generate dimensions (needs adjustment based on the new data structure)
        // For now, we might use predefined dimensions or adapt generateDimensionsFromData
        // Let's use the existing generator for now, acknowledging it might not be ideal
        // It expects ActivityData[], so we might pass an empty array or adapt it later.
        // Passing an empty array to avoid errors, dimension generation needs rework.
        setAvailableDimensions(generateDimensionsFromData([])); // Needs rework

        setIsLoading(false);
        setLoadingProgress(null);
        setError(null);
      }
    });

    // Cleanup function if needed (e.g., terminate worker)
    // return () => {
    //   cleanupWorker();
    // };
  }, []); // Run only once on mount

  // Handler for selecting a dimension
  const handleSelectDimension = (dimension: DataDimension) => {
    setSelectedDimensions([...selectedDimensions, dimension]);
  };

  // Handler for removing a dimension
  const handleRemoveDimension = (dimension: DataDimension) => {
    setSelectedDimensions(selectedDimensions.filter(dim => dim.id !== dimension.id));
  };

  // Show loading state with progress
  if (isLoading) {
    return (
      <div className="dashboard loading">
        <h2>Loading Developer Performance Data...</h2>
        {loadingProgress && (
          <div className="loading-progress">
            <progress value={loadingProgress.percent} max="100"></progress>
            <span>{`${loadingProgress.phase}: ${loadingProgress.detail} (${loadingProgress.percent.toFixed(0)}%)`}</span>
          </div>
        )}
        <div className="loading-indicator">Please wait...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="dashboard error">
        <h2>Error Loading Data</h2>
        <div className="error-message">{error}</div>
        {/* Consider a more specific retry mechanism if possible */}
        <button onClick={() => window.location.reload()}>Retry Page Load</button>
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
          {/* Pass the relevant data down. For now, pass the whole object.
              VisualizationPanel will need adaptation. */}
          {dashboardData ? (
            <VisualizationPanel
              data={dashboardData} // Pass the whole structured object
              selectedDimensions={selectedDimensions}
              issueFilter={issueFilter} // Pass filter down
              width={800} // Example width
              height={600} // Example height
            />
          ) : (
            <div className="placeholder">Select data or wait for load.</div> // Placeholder if data not yet loaded
          )}
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
