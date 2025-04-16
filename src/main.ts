import "./components/recent-runs-widget"; // Updated import
import type { LeaderboardEntry, TimeSeriesEntry } from "./data-transform";
import type { OverviewResult } from "./analytics/contribution-overview"; // Import new type
import type { QualityResult } from "./analytics/comment-quality"; // Import new type
import type { ReviewMetricsResult } from "./analytics/review-metrics"; // Import new type
import { cubicBezier, getRunIdFromQuery, isProduction } from "./utils";
import { exportDataToCsv } from "./utils/export-csv"; // Import the export function
import { renderLeaderboardChart } from "./visualization/leaderboard-chart";
import { renderTimeSeriesChart } from "./visualization/time-series-chart";
import { InsightsView } from "./components/insights-view"; // Import the new component
import { cleanupWorker, loadArtifactData } from "./workers/artifact-worker-manager";
import { calculateContributorXpAtTime } from "./calculate-contributor-xp-at-time"; // Import the new helper
import type { OrgRepoStructure } from "./data-transform"; // Import OrgRepoStructure type

type ViewMode = "leaderboard" | "timeseries" | "insights"; // Add insights view mode

// Set up loading overlay
const loadingOverlay = document.createElement("div");
loadingOverlay.className = "loading-overlay";

const progressText = document.createElement("div");
progressText.className = "loading-overlay-progress";
loadingOverlay.appendChild(progressText);

const MS_PER_MINUTE = 60 * 1000;

