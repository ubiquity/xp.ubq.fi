import type { BreakdownResult, ContributionBreakdown } from "../analytics/contribution-breakdown";
import type { QualityResult, CommentQualityMetrics } from "../analytics/comment-quality";
import type { ReviewMetricsResult, ReviewMetrics } from "../analytics/review-metrics";
import type { LeaderboardEntry } from "../data-transform"; // To get user IDs

interface InsightsViewProps {
  breakdownData: BreakdownResult;
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
  breakdownData,
  qualityData,
  reviewData,
  leaderboardData,
  selectedContributor,
}: InsightsViewProps): HTMLElement {
  const container = document.createElement("div");
  container.className = "insights-view";

  // --- State for Sorting (Consolidated View Only) ---
  let breakdownSort: SortConfig = { key: 'contributor', dir: 'asc' };
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
        tableData: BreakdownResult | QualityResult | ReviewMetricsResult
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
            // For breakdown category XP, we need to calculate the sum before sorting
            if (key === 'breakdownXpSum') {
                 valA = (dataA as ContributionBreakdown) ?
                    ((dataA as ContributionBreakdown).tasksXp ?? 0) +
                    ((dataA as ContributionBreakdown).issueSpecificationsXp ?? 0) +
                    ((dataA as ContributionBreakdown).pullSpecificationsXp ?? 0) +
                    ((dataA as ContributionBreakdown).issueCommentsXp ?? 0) +
                    ((dataA as ContributionBreakdown).pullCommentsXp ?? 0) : undefined;
                 valB = (dataB as ContributionBreakdown) ?
                    ((dataB as ContributionBreakdown).tasksXp ?? 0) +
                    ((dataB as ContributionBreakdown).issueSpecificationsXp ?? 0) +
                    ((dataB as ContributionBreakdown).pullSpecificationsXp ?? 0) +
                    ((dataB as ContributionBreakdown).issueCommentsXp ?? 0) +
                    ((dataB as ContributionBreakdown).pullCommentsXp ?? 0) : undefined;
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
      const createHeader = (text: string, key: string, sortState: SortConfig, tableType: 'breakdown' | 'quality' | 'reviews'): HTMLTableCellElement => {
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
          if (tableType === 'breakdown') breakdownSort = { key, dir: newDir };
          else if (tableType === 'quality') qualitySort = { key, dir: newDir };
          else if (tableType === 'reviews') reviewsSort = { key, dir: newDir };
          renderInsights(); // Re-render
        };
        return th;
      };

      // --- Create and Populate Breakdown Table ---
      const breakdownTable = document.createElement("table");
      breakdownTable.className = "insights-table consolidated";
      breakdownTable.createCaption().textContent = "Contribution Breakdown";
      const breakdownHead = breakdownTable.createTHead().insertRow();
      breakdownHead.appendChild(createHeader('Contributor', 'contributor', breakdownSort, 'breakdown'));
      breakdownHead.appendChild(createHeader('Tasks', 'tasksAssigned', breakdownSort, 'breakdown'));
      breakdownHead.appendChild(createHeader('Issue Specs', 'issueSpecifications', breakdownSort, 'breakdown'));
      breakdownHead.appendChild(createHeader('PR Specs', 'pullSpecifications', breakdownSort, 'breakdown'));
      breakdownHead.appendChild(createHeader('Issue Comments', 'issueComments', breakdownSort, 'breakdown'));
      breakdownHead.appendChild(createHeader('PR Comments', 'pullComments', breakdownSort, 'breakdown'));
      breakdownHead.appendChild(createHeader('Reviews', 'reviewsConducted', breakdownSort, 'breakdown'));
      // Use a calculated key for sorting the summed XP
      breakdownHead.appendChild(createHeader('Breakdown XP', 'breakdownXpSum', breakdownSort, 'breakdown'));
      const breakdownBody = breakdownTable.createTBody();
      const sortedBreakdownContributors = sortContributors(baseContributors, breakdownSort, breakdownData);
      sortedBreakdownContributors.forEach(contributor => {
        const breakdown = breakdownData[contributor];
        const row = breakdownBody.insertRow();
        const categoryXp = (breakdown?.tasksXp ?? 0) +
                           (breakdown?.issueSpecificationsXp ?? 0) +
                           (breakdown?.pullSpecificationsXp ?? 0) +
                           (breakdown?.issueCommentsXp ?? 0) +
                           (breakdown?.pullCommentsXp ?? 0);
        row.innerHTML = `
          <td>${contributor}</td>
          <td>${formatInt(breakdown?.tasksAssigned)}</td>
          <td>${formatInt(breakdown?.issueSpecifications)}</td>
          <td>${formatInt(breakdown?.pullSpecifications)}</td>
          <td>${formatInt(breakdown?.issueComments)}</td>
          <td>${formatInt(breakdown?.pullComments)}</td>
          <td>${formatInt(breakdown?.reviewsConducted)}</td>
          <td>${formatNum(categoryXp)}</td>
        `;
      });
      container.appendChild(breakdownTable);

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
      reviewHead.appendChild(createHeader('Review XP', 'totalReviewReward', reviewsSort, 'reviews')); // Changed header, key is correct
      reviewHead.appendChild(createHeader('Avg Reward', 'averageReviewReward', reviewsSort, 'reviews'));
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
          <td>${formatNum(reviews?.averageReviewReward)}</td>
        `;
      });
      container.appendChild(reviewTable);

    } else {
      // --- Individual Contributor View (No changes needed here) ---
      const contributor = selectedContributor;
      const breakdown = breakdownData[contributor];
      const quality = qualityData[contributor];
      const reviews = reviewData[contributor];

      if (!breakdown && !quality && !reviews) {
          container.textContent = `No detailed insights available for ${contributor}.`;
          return container;
      }

      const contributorContainer = document.createElement("div");
      contributorContainer.className = "contributor-insights";

      const title = document.createElement("h3");
      title.textContent = contributor;
      contributorContainer.appendChild(title);

      // Breakdown Table (Individual)
      if (breakdown) {
        const breakdownTable = document.createElement("table");
        breakdownTable.className = "insights-table";
        const breakdownCaption = breakdownTable.createCaption();
        breakdownCaption.textContent = "Contribution Breakdown";
        const breakdownBody = breakdownTable.createTBody();
        // Add category XP here too? Maybe later.
        breakdownBody.innerHTML = `
          <tr><td>Tasks Assigned</td><td>${breakdown.tasksAssigned} (${formatNum(breakdown.tasksXp)} XP)</td></tr>
          <tr><td>Issue Specs</td><td>${breakdown.issueSpecifications} (${formatNum(breakdown.issueSpecificationsXp)} XP)</td></tr>
          <tr><td>PR Specs</td><td>${breakdown.pullSpecifications} (${formatNum(breakdown.pullSpecificationsXp)} XP)</td></tr>
          <tr><td>Issue Comments</td><td>${breakdown.issueComments} (${formatNum(breakdown.issueCommentsXp)} XP)</td></tr>
          <tr><td>PR Comments</td><td>${breakdown.pullComments} (${formatNum(breakdown.pullCommentsXp)} XP)</td></tr>
          <tr><td>Reviews Conducted</td><td>${breakdown.reviewsConducted}</td></tr>
        `;
        contributorContainer.appendChild(breakdownTable);
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
          <tr><td>Avg Review Reward</td><td>${formatNum(reviews.averageReviewReward)}</td></tr>
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
