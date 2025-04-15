/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import {
  getRecentRuns,
  getWorkflowInputs,
  setRecentRuns,
  setWorkflowInputs,
} from "../db/recent-runs-cache";
import { isProduction } from "../utils";

export class RecentRunsWidget extends HTMLElement {
  private container!: HTMLDivElement;
  private runsContainer!: HTMLDivElement;
  private currentRunId: string | null = null;

  constructor() {
    super();
    // Removed isProduction check as it's always shown now
    // if (isProduction()) return;

    this.container = document.createElement("div");
    this.container.className = "recent-runs-widget"; // Updated class name

    this.runsContainer = document.createElement("div");
    this.container.appendChild(this.runsContainer);

    // Add title
    const title = document.createElement("div");
    title.textContent = "Recent Reports";
    title.className = "recent-runs-widget__title"; // Updated class name
    this.container.insertBefore(title, this.runsContainer);

    this.loadWorkflowRuns();
  }

  connectedCallback() {
    // Removed isProduction check
    this.appendChild(this.container);
  }

  disconnectedCallback() {
    // Removed isProduction check
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  private async loadWorkflowRuns() {
    // Show spinner immediately
    this.runsContainer.innerHTML = `
      <div class="recent-runs-widget__loading">
        <div class="recent-runs-widget__spinner"></div>
        <div>Loading recent reports...</div>
      </div>
    `;

    // 1. Try to load from cache first
    try {
      const cachedRuns = await getRecentRuns();
      if (cachedRuns && Array.isArray(cachedRuns)) {
        this.renderWorkflowRuns(cachedRuns, true);
        // Update loading text while fetching fresh data
        const loadingDiv = this.runsContainer.querySelector('.recent-runs-widget__loading');
        if (loadingDiv) {
          loadingDiv.innerHTML = `
            <div class="recent-runs-widget__spinner"></div>
            <div>Updating reports...</div>
          `;
        }
      }
    } catch (e) {
      console.error("Error loading cached workflow runs:", e);
    }

    // 2. Fetch fresh data from API
    try {
      const response = await fetch("/api/workflow-runs");
      if (!response.ok) throw new Error("Failed to fetch workflow runs");
      const data = await response.json();
      if (Array.isArray(data.workflow_runs)) {
        await setRecentRuns(data.workflow_runs);
        // Re-render with fresh data
        this.renderWorkflowRuns(data.workflow_runs, false);
      }
    } catch (error) {
      console.error("Error fetching workflow runs from API:", error);
      // Show error state if both cache and API fail
      if (!this.runsContainer.querySelector('.workflow-run')) {
        this.runsContainer.innerHTML = `
          <div class="recent-runs-widget__error">
            Failed to load reports
          </div>
        `;
      }
    }
  }

  // isCacheOnly: true if rendering from cache, false if rendering from fresh API (should only be true in this widget)
  private async renderWorkflowRuns(runs: any[], isCacheOnly = false) {
    // --- Dynamic Item Calculation ---
    const itemHeight = 68; // Estimated height (padding + margin + text) in pixels
    let numToDisplay = 10; // Default fallback

    // Ensure container is in the DOM and has height before calculating
    // Use `this.offsetHeight` as the container might not be fully rendered yet
    if (this.offsetHeight > 0) {
        const availableHeight = this.offsetHeight - 40; // Subtract approx title height + padding
        numToDisplay = Math.max(1, Math.floor(availableHeight / itemHeight));
        // console.log(`RecentRunsWidget: Height=${availableHeight}, ItemHeight=${itemHeight}, Displaying=${numToDisplay}`); // Optional debug log
    } else {
        // If container height isn't available yet (e.g., initial render before layout),
        // maybe try getting height from `this` (the custom element) or defer calculation slightly.
        // For now, we'll stick to the default if container height is 0.
        // console.log(`RecentRunsWidget: Container height 0, using default ${numToDisplay}`);
    }
    // --- End Calculation ---

    this.runsContainer.innerHTML = "";

    const runsToRender = runs.slice(0, numToDisplay); // Slice the array

    if (!runsToRender.length) {
      this.runsContainer.innerHTML = '<div class="recent-runs-widget__error">No workflow runs found</div>'; // Updated class name
      return;
    }

    // Render only the calculated number of runs
    for (const run of runsToRender) {
      const runElement = document.createElement("div");
      // Get current run ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      const currentRunId = urlParams.get('run');
      const isActiveRun = currentRunId === String(run.id);

      runElement.className = `workflow-run${isActiveRun ? ' workflow-run--active' : ''}`;

      const timestamp = new Date(run.created_at).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      let statusColor = "#63e6be"; // Default green
      let runDetail = "";

      // Try to get workflow inputs from cache first
      let inputs: any = undefined;
      try {
        inputs = await getWorkflowInputs(String(run.id));
        if (typeof inputs === "undefined") {
          // Not in cache, fetch from API and cache for next load
          const res = await fetch(`/api/workflow-inputs/${run.id}`);
          if (res.ok) {
            inputs = await res.json();
            await setWorkflowInputs(String(run.id), inputs);
          } else {
            // Cache null to avoid repeated fetches for missing inputs
            await setWorkflowInputs(String(run.id), null);
            inputs = null;
            console.error(`Failed to fetch workflow inputs for run ${run.id}:`, await res.text());
          }
        }
      } catch (e) {
        console.error("Error getting workflow inputs for run", run.id, e);
      }

      const organization = inputs?.organization;
      const repo = inputs?.repo;

      if (organization && repo) {
        runDetail = `${organization}${repo ? `/${repo}` : ""}`;
      } else if (organization) {
        runDetail = organization;
      } else if (repo) {
        runDetail = repo;
      } else {
        runDetail = "⚠ Unknown Report";
        statusColor = "#ff6b6b";
      }

      runElement.innerHTML = `
        <div class="workflow-run__header" data-run-id="${run.id}">
          <span class="workflow-run__timestamp">${timestamp}</span>
        </div>
        <div class="workflow-run__detail" style="color: ${statusColor}">
          ${runDetail}
        </div>
      `;

      runElement.addEventListener("click", () => {
        window.location.href = `/?run=${run.id}`;
      });

      this.runsContainer.appendChild(runElement);
    }
  }
}

// Updated custom element definition
customElements.define("recent-runs-widget", RecentRunsWidget);