async function init() {
  try {
    // Initialize dev mode widget
    // (No longer needed: widget is instantiated via <dev-mode-widget> in HTML)

    const runId = getRunIdFromQuery();
    // Removed the block that showed the "Development Mode" message
    if (!runId) {
        // If no run ID, we might still want to show *something* or log an error,
        // but not the old dev mode message. For now, just log error if production.
        if (isProduction()) {
            console.error("No run ID found in URL");
        }
        // Potentially display a different default message or just let the widget handle selection.
        // For now, let it proceed, the widget will show runs.
        // return; // Removed return, allow page to load with widget
    }

    // --- State and Data ---
    // Initialize even if runId is null, but data loading depends on it
    let leaderboardData: LeaderboardEntry[] = [];
    let timeSeriesData: TimeSeriesEntry[] = [];
    let overviewData: OverviewResult = {}; // State for overview
    let qualityData: QualityResult = {}; // State for quality
    let reviewData: ReviewMetricsResult = {}; // State for reviews
    let currentRawData: OrgRepoStructure | null = null; // State for raw data for export
    let viewMode: ViewMode = "leaderboard"; // Default view
    let selectedContributor: string = "All";
    let currentTimeValue: number = 0; // Current slider value (minutes since epoch)
    let globalMaxCumulativeXP: number = 1; // Renamed from maxYValue, represents overall max XP
    let ranks: { [contributor: string]: number } = {};
    let highestScorer: string | null = null;
    let globalMinTimeMs: number | null = null; // In milliseconds
    let globalMaxTimeMs: number | null = null; // In milliseconds
    let globalMinTimeMins: number = 0; // In minutes since epoch
    let globalMaxTimeMins: number = 0; // In minutes since epoch
    let isAnimating: boolean = false; // Flag to control fade-in
    let scaleMode: 'linear' | 'log' = 'linear'; // Add scale mode state
    let issueFilterValue: string = ''; // State for issue filter input

    // --- UI Elements ---
    const root = document.getElementById("xp-analytics-root")!;
    const chartArea = document.getElementById("xp-analytics-chart-area")!;
    const contributorSelect = document.getElementById("contributor-select") as HTMLSelectElement;
    const viewToggle = document.getElementById("view-toggle") as HTMLButtonElement; // Consolidated toggle
    // const insightsToggle = document.getElementById("insights-toggle") as HTMLButtonElement; // Removed redundant toggle
    const scaleToggle = document.getElementById("scale-toggle") as HTMLButtonElement; // Get scale toggle button
    const exportCsvButton = document.createElement("button"); // Create export button
    exportCsvButton.id = "export-csv-button";
    exportCsvButton.textContent = "Export CSV";
    exportCsvButton.disabled = true; // Disable initially
    // Append near scale toggle (assuming they share a parent or are in a controls container)
    scaleToggle.parentNode?.insertBefore(exportCsvButton, scaleToggle.nextSibling);

    const issueFilterInput = document.getElementById("issue-filter-input") as HTMLInputElement; // Get issue filter input
    const timeRange = document.getElementById("time-range") as HTMLInputElement;
    const contextLabel = document.getElementById("xp-analytics-context-label") as HTMLSpanElement;
    const avatarImg = document.getElementById("xp-analytics-org-avatar") as HTMLImageElement;

    // Context label and avatar will be set in onComplete after data is loaded

    // --- Render function ---
    function render() {
      // Ensure data is loaded before rendering
      if (!leaderboardData.length && !timeSeriesData.length && runId) {
          // Data might still be loading, or failed to load
          // Avoid rendering if essential data is missing (unless no runId was specified)
          console.warn("Render called before data was ready.");
          return;
      }

      chartArea.innerHTML = "";
      const timeRangeLabel = document.getElementById("time-range-label") as HTMLSpanElement;
      let timeRangeText = "";

      // Calculate cutoff time based on slider value
      let cutoffTimeMs: number = globalMaxTimeMs ?? Date.now(); // Default to max time if not calculated yet
      if (globalMinTimeMs !== null && globalMaxTimeMs !== null) {
          cutoffTimeMs = currentTimeValue * MS_PER_MINUTE;
          cutoffTimeMs = Math.min(cutoffTimeMs, globalMaxTimeMs); // Ensure it doesn't exceed max
          cutoffTimeMs = Math.max(cutoffTimeMs, globalMinTimeMs); // Ensure it doesn't go below min
      }


      if (viewMode === "leaderboard") {
        // Calculate leaderboard state at the current cutoff time
        const xpAtTime = calculateContributorXpAtTime(timeSeriesData, cutoffTimeMs);

        // Create temporary leaderboard data for rendering
        const leaderboardForRender: LeaderboardEntry[] = leaderboardData
            .map(originalEntry => {
                const currentXP = xpAtTime[originalEntry.contributor] ?? 0;
                // Return a new object, preserving original overviews but updating totalXP
                return {
                    ...originalEntry, // Copy userId, original overviews etc.
                    totalXP: currentXP, // Set the calculated XP at cutoff time
                };
            })
            .filter(entry => entry.totalXP > 0) // Optionally filter out those with 0 XP at this time
            .sort((a, b) => b.totalXP - a.totalXP); // Sort by current XP

        // Recalculate ranks based on the current state
        const currentRanks: { [contributor: string]: number } = {};
        leaderboardForRender.forEach((entry, index) => {
            currentRanks[entry.contributor] = index + 1;
        });

        // Filter based on dropdown selection
        const filtered = selectedContributor === "All"
          ? leaderboardForRender
          : leaderboardForRender.filter((entry) => entry.contributor === selectedContributor);

        renderLeaderboardChart(filtered, chartArea, {
          highlightContributor: selectedContributor !== "All" ? selectedContributor : leaderboardForRender[0]?.contributor,
          ranks: currentRanks, // Pass the recalculated ranks
          scaleMode: scaleMode,
          overallMaxXP: globalMaxCumulativeXP // Pass the overall max XP for consistent scaling
        });

      } else if (viewMode === "timeseries") { // Time Series View
        // Filter time series data by contributor if not "All"
        let filteredByContributor = selectedContributor === "All"
          ? timeSeriesData
          : timeSeriesData.filter((entry) => entry.contributor === selectedContributor);

        // Apply issue filter if set
        let filteredDataForChart = filteredByContributor;
        const currentIssueFilter = issueFilterValue.trim();
        if (currentIssueFilter.length > 0) {
            filteredDataForChart = filteredByContributor.map(contributorEntry => {
                const filteredSeries = contributorEntry.series.filter(point => point.issueOrPr === currentIssueFilter);
                return { ...contributorEntry, series: filteredSeries };
            }).filter(contributorEntry => contributorEntry.series.length > 0);
        }

        // Cutoff time already calculated above
        // Filtering is handled within renderTimeSeriesChart based on cutoffTimeMs

        // Calculate animation progress only if animating
        const animationProgress = isAnimating && globalMaxTimeMins > globalMinTimeMins
          ? (currentTimeValue - globalMinTimeMins) / (globalMaxTimeMins - globalMinTimeMins)
          : 1; // Default to 1 (no fade) if not animating or range is zero

        renderTimeSeriesChart(filteredDataForChart, chartArea, { // Pass the filtered data
          // Do not pass fixed height, let the renderer use container height
          highlightContributor: selectedContributor !== "All" ? selectedContributor : (highestScorer ?? undefined),
          maxYValue: globalMaxCumulativeXP, // Pass overall max XP to timeline Y-axis
          ranks: ranks,
          minTime: globalMinTimeMs, // Pass fixed min/max time in MS
          maxTime: globalMaxTimeMs,
          animationProgress: animationProgress, // Pass animation progress (0-1)
          cutoffTimeMs: cutoffTimeMs, // Pass the calculated cutoff time
          scaleMode: scaleMode // Pass the scale mode
        });

        // --- Human-readable time range label ---
         // Display full time range, indicating current slider position
         if (globalMinTimeMs !== null && globalMaxTimeMs !== null) {
            const currentDisplayTimeMs = currentTimeValue * MS_PER_MINUTE;
            const format = (d: Date) =>
              `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            const startTimeStr = format(new Date(globalMinTimeMs));
            const currentTimeStr = format(new Date(currentDisplayTimeMs));
            // Indicate the full range but highlight the current end point
            timeRangeText = `${startTimeStr} — ${currentTimeStr}`;
         } else {
            timeRangeText = ""; // Show nothing if time range isn't calculated yet
        }
      } else { // Insights View
          // Render the Insights View component
          const insightsElement = InsightsView({
              overviewData,
              qualityData,
              reviewData,
              leaderboardData, // Pass leaderboard for contributor list/sorting
              selectedContributor
          });
          chartArea.appendChild(insightsElement);
          // Insights view doesn't use the time range slider in this basic implementation
          timeRangeText = "Overall Metrics";
      } // End of Insights View

      // --- Update time range label (applies to all views) ---
      if (timeRangeLabel) {
          if (globalMinTimeMs !== null && globalMaxTimeMs !== null) {
              const currentDisplayTimeMs = currentTimeValue * MS_PER_MINUTE;
              const format = (d: Date) =>
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
              const startTimeStr = format(new Date(globalMinTimeMs));
              const currentTimeStr = format(new Date(currentDisplayTimeMs));
              // Indicate the full range but highlight the current end point
              timeRangeText = `${startTimeStr} — ${currentTimeStr}`;
           } else {
              timeRangeText = ""; // Show nothing if time range isn't calculated yet
          }
          timeRangeLabel.textContent = timeRangeText;
      }
      // Update toggle button label based on the current viewMode
      if (viewMode === "leaderboard") {
        viewToggle.textContent = "Leaderboard";
      } else if (viewMode === "timeseries") {
        viewToggle.textContent = "Time Series";
      } else {
        viewToggle.textContent = "Insights";
      }
      // Consider disabling/enabling controls based on viewMode if needed
      const timeControls = document.getElementById("time-controls");
      const issueFilterGroup = document.getElementById("issue-filter");
      if (timeControls) timeControls.style.display = viewMode === 'insights' ? 'none' : '';
      if (issueFilterGroup) issueFilterGroup.style.display = viewMode === 'timeseries' ? '' : 'none';


    }

    function animateTimeline() {
      isAnimating = true; // Start animation fade-in
      const startTime = performance.now();
      const duration = 2500; // 2.5 seconds
      const startValue = globalMinTimeMins;
      const endValue = globalMaxTimeMins;
      const range = endValue - startValue;

      function animate(currentTime: number) {
        const elapsed = currentTime - startTime;
        let progress = Math.min(elapsed / duration, 1);

        // Apply ease-in-out easing (cubic-bezier(0.42, 0, 0.58, 1))
        const easedProgress = cubicBezier(0.42, 0, 0.58, 1, progress);

        currentTimeValue = startValue + range * easedProgress;
        timeRange.value = String(currentTimeValue); // Update slider position
        render();

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          isAnimating = false; // Animation finished, stop fade-in effect
          // Ensure final state is exactly the max time
          currentTimeValue = globalMaxTimeMins;
          timeRange.value = String(currentTimeValue);
          render(); // Final render at 100%
        }
      }

      requestAnimationFrame(animate);
    }

    // --- Initialize UI with data ---
    function initializeUI() {
      // --- Contributor Select Dropdown ---
      const allContributors = Array.from(
        new Set([
          ...leaderboardData.map((entry) => entry.contributor),
          ...timeSeriesData.map((entry) => entry.contributor),
        ])
      ).sort((a, b) => a.localeCompare(b));
      contributorSelect.innerHTML = "";
      const allOption = document.createElement("option");
      allOption.value = "All";
      allOption.textContent = "All Contributors";
      contributorSelect.appendChild(allOption);
      allContributors.forEach((contributor) => {
        const opt = document.createElement("option");
        opt.value = contributor;
        opt.textContent = contributor;
        contributorSelect.appendChild(opt);
      });

      // --- Calculate Overall Max Cumulative XP (for Y-axis/Leaderboard scaling) ---
      if (globalMaxCumulativeXP === 1) { // Only calculate once
        timeSeriesData.forEach(entry => {
          let cumulative = 0;
          entry.series.forEach(pt => {
            cumulative += pt.xp;
            if (cumulative > globalMaxCumulativeXP) globalMaxCumulativeXP = cumulative;
          });
        });
        // Ensure it's at least 1 after calculation
        globalMaxCumulativeXP = Math.max(1, globalMaxCumulativeXP);
      }


      // --- Calculate Ranks (based on final leaderboard data) ---
      const scoresArray: [string, number][] = leaderboardData.map(entry => {
        return [entry.contributor, entry.totalXP];
      });
      scoresArray.sort(([, scoreA], [, scoreB]) => scoreB - scoreA);
      ranks = {};
      highestScorer = scoresArray.length > 0 ? scoresArray[0][0] : null;
      scoresArray.forEach(([contributor], index) => {
        ranks[contributor] = index + 1;
      });

      // --- Calculate Global Time Range and Set Slider ---
      const allTimestampsFull: number[] = timeSeriesData.flatMap(entry =>
        entry.series.map(pt => new Date(pt.time).getTime())
      );
      if (allTimestampsFull.length > 0) {
        globalMinTimeMs = Math.min(...allTimestampsFull);
        globalMaxTimeMs = Math.max(...allTimestampsFull);
        globalMinTimeMins = Math.floor(globalMinTimeMs / MS_PER_MINUTE);
        globalMaxTimeMins = Math.ceil(globalMaxTimeMs / MS_PER_MINUTE); // Use ceil for max to include the last minute
      } else {
        globalMinTimeMs = Date.now(); // Fallback if no data
        globalMaxTimeMs = Date.now();
        globalMinTimeMins = Math.floor(globalMinTimeMs / MS_PER_MINUTE);
        globalMaxTimeMins = globalMinTimeMins;
      }

      // Set slider attributes
      timeRange.min = String(globalMinTimeMins);
      timeRange.max = String(globalMaxTimeMins);
      timeRange.value = String(globalMinTimeMins); // Start slider at the beginning
      currentTimeValue = globalMinTimeMins; // Sync state

      // --- Initial Render & Animation ---
      viewMode = "timeseries"; // Default to timeseries for animation
      // Initial render to calculate layout height BEFORE fixing it
      render();

      // Store max height and fix it (use chartArea's actual height now)
      chartArea.style.height = `${chartArea.offsetHeight}px`;

      // Start animation (only if runId exists and data loaded)
      if (runId && leaderboardData.length > 0) {
          animateTimeline();
      } else {
          // If no runId or no data, just do initial render without animation
          render();
      }
    }

    // --- Event listeners ---
    contributorSelect.addEventListener("change", (e) => {
      selectedContributor = contributorSelect.value;
      isAnimating = false; // Stop animation if user interacts
      render();
    });

    viewToggle.addEventListener("click", () => {
      // Cycle through the three views: leaderboard -> timeseries -> insights -> leaderboard
      if (viewMode === "leaderboard") {
        viewMode = "timeseries";
      } else if (viewMode === "timeseries") {
        viewMode = "insights";
      } else { // viewMode === "insights"
        viewMode = "leaderboard";
      }

      isAnimating = false; // Stop animation if user interacts

      // Reset chart area height if switching to leaderboard or insights
      if (viewMode === 'leaderboard' || viewMode === 'insights') {
        chartArea.style.height = ''; // Allow leaderboard/insights to set its height
      } else { // Switching to timeseries
        // Re-sync state and potentially re-fix height/animate
        currentTimeValue = parseInt(timeRange.value, 10); // Sync state with slider
        // Re-render once to establish potential new height before fixing/animating
        render();
        chartArea.style.height = `${chartArea.offsetHeight}px`; // Re-fix height
        // Optionally restart animation here if desired when switching back
        // animateTimeline();
      }
      render(); // Render the new view
    });

    // Removed event listener for insightsToggle

    exportCsvButton.addEventListener("click", () => {
      if (currentRawData && runId) {
        console.log("Exporting data for runId:", runId);
        exportDataToCsv(runId, currentRawData);
      } else {
        console.warn("No data loaded or runId missing, cannot export.");
        alert("No data loaded to export.");
      }
    });

    scaleToggle.addEventListener("click", () => {
        scaleMode = scaleMode === 'linear' ? 'log' : 'linear';
        scaleToggle.textContent = scaleMode === 'linear' ? "Use Log Scale" : "Use Linear Scale";
        isAnimating = false; // Stop animation if user interacts
        // Re-render the current view to apply the new scale
        render();
    });

    timeRange.addEventListener("input", () => {
      isAnimating = false; // Stop animation if user interacts
      currentTimeValue = parseInt(timeRange.value, 10);
      // No need to recalculate leaderboard here, render() will do it
      render();
    });

    issueFilterInput.addEventListener("input", () => {
      issueFilterValue = issueFilterInput.value;
      isAnimating = false; // Stop animation if user interacts
      // Re-render the current view (only timeseries is affected by this filter)
      if (viewMode === 'timeseries') {
        render();
      }
      // Note: Leaderboard view is not affected by issue filter in this implementation
    });

    // --- Load Data (only if runId is valid) ---
    if (runId) {
      root.style.position = "relative"; // Needed for overlay positioning
      root.appendChild(loadingOverlay);
      await loadArtifactData(runId, { // Pass guaranteed non-null runId
        onProgress: (phase, percent, detail) => {
          progressText.textContent = `${phase}: ${Math.round(percent)}%${detail ? ` - ${detail}` : ""}`;
          progressText.classList.remove("error");
        },
        onError: (error) => {
          console.error(error);
          progressText.textContent = `Error: ${error.message}`;
          progressText.classList.add("error");
          // Potentially remove overlay or leave error message
        },
        onComplete: (data) => {
          loadingOverlay.remove();
          // Store all received data
          leaderboardData = data.leaderboard;
          timeSeriesData = data.timeSeries;
          overviewData = data.overview;
          qualityData = data.quality;
          reviewData = data.reviews;
          // Store the raw data structure for export
          if (data.rawData && runId && data.rawData[runId]) {
            currentRawData = data.rawData[runId];
            exportCsvButton.disabled = false; // Enable export button
          } else {
            currentRawData = null;
            exportCsvButton.disabled = true; // Keep disabled if data structure is unexpected
            console.warn("Raw data structure for the current runId is missing or invalid.");
          }

          // Expose all data for debugging
          (window as any).analyticsData = {
            leaderboard: data.leaderboard,
            timeSeries: data.timeSeries,
            overview: data.overview,
            quality: data.quality,
            reviews: data.reviews,
            rawData: data.rawData // Keep rawData exposure if needed
          };
          console.log("%c✨ Developer Note: Access all analytics data via window.analyticsData", "color: #00e0ff; font-weight: bold;");
          console.log("Leaderboard Data:", leaderboardData);
          console.log("Time Series Data:", timeSeriesData);

          // --- Determine and Set Context Label & Avatar ---
          let orgName: string | null = null;
          if (contextLabel && avatarImg && data.rawData && runId && data.rawData[runId]) {
            const orgRepoDataForRun = data.rawData[runId];
            const orgRepoKeys = Object.keys(orgRepoDataForRun);
            if (orgRepoKeys.length === 1) {
              const key = orgRepoKeys[0];
              if (key.includes('/')) {
                const [org, repo] = key.split('/');
                contextLabel.textContent = `${org}/${repo}`; // Use user's format
                orgName = org;
              } else {
                contextLabel.textContent = key; // Use user's format
                orgName = key;
              }
            } else if (orgRepoKeys.length > 1) {
              // If multiple repos/orgs, try to determine a common org
              const firstKey = orgRepoKeys[0];
              if (firstKey.includes('/')) {
                const [org] = firstKey.split('/');
                // Check if all keys share the same org prefix
                const allShareOrg = orgRepoKeys.every(k => k.startsWith(org + '/'));
                if (allShareOrg) {
                    contextLabel.textContent = org; // Display common org
                    orgName = org;
                } else {
                    contextLabel.textContent = 'Multiple Contexts'; // Indicate multiple sources
                    orgName = null; // Can't determine single org for avatar
                }
              } else {
                 // If keys are just org names without slashes
                 contextLabel.textContent = 'Multiple Orgs';
                 orgName = null;
              }
            } else {
               contextLabel.textContent = 'Context Unknown';
               orgName = null;
            }

            // Set avatar source if org name was found
            if (orgName) {
              avatarImg.src = `https://github.com/${orgName}.png`;
              avatarImg.style.display = 'inline-block'; // Show avatar
              avatarImg.onerror = () => { avatarImg.style.display = 'none'; }; // Hide if avatar fails to load
            } else {
               avatarImg.style.display = 'none'; // Hide avatar if no single org name
            }

          } else {
             // Hide avatar if prerequisites not met
             if(avatarImg) avatarImg.style.display = 'none';
             if(contextLabel) contextLabel.textContent = 'Context Unknown'; // Set default text if needed
          }
          // --- End Context Label & Avatar Logic ---

          initializeUI(); // Initialize after data is loaded
        }
      });
    } else {
      // No runId, so don't show loading overlay or try to load specific run data.
      // The dev-mode-widget will load its list independently.
      // Display a placeholder message in the chart area.
      if (chartArea) {
        // Ensure the dev-mode-message class exists or define styles for it
        chartArea.innerHTML = `<div class="dev-mode-message" style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ccc;"><div><p>Select a report.</p></div></div>`;
      }
      // Hide elements that depend on run data
      if (contributorSelect) contributorSelect.style.display = 'none';
      if (viewToggle) viewToggle.style.display = 'none';
      // insightsToggle is removed
      if (scaleToggle) scaleToggle.style.display = 'none';
      if (exportCsvButton) exportCsvButton.style.display = 'none'; // Hide export button
      if (issueFilterInput?.parentElement) issueFilterInput.parentElement.style.display = 'none'; // Hide filter group
      if (timeRange?.parentElement) timeRange.parentElement.style.display = 'none'; // Hide slider container
      if (contextLabel) contextLabel.textContent = 'No Report Selected';
      if (avatarImg) avatarImg.style.display = 'none';
    }

    // Clean up on unload
    window.addEventListener("unload", cleanupWorker);
  } catch (error) {
    console.error(error);
  }
}

init();
