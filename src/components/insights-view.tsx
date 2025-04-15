import type { BreakdownResult } from "../analytics/contribution-breakdown";
import type { QualityResult } from "../analytics/comment-quality";
import type { ReviewMetricsResult } from "../analytics/review-metrics";
import type { LeaderboardEntry } from "../data-transform"; // To get user IDs

interface InsightsViewProps {
  breakdownData: BreakdownResult;
  qualityData: QualityResult;
  reviewData: ReviewMetricsResult;
  leaderboardData: LeaderboardEntry[]; // Needed to map contributors to user IDs if necessary
  selectedContributor: string; // "All" or a specific contributor
}

// Helper to format numbers to 2 decimal places
const formatNum = (num: number): string => num.toFixed(2);

export function InsightsView({
  breakdownData,
  qualityData,
  reviewData,
  leaderboardData,
  selectedContributor,
}: InsightsViewProps): HTMLElement {
  const container = document.createElement("div");
  container.className = "insights-view"; // Add class for styling

  const contributors =
    selectedContributor === "All"
      ? leaderboardData.sort((a, b) => b.totalXP - a.totalXP).map(e => e.contributor) // Sort by overall XP if showing all
      : [selectedContributor];

  if (contributors.length === 0) {
    container.textContent = "No contributor data available for insights.";
    return container;
  }

  contributors.forEach((contributor) => {
    const breakdown = breakdownData[contributor];
    const quality = qualityData[contributor];
    const reviews = reviewData[contributor];

    const contributorContainer = document.createElement("div");
    contributorContainer.className = "contributor-insights";

    const title = document.createElement("h3");
    title.textContent = contributor;
    contributorContainer.appendChild(title);

    // --- Breakdown Table ---
    if (breakdown) {
      const breakdownTable = document.createElement("table");
      breakdownTable.className = "insights-table";
      const breakdownCaption = breakdownTable.createCaption();
      breakdownCaption.textContent = "Contribution Breakdown";
      const breakdownBody = breakdownTable.createTBody();
      breakdownBody.innerHTML = `
        <tr><td>Tasks Assigned</td><td>${breakdown.tasksAssigned}</td></tr>
        <tr><td>Issue Specs</td><td>${breakdown.issueSpecifications}</td></tr>
        <tr><td>PR Specs</td><td>${breakdown.pullSpecifications}</td></tr>
        <tr><td>Issue Comments</td><td>${breakdown.issueComments}</td></tr>
        <tr><td>PR Comments</td><td>${breakdown.pullComments}</td></tr>
        <tr><td>Reviews Conducted</td><td>${breakdown.reviewsConducted}</td></tr>
      `;
      contributorContainer.appendChild(breakdownTable);
    }

    // --- Quality Table ---
    if (quality) {
      const qualityTable = document.createElement("table");
      qualityTable.className = "insights-table";
      const qualityCaption = qualityTable.createCaption();
      qualityCaption.textContent = `Comment Quality (Avg over ${quality.commentCount} comments)`;
      const qualityBody = qualityTable.createTBody();
      qualityBody.innerHTML = `
        <tr><td>Avg Formatting</td><td>${formatNum(quality.averageFormattingScore)}</td></tr>
        <tr><td>Avg Readability</td><td>${formatNum(quality.averageReadabilityScore)}</td></tr>
        <tr><td>Avg Relevance</td><td>${formatNum(quality.averageRelevanceScore)}</td></tr>
      `;
      contributorContainer.appendChild(qualityTable);
    }

    // --- Review Metrics Table ---
    if (reviews) {
      const reviewTable = document.createElement("table");
      reviewTable.className = "insights-table";
      const reviewCaption = reviewTable.createCaption();
      reviewCaption.textContent = `Review Metrics (${reviews.pullsReviewedCount} PRs)`;
      const reviewBody = reviewTable.createTBody();
      reviewBody.innerHTML = `
        <tr><td>Total Reviews</td><td>${reviews.totalReviewsConducted}</td></tr>
        <tr><td>Total Lines Added</td><td>${reviews.totalLinesAddedReviewed}</td></tr>
        <tr><td>Total Lines Deleted</td><td>${reviews.totalLinesDeletedReviewed}</td></tr>
        <tr><td>Total Review Reward</td><td>${formatNum(reviews.totalReviewReward)}</td></tr>
        <tr><td>Avg Review Reward</td><td>${formatNum(reviews.averageReviewReward)}</td></tr>
      `;
      contributorContainer.appendChild(reviewTable);
    }

     // Add separator if showing multiple contributors
     if (selectedContributor === "All" && contributors.length > 1) {
        const separator = document.createElement("hr");
        separator.className = "contributor-separator";
        contributorContainer.appendChild(separator);
    }


    container.appendChild(contributorContainer);
  });

  return container;
}
