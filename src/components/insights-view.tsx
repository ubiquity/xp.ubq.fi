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
  container.className = "insights-view";

  const contributors = leaderboardData.sort((a, b) => b.totalXP - a.totalXP).map(e => e.contributor);

  if (contributors.length === 0) {
    container.textContent = "No contributor data available for insights.";
    return container;
  }

  // --- Consolidated View ("All" selected) ---
  if (selectedContributor === "All") {
    // Create tables
    const breakdownTable = document.createElement("table");
    breakdownTable.className = "insights-table consolidated";
    const breakdownCaption = breakdownTable.createCaption();
    breakdownCaption.textContent = "Contribution Breakdown";
    const breakdownHead = breakdownTable.createTHead();
    breakdownHead.innerHTML = `<tr><th>Contributor</th><th>Tasks</th><th>Issue Specs</th><th>PR Specs</th><th>Issue Comments</th><th>PR Comments</th><th>Reviews</th></tr>`;
    const breakdownBody = breakdownTable.createTBody();

    const qualityTable = document.createElement("table");
    qualityTable.className = "insights-table consolidated";
    const qualityCaption = qualityTable.createCaption();
    qualityCaption.textContent = "Comment Quality (Average)";
    const qualityHead = qualityTable.createTHead();
    qualityHead.innerHTML = `<tr><th>Contributor</th><th>Comments</th><th>Formatting</th><th>Readability</th><th>Relevance</th></tr>`;
    const qualityBody = qualityTable.createTBody();

    const reviewTable = document.createElement("table");
    reviewTable.className = "insights-table consolidated";
    const reviewCaption = reviewTable.createCaption();
    reviewCaption.textContent = "Review Metrics";
    const reviewHead = reviewTable.createTHead();
    reviewHead.innerHTML = `<tr><th>Contributor</th><th>PRs Rev.</th><th>Total Revs.</th><th>Lines Reviewed</th><th>Total Reward</th><th>Avg Reward</th></tr>`; // Updated header
    const reviewBody = reviewTable.createTBody();

    // Populate tables
    contributors.forEach(contributor => {
      const breakdown = breakdownData[contributor];
      const quality = qualityData[contributor];
      const reviews = reviewData[contributor];

      if (breakdown) {
        const row = breakdownBody.insertRow();
        row.innerHTML = `
          <td>${contributor}</td>
          <td>${breakdown.tasksAssigned}</td>
          <td>${breakdown.issueSpecifications}</td>
          <td>${breakdown.pullSpecifications}</td>
          <td>${breakdown.issueComments}</td>
          <td>${breakdown.pullComments}</td>
          <td>${breakdown.reviewsConducted}</td>
        `;
      }
      if (quality) {
        const row = qualityBody.insertRow();
        row.innerHTML = `
          <td>${contributor}</td>
          <td>${quality.commentCount}</td>
          <td>${formatNum(quality.averageFormattingScore)}</td>
          <td>${formatNum(quality.averageReadabilityScore)}</td>
          <td>${formatNum(quality.averageRelevanceScore)}</td>
        `;
      }
      if (reviews) {
        const row = reviewBody.insertRow();
        row.innerHTML = `
          <td>${contributor}</td>
          <td>${reviews.pullsReviewedCount}</td>
          <td>${reviews.totalReviewsConducted}</td>
          <td>${reviews.totalLinesReviewed}</td>
          <td>${formatNum(reviews.totalReviewReward)}</td>
          <td>${formatNum(reviews.averageReviewReward)}</td>
        `;
      }
    });

    container.appendChild(breakdownTable);
    container.appendChild(qualityTable);
    container.appendChild(reviewTable);

  } else {
    // --- Individual Contributor View ---
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

    // Quality Table (Individual)
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

    // Review Metrics Table (Individual)
    if (reviews) {
      const reviewTable = document.createElement("table");
      reviewTable.className = "insights-table";
      const reviewCaption = reviewTable.createCaption();
      reviewCaption.textContent = `Review Metrics (${reviews.pullsReviewedCount} PRs)`;
      const reviewBody = reviewTable.createTBody();
      reviewBody.innerHTML = `
        <tr><td>Total Reviews</td><td>${reviews.totalReviewsConducted}</td></tr>
        <tr><td>Lines Reviewed</td><td>${reviews.totalLinesReviewed}</td></tr> {/* Use new summed property */}
        <tr><td>Total Review Reward</td><td>${formatNum(reviews.totalReviewReward)}</td></tr>
        <tr><td>Avg Review Reward</td><td>${formatNum(reviews.averageReviewReward)}</td></tr>
      `;
      contributorContainer.appendChild(reviewTable);
    }
    container.appendChild(contributorContainer);
  }

  return container;
}
