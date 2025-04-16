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
  private visibleRuns: WorkflowRun[] = [];
  private allRuns: WorkflowRun[] = [];
  private currentBatchSize = 0;
  private isPortrait = false;
  private isLoadingMore = false;
  private resizeObserver: ResizeObserver;

  constructor() {
    super();
    console.log('RecentRunsWidget version: 2025-04-16-21:48');

    this.container = document.createElement("div");
    this.container.className = "recent-runs-widget";

    this.runsContainer = document.createElement("div");
    this.container.appendChild(this.runsContainer);

    // Add title
    const title = document.createElement("div");
    title.textContent = "Recent Reports";
    title.className = "recent-runs-widget__title";
    this.container.insertBefore(title, this.runsContainer);

    // Initialize ResizeObserver
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.handleResize(entry.contentRect);
      }
    });

    this.loadWorkflowRuns();
  }

  connectedCallback() {
    this.appendChild(this.container);
    this.resizeObserver.observe(this.runsContainer);
    this.checkOrientation();
    this.setupScrollHandlers();
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

  private handleResize(rect: DOMRectReadOnly) {
    this.isPortrait = rect.width < rect.height;
    this.updateScrollBehavior();
  }

  private checkOrientation() {
    const rect = this.runsContainer.getBoundingClientRect();
    this.isPortrait = rect.width < rect.height;
    this.updateScrollBehavior();
  }

  private calculateVisibleItems(): number {
    if (!this.runsContainer.firstChild) return 5;

    const containerHeight = this.runsContainer.clientHeight;
    const firstRun = this.runsContainer.firstChild as HTMLElement;
    const runHeight = firstRun.offsetHeight;

    return Math.max(5, Math.ceil(containerHeight / runHeight));
  }

  private updateScrollBehavior() {
    if (this.isPortrait) {
      this.runsContainer.style.overflowX = 'auto';
      this.runsContainer.style.overflowY = 'hidden';
    } else {
      this.runsContainer.style.overflowY = 'auto';
      this.runsContainer.style.overflowX = 'hidden';
    }
  }

  private setupScrollHandlers() {
    this.runsContainer.addEventListener('scroll', () => {
      if (this.isLoadingMore) return;

      if (this.isPortrait) {
        // Check if scrolled near right edge
        const scrollLeft = this.runsContainer.scrollLeft;
        const scrollWidth = this.runsContainer.scrollWidth;
        const clientWidth = this.runsContainer.clientWidth;

        if (scrollLeft + clientWidth >= scrollWidth - 100) {
          this.loadMoreRuns();
        }
      } else {
        // Check if scrolled near bottom
        const scrollTop = this.runsContainer.scrollTop;
        const scrollHeight = this.runsContainer.scrollHeight;
        const clientHeight = this.runsContainer.clientHeight;

        if (scrollTop + clientHeight >= scrollHeight - 100) {
          this.loadMoreRuns();
        }
      }
    });
  }

  private async loadMoreRuns() {
    if (this.visibleRuns.length >= this.allRuns.length) return;

    this.isLoadingMore = true;

    try {
      // Show loading indicator
      const loader = document.createElement('div');
      loader.className = 'recent-runs-widget__loading';
      loader.innerHTML = '<div class="recent-runs-widget__spinner"></div>';
      this.runsContainer.appendChild(loader);

      // Load next batch
      const nextBatchSize = this.isPortrait ? 5 : this.calculateVisibleItems();
      const nextBatch = this.allRuns.slice(
        this.visibleRuns.length,
        this.visibleRuns.length + nextBatchSize
      );

      // Remove loader
      this.runsContainer.removeChild(loader);

      // Render new runs
      for (const run of nextBatch) {
        await this.renderRun(run);
      }

      this.visibleRuns = [...this.visibleRuns, ...nextBatch];
      this.currentBatchSize += nextBatchSize;
    } finally {
      this.isLoadingMore = false;
    }
  }

  private async renderRun(run: WorkflowRun): Promise<void> {
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

      const inputs = await getWorkflowInputs(String(run.id));
      let organizations: string[] = [];
      if (inputs?.organization) {
        organizations = Array.isArray(inputs.organization)
          ? inputs.organization.map((o: string) => o.trim())
          : [String(inputs.organization).trim()];
      }

      const repo = inputs?.repository || inputs?.repo;
      const displayOrgs = organizations.join(", ");

      if (displayOrgs && repo) {
        runDetail = `${displayOrgs}/${repo}`;
      } else if (displayOrgs) {
        runDetail = displayOrgs;
      } else if (inputs === undefined || inputs === null) {
        runDetail = "Loading details...";
        statusColor = "#fab005";
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
    } catch (error) {
      console.error(`Error rendering run ${run.id}:`, error);
    }
  }

  private async renderWorkflowRuns(runs: WorkflowRun[]) {
    console.log('Original runs count:', runs.length);

    this.allRuns = runs.reduce<WorkflowRun[]>((acc, run) => {
      if (!acc.find(r => r.id === run.id)) {
        acc.push(run);
      }
      return acc;
    }, []);

    console.log('Unique runs count:', this.allRuns.length);
    console.log('Current orientation:', this.isPortrait ? 'portrait' : 'landscape');

    // Always load all available runs
    this.currentBatchSize = this.allRuns.length;
    this.visibleRuns = this.allRuns.slice(0, this.currentBatchSize);

    console.log('Will display runs:', this.visibleRuns.length);

    this.runsContainer.innerHTML = "";

    if (!this.visibleRuns.length) {
      this.runsContainer.innerHTML = '<div class="recent-runs-widget__error">No workflow runs found</div>';
      return;
    }

    for (const run of this.visibleRuns) {
      await this.renderRun(run);
    }

    console.log('Finished rendering runs');
  }
}

customElements.define("recent-runs-widget", RecentRunsWidget);
