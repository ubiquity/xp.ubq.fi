import { isProduction } from "../utils";

export class DevModeWidget extends HTMLElement {
  private container!: HTMLDivElement;
  private runsContainer!: HTMLDivElement;
  private currentRunId: string | null = null;

  constructor() {
    super();
    if (isProduction()) return;

    this.container = document.createElement("div");
    this.container.className = "dev-mode-widget";

    this.runsContainer = document.createElement("div");
    this.container.appendChild(this.runsContainer);

    // Add title
    const title = document.createElement("div");
    title.textContent = "Development Mode";
    title.className = "dev-mode-widget__title";
    this.container.insertBefore(title, this.runsContainer);

    this.loadWorkflowRuns();
  }

  connectedCallback() {
    if (!isProduction()) {
      document.body.appendChild(this.container);
    }
  }

  disconnectedCallback() {
    if (!isProduction() && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  private async loadWorkflowRuns() {
    try {
      const response = await fetch("/api/workflow-runs");
      if (!response.ok) throw new Error("Failed to fetch workflow runs");

      const data = await response.json();
      this.renderWorkflowRuns(data.workflow_runs);
    } catch (error) {
      console.error("Error loading workflow runs:", error);
      this.runsContainer.innerHTML = '<div class="dev-mode-widget__error">Error loading workflow runs</div>';
    }
  }

  private renderWorkflowRuns(runs: any[]) {
    this.runsContainer.innerHTML = "";

    if (!runs.length) {
      this.runsContainer.innerHTML = '<div class="dev-mode-widget__error">No workflow runs found</div>';
      return;
    }

    runs.forEach(run => {
      const runElement = document.createElement("div");
      runElement.className = "workflow-run";
      runElement.className = `workflow-run${this.currentRunId === String(run.id) ? ' workflow-run--active' : ''}`;

      const timestamp = new Date(run.created_at).toLocaleString();
      const inputs = run.inputs || {};
      const organization = inputs.organization || "ubiquity orgs";
      const repo = inputs.repo || "all repos";
      const email = inputs.notification_email || "no email";

      let statusColor = "#63e6be"; // Default green
      let runDetail = "Processing...";

      if (run.repository) {
        runDetail = `${run.repository}${run.issueId ? `#${run.issueId}` : ''}`;
      } else if (run.conclusion === "completed") {
        runDetail = "No repository found";
        statusColor = "#ff6b6b"; // Red for error
      }

      runElement.innerHTML = `
        <div class="workflow-run__header">
          <span class="workflow-run__id">Run #${run.id}</span>
          <span class="workflow-run__timestamp">${timestamp}</span>
        </div>
        <div class="workflow-run__detail" style="color: ${statusColor}">
          ${runDetail}
        </div>
      `;

      runElement.addEventListener("mouseover", () => {
        // Hover state is handled by CSS
      });

      runElement.addEventListener("mouseout", () => {
        // Background is handled by CSS classes
      });

      runElement.addEventListener("click", () => {
        window.location.href = `/?run=${run.id}`;
      });

      this.runsContainer.appendChild(runElement);
    });
  }
}

customElements.define("dev-mode-widget", DevModeWidget);
