import "./components/recent-runs-widget"; // Updated import
import type { LeaderboardEntry, TimeSeriesEntry } from "./data-transform";
import { cubicBezier, getRunIdFromQuery, isProduction } from "./utils";
import { renderLeaderboardChart } from "./visualization/leaderboard-chart";
import { renderTimeSeriesChart } from "./visualization/time-series-chart";
import { cleanupWorker, loadArtifactData } from "./workers/artifact-worker-manager";

type ViewMode = "leaderboard" | "timeseries";

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
    let viewMode: ViewMode = "leaderboard";
    let selectedContributor: string = "All";
    let currentTimeValue: number = 0; // Current slider value (minutes since epoch)
    let maxYValue: number = 1;
    let ranks: { [contributor: string]: number } = {};
    let highestScorer: string | null = null;
    let globalMinTimeMs: number | null = null; // In milliseconds
    let globalMaxTimeMs: number | null = null; // In milliseconds
    let globalMinTimeMins: number = 0; // In minutes since epoch
    let globalMaxTimeMins: number = 0; // In minutes since epoch
    let isAnimating: boolean = false; // Flag to control fade-in
    let scaleMode: 'linear' | 'log' = 'linear'; // Add scale mode state

    // --- UI Elements ---
    const root = document.getElementById("xp-analytics-root")!;
    const chartArea = document.getElementById("xp-analytics-chart-area")!;
    const contributorSelect = document.getElementById("contributor-select") as HTMLSelectElement;
    const viewToggle = document.getElementById("view-toggle") as HTMLButtonElement;
    const scaleToggle = document.getElementById("scale-toggle") as HTMLButtonElement; // Get scale toggle button
    const timeRange = document.getElementById("time-range") as HTMLInputElement;
    const contextLabel = document.getElementById("xp-analytics-context-label") as HTMLSpanElement;
    const avatarImg = document.getElementById("xp-analytics-org-avatar") as HTMLImageElement;

    // Context label and avatar will be set in onComplete after data is loaded

    // --- Render function ---
    function render() {
      chartArea.innerHTML = "";
      const timeRangeLabel = document.getElementById("time-range-label") as HTMLSpanElement;
      let timeRangeText = "";

      if (viewMode === "leaderboard") {
        // Filter leaderboard data by contributor if not "All"
        const filtered = selectedContributor === "All"
          ? leaderboardData
          : leaderboardData.filter((entry) => entry.contributor === selectedContributor);

        renderLeaderboardChart(filtered, chartArea, {
          // Let leaderboard determine its own height based on entries
          highlightContributor: selectedContributor !== "All" ? selectedContributor : leaderboardData[0]?.contributor,
          ranks: ranks, // Pass the ranks object
          scaleMode: scaleMode, // Pass the scale mode
        });
        timeRangeText = ""; // No time range label for leaderboard
      } else {
        // Filter time series data by contributor if not "All"
        let filtered = selectedContributor === "All"
          ? timeSeriesData
          : timeSeriesData.filter((entry) => entry.contributor === selectedContributor);

        // Calculate cutoff time based on slider value, but don't filter data here
        let cutoffTimeMs: number | undefined = undefined;
        if (globalMinTimeMs !== null && globalMaxTimeMs !== null) {
           cutoffTimeMs = currentTimeValue * MS_PER_MINUTE;
           // Ensure cutoff doesn't exceed max time (can happen due to rounding/ceil)
            cutoffTimeMs = Math.min(cutoffTimeMs, globalMaxTimeMs);
         }
         // Filtering is now handled within renderTimeSeriesChart based on cutoffTimeMs

         // Calculate animation progress only if animating
        const animationProgress = isAnimating && globalMaxTimeMins > globalMinTimeMins
          ? (currentTimeValue - globalMinTimeMins) / (globalMaxTimeMins - globalMinTimeMins)
          : 1; // Default to 1 (no fade) if not animating or range is zero

        renderTimeSeriesChart(filtered, chartArea, {
          // Do not pass fixed height, let the renderer use container height
          highlightContributor: selectedContributor !== "All" ? selectedContributor : (highestScorer ?? undefined),
          maxYValue: maxYValue,
          ranks: ranks,
          minTime: globalMinTimeMs, // Pass fixed min/max time in MS
          maxTime: globalMaxTimeMs,
          animationProgress: animationProgress, // Pass animation progress (0-1)
          cutoffTimeMs: cutoffTimeMs // Pass the calculated cutoff time
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
      }
      // Update time range label
      if (timeRangeLabel) {
        timeRangeLabel.textContent = timeRangeText;
      }
      // Update toggle button label
      viewToggle.textContent = viewMode === "leaderboard" ? "Leaderboard" : "Time Series";
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

      // --- Calculate Max Y Value ---
      if (maxYValue === 1) { // Only calculate once
        timeSeriesData.forEach(entry => {
          let cumulative = 0;
          entry.series.forEach(pt => {
            cumulative += pt.xp;
            if (cumulative > maxYValue) maxYValue = cumulative;
          });
        });
      }

      // --- Calculate Ranks ---
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

      // Start animation
      animateTimeline();
    }

    // --- Event listeners ---
    contributorSelect.addEventListener("change", (e) => {
      selectedContributor = contributorSelect.value;
      isAnimating = false; // Stop animation if user interacts
      render();
    });

    viewToggle.addEventListener("click", () => {
      viewMode = viewMode === "leaderboard" ? "timeseries" : "leaderboard";
      isAnimating = false; // Stop animation if user interacts
      // Reset chart area height if switching away from timeseries
      if (viewMode === 'leaderboard') {
        chartArea.style.height = ''; // Allow leaderboard to set its height
      } else {
        // If switching back to timeseries, re-sync state and potentially re-fix height/animate
        currentTimeValue = parseInt(timeRange.value, 10); // Sync state with slider
        // Re-render once to establish potential new height before fixing/animating
        render();
        chartArea.style.height = `${chartArea.offsetHeight}px`; // Re-fix height
        // Optionally restart animation here if desired when switching back
        // animateTimeline();
      }
      render(); // Render the new view
    });

    scaleToggle.addEventListener("click", () => {
        scaleMode = scaleMode === 'linear' ? 'log' : 'linear';
        scaleToggle.textContent = scaleMode === 'linear' ? "Use Log Scale" : "Use Linear Scale";
        isAnimating = false; // Stop animation if user interacts
        // Re-render only if currently in leaderboard view
        if (viewMode === 'leaderboard') {
            render();
        }
    });

    timeRange.addEventListener("input", () => {
      isAnimating = false; // Stop animation if user interacts
      currentTimeValue = parseInt(timeRange.value, 10);
      render();
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
          leaderboardData = data.leaderboard;
          timeSeriesData = data.timeSeries;

          (window as any).analyticsData = data;
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
        chartArea.innerHTML = `<div class="dev-mode-message" style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ccc;"><div><p>Select a report from the sidebar.</p></div></div>`;
      }
      // Hide elements that depend on run data
      if (contributorSelect) contributorSelect.style.display = 'none';
      if (viewToggle) viewToggle.style.display = 'none';
      if (timeRange) timeRange.parentElement?.style.display === 'none'; // Hide slider container
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
