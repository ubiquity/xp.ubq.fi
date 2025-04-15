import type { OverviewResult, ContributionOverview } from "../analytics/contribution-overview";
import type { QualityResult, CommentQualityMetrics } from "../analytics/comment-quality";
import type { ReviewMetricsResult, ReviewMetrics } from "../analytics/review-metrics";
import type { LeaderboardEntry } from "../data-transform"; // To get user IDs

interface InsightsViewProps {
  overviewData: OverviewResult;
  qualityData: QualityResult;
  reviewData: ReviewMetricsResult;
  leaderboardData: LeaderboardEntry[]; // Still needed for the initial contributor list
  selectedContributor: string; // "All" or a specific contributor
}

// Helper to format numbers to 2 decimal places or return 'N/A'
const formatNum = (num: number | undefined): string => (typeof num === 'number' ? num.toFixed(2) : 'N/A');
const formatInt = (num: number | undefined): string => (typeof num === 'number' ? num.toString() : 'N/A');

type SortDirection = 'asc' | 'desc';
// Include category XP keys in SortConfig key type if needed for strong typing,
// but using string for simplicity with dynamic access.
type SortConfig = { key: string; dir: SortDirection };

export function InsightsView({
  overviewData,
  qualityData,
  reviewData,
  leaderboardData,
  selectedContributor,
}: InsightsViewProps): HTMLElement {
  const container = document.createElement("div");
  container.className = "insights-view";

  // --- State for Sorting (Consolidated View Only) ---
  let overviewSort: SortConfig = { key: 'contributor', dir: 'asc' };
  let qualitySort: SortConfig = { key: 'contributor', dir: 'asc' };
  let reviewsSort: SortConfig = { key: 'contributor', dir: 'asc' };

  // --- Get Base Contributor List ---
  // Sort initially by overall totalXP descending for the base list
  const baseContributors = leaderboardData.sort((a, b) => b.totalXP - a.totalXP).map(e => e.contributor);

  if (baseContributors.length === 0) {
    container.textContent = "No contributor data available for insights.";
    return container;
  }

  // --- Render Function (handles both views) ---
  function renderInsights() {
    container.innerHTML = ''; // Clear previous content

    // --- Consolidated View ("All" selected) ---
    if (selectedContributor === "All") {
      // --- Sorting Logic ---
      // Now sorts based on the specific table's data object
      const sortContributors = (
        contributors: string[],
        sortConfig: SortConfig,
        tableData: OverviewResult | QualityResult | ReviewMetricsResult
      ): string[] => {
        const { key, dir } = sortConfig;
        return [...contributors].sort((a, b) => {
          let valA: string | number | undefined;
          let valB: string | number | undefined;

          if (key === 'contributor') {
            valA = a;
            valB = b;
          } else {
            // Safely access the property using the key from the specific table data
            const dataA = tableData[a];
            const dataB = tableData[b];
            // Use type assertion carefully, assuming key is valid for the given tableData type
            // For overview category XP, we need to calculate the sum before sorting
            if (key === 'overviewXpSum') {
                 valA = (dataA as ContributionOverview) ?
                    ((dataA as ContributionOverview).tasksXp ?? 0) +
                    ((dataA as ContributionOverview).issueSpecificationsXp ?? 0) +
                    ((dataA as ContributionOverview).pullSpecificationsXp ?? 0) +
                    ((dataA as ContributionOverview).issueCommentsXp ?? 0) +
                    ((dataA as ContributionOverview).pullCommentsXp ?? 0) : undefined;
                 valB = (dataB as ContributionOverview) ?
                    ((dataB as ContributionOverview).tasksXp ?? 0) +
                    ((dataB as ContributionOverview).issueSpecificationsXp ?? 0) +
                    ((dataB as ContributionOverview).pullSpecificationsXp ?? 0) +
                    ((dataB as ContributionOverview).issueCommentsXp ?? 0) +
                    ((dataB as ContributionOverview).pullCommentsXp ?? 0) : undefined;
            } else {
                valA = dataA ? (dataA as any)[key] : undefined;
                valB = dataB ? (dataB as any)[key] : undefined;
            }
          }

          // Handle missing data - sort undefined/null to the bottom
          if (valA === undefined || valA === null) return dir === 'asc' ? 1 : -1;
          if (valB === undefined || valB === null) return dir === 'asc' ? -1 : 1;

          // Handle different types
          if (typeof valA === 'string' && typeof valB === 'string') {
            return dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          if (typeof valA === 'number' && typeof valB === 'number') {
            return dir === 'asc' ? valA - valB : valB - valA;
          }
          // Fallback for mixed types or other types (sorts numbers before strings)
          return dir === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
        });
      };

      // --- Helper to create sortable headers ---
      const createHeader = (text: string, key: string, sortState: SortConfig, tableType: 'overview' | 'quality' | 'reviews'): HTMLTableCellElement => {
        const th = document.createElement('th');
        th.textContent = text;
        th.dataset.sortKey = key;
        th.style.cursor = 'pointer';
        if (sortState.key === key) {
          th.textContent += sortState.dir === 'asc' ? ' ▲' : ' ▼';
          th.classList.add('sorted');
        }
        th.onclick = () => {
          let newDir: SortDirection = 'asc';
          if (sortState.key === key && sortState.dir === 'asc') {
            newDir = 'desc';
          }
          // Update the correct sort state
          if (tableType === 'overview') overviewSort = { key, dir: newDir };
          else if (tableType === 'quality') qualitySort = { key, dir: newDir };
          else if (tableType === 'reviews') reviewsSort = { key, dir: newDir };
          renderInsights(); // Re-render
        };
        return th;
      };

      // --- Create and Populate Overview Table ---
      const overviewTable = document.createElement("table");
      overviewTable.className = "insights-table consolidated";
      overviewTable.createCaption().textContent = "Contribution Overview";
      const overviewHead = overviewTable.createTHead().insertRow();
      overviewHead.appendChild(createHeader('Contributor', 'contributor', overviewSort, 'overview'));
      overviewHead.appendChild(createHeader('Tasks', 'tasksAssigned', overviewSort, 'overview'));
      overviewHead.appendChild(createHeader('Issue Specs', 'issueSpecifications', overviewSort, 'overview'));
      overviewHead.appendChild(createHeader('PR Specs', 'pullSpecifications', overviewSort, 'overview'));
      overviewHead.appendChild(createHeader('Issue Comments', 'issueComments', overviewSort, 'overview'));
      overviewHead.appendChild(createHeader('PR Comments', 'pullComments', overviewSort, 'overview'));
      overviewHead.appendChild(createHeader('Reviews', 'reviewsConducted', overviewSort, 'overview'));
      // Use a calculated key for sorting the summed XP
      overviewHead.appendChild(createHeader('Overview XP', 'overviewXpSum', overviewSort, 'overview'));
      const overviewBody = overviewTable.createTBody();
      const sortedOverviewContributors = sortContributors(baseContributors, overviewSort, overviewData);
      sortedOverviewContributors.forEach(contributor => {
        const overview = overviewData[contributor];
        const row = overviewBody.insertRow();
        const categoryXp = (overview?.tasksXp ?? 0) +
                           (overview?.issueSpecificationsXp ?? 0) +
                           (overview?.pullSpecificationsXp ?? 0) +
                           (overview?.issueCommentsXp ?? 0) +
                           (overview?.pullCommentsXp ?? 0);
        row.innerHTML = `
          <td>${contributor}</td>
          <td>${formatInt(overview?.tasksAssigned)}</td>
          <td>${formatInt(overview?.issueSpecifications)}</td>
          <td>${formatInt(overview?.pullSpecifications)}</td>
          <td>${formatInt(overview?.issueComments)}</td>
          <td>${formatInt(overview?.pullComments)}</td>
          <td>${formatInt(overview?.reviewsConducted)}</td>
          <td>${formatNum(categoryXp)}</td>
        `;
      });
      container.appendChild(overviewTable);

      // --- Create and Populate Quality Table ---
      const qualityTable = document.createElement("table");
      qualityTable.className = "insights-table consolidated";
      qualityTable.createCaption().textContent = "Comment Quality (Average)";
      const qualityHead = qualityTable.createTHead().insertRow();
      qualityHead.appendChild(createHeader('Contributor', 'contributor', qualitySort, 'quality'));
      qualityHead.appendChild(createHeader('Comments', 'commentCount', qualitySort, 'quality'));
      qualityHead.appendChild(createHeader('Formatting', 'averageFormattingScore', qualitySort, 'quality'));
      qualityHead.appendChild(createHeader('Readability', 'averageReadabilityScore', qualitySort, 'quality'));
      qualityHead.appendChild(createHeader('Relevance', 'averageRelevanceScore', qualitySort, 'quality'));
      qualityHead.appendChild(createHeader('Comment XP', 'totalCommentXp', qualitySort, 'quality')); // Use specific category XP key
      const qualityBody = qualityTable.createTBody();
      const sortedQualityContributors = sortContributors(baseContributors, qualitySort, qualityData);
      sortedQualityContributors.forEach(contributor => {
        const quality = qualityData[contributor];
        const row = qualityBody.insertRow();
        row.innerHTML = `
          <td>${contributor}</td>
          <td>${formatInt(quality?.commentCount)}</td>
          <td>${formatNum(quality?.averageFormattingScore)}</td>
          <td>${formatNum(quality?.averageReadabilityScore)}</td>
          <td>${formatNum(quality?.averageRelevanceScore)}</td>
          <td>${formatNum(quality?.totalCommentXp)}</td>
        `;
      });
      container.appendChild(qualityTable);

      // --- Create and Populate Review Table ---
      const reviewTable = document.createElement("table");
      reviewTable.className = "insights-table consolidated";
      reviewTable.createCaption().textContent = "Review Metrics";
      const reviewHead = reviewTable.createTHead().insertRow();
      reviewHead.appendChild(createHeader('Contributor', 'contributor', reviewsSort, 'reviews'));
      reviewHead.appendChild(createHeader('PRs Rev.', 'pullsReviewedCount', reviewsSort, 'reviews'));
      reviewHead.appendChild(createHeader('Total Revs.', 'totalReviewsConducted', reviewsSort, 'reviews'));
      reviewHead.appendChild(createHeader('Lines Reviewed', 'totalLinesReviewed', reviewsSort, 'reviews'));
      reviewHead.appendChild(createHeader('Review XP', 'totalReviewReward', reviewsSort, 'reviews')); // Changed header, key is correct for category total
      // Removed Avg Reward header
      const reviewBody = reviewTable.createTBody();
      const sortedReviewContributors = sortContributors(baseContributors, reviewsSort, reviewData);
      sortedReviewContributors.forEach(contributor => {
        const reviews = reviewData[contributor];
        const row = reviewBody.insertRow();
        row.innerHTML = `
          <td>${contributor}</td>
          <td>${formatInt(reviews?.pullsReviewedCount)}</td>
          <td>${formatInt(reviews?.totalReviewsConducted)}</td>
          <td>${formatInt(reviews?.totalLinesReviewed)}</td>
          <td>${formatNum(reviews?.totalReviewReward)}</td>
        `;
      });
      container.appendChild(reviewTable);

    } else {
      // --- Individual Contributor View (No changes needed here) ---
      const contributor = selectedContributor;
      const overview = overviewData[contributor];
      const quality = qualityData[contributor];
      const reviews = reviewData[contributor];

      if (!overview && !quality && !reviews) {
          container.textContent = `No detailed insights available for ${contributor}.`;
          return container;
      }

      const contributorContainer = document.createElement("div");
      contributorContainer.className = "contributor-insights";

      const title = document.createElement("h3");
      title.textContent = contributor;
      contributorContainer.appendChild(title);

      // Overview Table (Individual)
      if (overview) {
        const overviewTable = document.createElement("table");
        overviewTable.className = "insights-table";
        const overviewCaption = overviewTable.createCaption();
        overviewCaption.textContent = "Contribution Overview";
        const overviewBody = overviewTable.createTBody();
        // Add category XP here too? Maybe later.
        overviewBody.innerHTML = `
          <tr><td>Tasks Assigned</td><td>${overview.tasksAssigned} (${formatNum(overview.tasksXp)} XP)</td></tr>
          <tr><td>Issue Specs</td><td>${overview.issueSpecifications} (${formatNum(overview.issueSpecificationsXp)} XP)</td></tr>
          <tr><td>PR Specs</td><td>${overview.pullSpecifications} (${formatNum(overview.pullSpecificationsXp)} XP)</td></tr>
          <tr><td>Issue Comments</td><td>${overview.issueComments} (${formatNum(overview.issueCommentsXp)} XP)</td></tr>
          <tr><td>PR Comments</td><td>${overview.pullComments} (${formatNum(overview.pullCommentsXp)} XP)</td></tr>
          <tr><td>Reviews Conducted</td><td>${overview.reviewsConducted}</td></tr>
        `;
        contributorContainer.appendChild(overviewTable);
      }

      // Quality Table (Individual)
      if (quality) {
        const qualityTable = document.createElement("table");
        qualityTable.className = "insights-table";
        const qualityCaption = qualityTable.createCaption();
        qualityCaption.textContent = `Comment Quality (Avg over ${quality.commentCount} comments, ${formatNum(quality.totalCommentXp)} XP)`;
        const qualityBody = qualityTable.createTBody();
        qualityBody.innerHTML = `
          <tr><td>Avg Formatting</td><td>${formatNum(quality.averageFormattingScore)}</td></tr>
          <tr><td>Avg Readability</td><td>${formatNum(quality.averageReadabilityScore)}</td></tr>
          <tr><td>Avg Relevance</td><td>${formatNum(quality.averageRelevanceScore)}</td></tr>
        `;
        contributorContainer.appendChild(qualityTable);
      }

      // Review Metrics Table (Individual)
      if (reviews) {
        const reviewTable = document.createElement("table");
        reviewTable.className = "insights-table";
        const reviewCaption = reviewTable.createCaption();
        reviewCaption.textContent = `Review Metrics (${reviews.pullsReviewedCount} PRs, ${formatNum(reviews.totalReviewReward)} XP)`;
        const reviewBody = reviewTable.createTBody();
      reviewBody.innerHTML = `
        <tr><td>Total Reviews</td><td>${reviews.totalReviewsConducted}</td></tr>
        <tr><td>Lines Reviewed</td><td>${reviews.totalLinesReviewed}</td></tr>
        {/* Removed Avg Review Reward row for consistency */}
      `;
      contributorContainer.appendChild(reviewTable);
      }
        container.appendChild(contributorContainer);
    }
  }

  // Initial render
  renderInsights();

  return container;
}
