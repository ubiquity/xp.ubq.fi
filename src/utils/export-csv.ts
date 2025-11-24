import type { OrgRepoStructure, CommentScoreDetails } from "../data-transform"; // Import both types from data-transform

// Helper function to safely access nested properties
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSafe(fn: () => any, defaultValue: any = "") {
  try {
    const value = fn();
    // Handle cases where value might be 0 or false, which are valid
    return value !== undefined && value !== null ? value : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

// Flattens the complex OrgRepoStructure into an array of objects suitable for CSV
function flattenDataForCsv(runId: string, data: OrgRepoStructure): Record<string, unknown>[] {
  const flatData: Record<string, unknown>[] = [];

  for (const repoName in data) {
    const repoData = data[repoName];
    for (const issueNumber in repoData) {
      const issueData = repoData[issueNumber];
      for (const contributorName in issueData) {
        const contributorData = issueData[contributorName];
        const baseRow = {
          runId: runId,
          repository: repoName,
          issueNumber: issueNumber,
          contributor: contributorName,
          userId: contributorData.userId,
          totalIssueXp: contributorData.total,
        };

        // Add Task Row
        if (contributorData.task) {
          flatData.push({
            ...baseRow,
            contributionType: "Task",
            timestamp: getSafe(() => contributorData.task?.timestamp),
            reward: getSafe(() => contributorData.task?.reward),
            multiplier: getSafe(() => contributorData.task?.multiplier),
            commentId: "",
            commentType: "",
            commentContent: "",
            commentUrl: "",
            commentFormattingScore: "",
            commentReadabilityScore: "",
            commentRelevanceScore: "",
            reviewId: "",
            reviewUrl: "",
            reviewAddition: "",
            reviewDeletion: "",
            reviewReward: "",
            reviewPriority: "",
            evaluationCommentHtml: getSafe(() => contributorData.evaluationCommentHtml),
          });
        }

        // Add Comment Rows
        contributorData.comments?.forEach((comment) => {
          const score = comment.score as CommentScoreDetails | undefined; // Type assertion
          flatData.push({
            ...baseRow,
            contributionType: "Comment",
            timestamp: getSafe(() => comment.timestamp),
            reward: getSafe(() => score?.reward), // Assuming score contains reward
            multiplier: "", // Comments don't have multipliers directly
            commentId: getSafe(() => comment.id),
            commentType: getSafe(() => comment.commentType),
            commentContent: getSafe(() => comment.content), // Be mindful of large content
            commentUrl: getSafe(() => comment.url),
            commentFormattingScore: getSafe(() => score?.formatting?.result),
            commentReadabilityScore: getSafe(() => score?.readability?.score),
            commentRelevanceScore: getSafe(() => score?.relevance),
            reviewId: "",
            reviewUrl: "",
            reviewAddition: "",
            reviewDeletion: "",
            reviewReward: "",
            reviewPriority: "",
            evaluationCommentHtml: getSafe(() => contributorData.evaluationCommentHtml),
          });
        });

        // Add Review Rows
        contributorData.reviewRewards?.forEach((reviewReward) => {
          // Add optional chaining here in case reviewReward.reviews is undefined
          reviewReward.reviews?.forEach((review) => {
            flatData.push({
              ...baseRow,
              contributionType: "Review",
              timestamp: "", // Reviews might not have a single top-level timestamp in this structure
              reward: "", // Base reward is per-review item
              multiplier: "",
              commentId: "",
              commentType: "",
              commentContent: "",
              commentUrl: "",
              commentFormattingScore: "",
              commentReadabilityScore: "",
              commentRelevanceScore: "",
              reviewId: getSafe(() => review.reviewId),
              reviewUrl: getSafe(() => reviewReward.url),
              reviewAddition: getSafe(() => review.effect.addition),
              reviewDeletion: getSafe(() => review.effect.deletion),
              reviewReward: getSafe(() => review.reward),
              reviewPriority: getSafe(() => review.priority),
              evaluationCommentHtml: getSafe(() => contributorData.evaluationCommentHtml),
            });
          });
        });
      }
    }
  }

  return flatData;
}

// Converts an array of objects to a CSV string
function convertToCsv(data: Record<string, unknown>[]): string {
  if (!data || data.length === 0) {
    return "";
  }

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(",")]; // Header row

  data.forEach((row) => {
    const values = headers.map((header) => {
      const escaped = ("" + row[header]).replace(/"/g, '""'); // Escape double quotes
      return `"${escaped}"`; // Wrap in double quotes
    });
    csvRows.push(values.join(","));
  });

  return csvRows.join("\n");
}

// Triggers the download of the CSV file
function downloadCsv(csvString: string, filename: string): void {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    // Browsers that support HTML5 download attribute
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up
  } else {
    // Fallback for older browsers (less common now)
    console.error("CSV download not supported in this browser.");
    alert("CSV download not supported in this browser.");
  }
}

// Main function to generate and download the CSV
export function exportDataToCsv(runId: string, data: OrgRepoStructure): void {
  if (!data || Object.keys(data).length === 0) {
    console.warn("No data available to export for runId:", runId);
    alert("No data available to export.");
    return;
  }
  console.log("Flattening data for CSV export for runId:", runId);
  const flatData = flattenDataForCsv(runId, data);
  console.log("Converting data to CSV string...");
  const csvString = convertToCsv(flatData);
  const filename = `contribution_report_${runId}.csv`;
  console.log("Triggering CSV download:", filename);
  downloadCsv(csvString, filename);
  console.log("CSV download initiated.");
}
