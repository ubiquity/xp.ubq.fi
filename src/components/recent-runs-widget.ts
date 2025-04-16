/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import {
  getRecentRuns,
  getWorkflowInputs,
  setRecentRuns,
  setWorkflowInputs,
} from "../db/recent-runs-cache";
import type { Artifact } from "../types"; // Keep Artifact type if needed elsewhere, or remove if unused after changes

interface WorkflowRun {
  id: number;
  created_at: string;
  head_repository?: {
    owner: {
      login: string;
    };
    name: string;
  };
  repository?: {
    owner: {
      login: string;
    };
    name: string;
  };
}

export class RecentRunsWidget extends HTMLElement {
  private container!: HTMLDivElement;
  private runsContainer!: HTMLDivElement;
  private currentRunId: string | null = null;

  constructor() {
    super();

    this.container = document.createElement("div");
    this.container.className = "recent-runs-widget";

    this.runsContainer = document.createElement("div");
    this.container.appendChild(this.runsContainer);

    // Add title
    const title = document.createElement("div");
    title.textContent = "Recent Reports";
    title.className = "recent-runs-widget__title";
    this.container.insertBefore(title, this.runsContainer);

    this.loadWorkflowRuns();
  }

  connectedCallback() {
    this.appendChild(this.container);
  }

  disconnectedCallback() {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  /**
   * Public method to trigger a refresh of the widget from cache.
   */
  public refreshData() {
    this.loadWorkflowRuns();
  }

  private async loadWorkflowRuns() {
    // console.log('Starting loadWorkflowRuns...'); // DEBUG
    try {
      // 1. Load cached data immediately
      const cachedRuns = await getRecentRuns();

      // 2. Render runs if cache exists and is not empty
      if (cachedRuns && Array.isArray(cachedRuns) && cachedRuns.length > 0) {
        // console.log('Rendering cached runs'); // DEBUG
        // renderWorkflowRuns clears the container first, removing any previous loader/error
        this.renderWorkflowRuns(cachedRuns);
      } else {
        // 3. Show loading indicator ONLY if cache is empty/null AND container is currently empty
        // This prevents replacing an existing error message with a loader.
        // The background sync will trigger refreshData later if runs become available.
        if (!this.runsContainer.hasChildNodes()) {
            this.runsContainer.innerHTML = `
              <div class="recent-runs-widget__loading">
                <div class="recent-runs-widget__spinner"></div>
                <div>Loading reports...</div>
              </div>
            `;
        }
        // If cache was null/empty, the background sync will eventually trigger a refresh
        // which will call this function again. If runs are found then,
        // renderWorkflowRuns will replace the loading indicator.
      }

      // NOTE: Fetching fresh data and updating cache is now handled externally.
      // This function now ONLY reads from the cache.

    } catch (error) {
      console.error("Error loading/rendering cached runs:", error);
      // Show error only if nothing else is currently displayed
      if (!this.runsContainer.hasChildNodes()) {
        this.runsContainer.innerHTML = `
          <div class="recent-runs-widget__error">
            Failed to load reports
          </div>
        `;
      }
    }
  }

  private async renderWorkflowRuns(runs: WorkflowRun[]) {
    // Removed itemHeight and height-based calculation for numToDisplay
    const numToDisplay = 10; // Always aim to render up to 10 runs

    this.runsContainer.innerHTML = "";

    const uniqueRuns = runs.reduce<WorkflowRun[]>((acc, run) => {
      if (!acc.find(r => r.id === run.id)) {
        acc.push(run);
      }
      return acc;
    }, []);

    const runsToRender = uniqueRuns.slice(0, numToDisplay);

    if (!runsToRender.length) {
      this.runsContainer.innerHTML = '<div class="recent-runs-widget__error">No workflow runs found</div>';
      return;
    }

    for (const run of runsToRender) {
      // Removed the check for 'final-aggregated-results' artifact existence here.
      // This check should happen during the background sync process before caching.
      // Assume if a run is in the cache, it's valid to display.
      try {
        const runElement = document.createElement("div");
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

      let statusColor = '#63e6be';
      let runDetail = "";

      // --- Read inputs ONLY from cache ---
      const inputs = await getWorkflowInputs(String(run.id));
      // console.log(`[Run ${run.id}] Read inputs from cache:`, JSON.stringify(inputs)); // DEBUG

      // --- Determine display details based on cached inputs ---
      let organizations: string[] = [];
      // console.log(`[Run ${run.id}] Final inputs object for display:`, JSON.stringify(inputs)); // DEBUG
      if (inputs?.organization) {
        organizations = Array.isArray(inputs.organization)
          ? inputs.organization.map((o: string) => o.trim())
          : [String(inputs.organization).trim()]; // Ensure it's treated as a string array
        // console.log(`[Run ${run.id}] Found organizations for display:`, organizations); // DEBUG
      }

      const repo = inputs?.repository || inputs?.repo;
      // console.log(`[Run ${run.id}] Found repo for display:`, repo); // DEBUG

      // If we have multiple orgs, join them with commas
      const displayOrgs = organizations.join(", ");

      if (displayOrgs && repo) {
        runDetail = `${displayOrgs}/${repo}`;
      } else if (displayOrgs) {
        runDetail = displayOrgs;
      } else if (inputs === undefined || inputs === null) {
        // If inputs are not yet cached, show a placeholder
        runDetail = "Loading details...";
        statusColor = "#fab005"; // Use a neutral/warning color
      } else {
        // Inputs are cached but don't contain org/repo
        runDetail = "⚠ Unknown Report";
        statusColor = "#ff6b6b"; // Error color
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
      } catch (error) {
        console.error(`Error rendering run ${run.id}:`, error);
        // Skip this run if we encounter any errors
        continue;
      }
    }
  }
}

customElements.define("recent-runs-widget", RecentRunsWidget);
