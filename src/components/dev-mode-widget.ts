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
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1a1a1a;
      color: #fff;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 14px;
      z-index: 9999;
      max-width: 400px;
      max-height: 600px;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      border: 1px solid #333;
    `;

    this.runsContainer = document.createElement("div");
    this.container.appendChild(this.runsContainer);

    // Add title
    const title = document.createElement("div");
    title.textContent = "Development Mode";
    title.style.cssText = `
      font-weight: bold;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #333;
    `;
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
      this.runsContainer.innerHTML = '<div style="color: #ff6b6b;">Error loading workflow runs</div>';
    }
  }

  private renderWorkflowRuns(runs: any[]) {
    this.runsContainer.innerHTML = "";

    if (!runs.length) {
      this.runsContainer.innerHTML = '<div style="color: #ff6b6b;">No workflow runs found</div>';
      return;
    }

    runs.forEach(run => {
      const runElement = document.createElement("div");
      runElement.className = "workflow-run";
      runElement.style.cssText = `
        margin: 8px 0;
        padding: 8px;
        border-radius: 4px;
        background: ${this.currentRunId === String(run.id) ? "#333" : "#222"};
        cursor: pointer;
        transition: background 0.2s;
      `;

      const timestamp = new Date(run.created_at).toLocaleString();
      const inputs = run.inputs || {};
      const organization = inputs.organization || "ubiquity orgs";
      const repo = inputs.repo || "all repos";
      const email = inputs.notification_email || "no email";

      runElement.innerHTML = `
        <div style="margin-bottom: 4px;">
          <span style="color: #66d9e8;">Run #${run.id}</span>
          <span style="color: #868e96; font-size: 12px;"> - ${timestamp}</span>
        </div>
        <div style="color: #63e6be; font-size: 12px;">Org: ${organization}</div>
        <div style="color: #63e6be; font-size: 12px;">Repo: ${repo}</div>
        <div style="color: #63e6be; font-size: 12px;">Email: ${email}</div>
      `;

      runElement.addEventListener("mouseover", () => {
        runElement.style.background = "#2a2a2a";
      });

      runElement.addEventListener("mouseout", () => {
        runElement.style.background = this.currentRunId === String(run.id) ? "#333" : "#222";
      });

      runElement.addEventListener("click", () => {
        window.location.href = `/?run=${run.id}`;
      });

      this.runsContainer.appendChild(runElement);
    });
  }
}

customElements.define("dev-mode-widget", DevModeWidget);
