import { getArtifact } from "./db/get-artifact";
import { downloadAndStoreArtifacts } from "./download-artifacts";
import { getRunIdFromQuery } from "./utils";

// UI Elements
const statusEl = document.getElementById('status') as HTMLDivElement;
const progressFillEl = document.getElementById('progress-fill') as HTMLDivElement;
const progressTextEl = document.getElementById('progress-text') as HTMLDivElement;
const errorContainerEl = document.getElementById('error-container') as HTMLDivElement;
const errorMessageEl = document.getElementById('error-message') as HTMLDivElement;
const retryButtonEl = document.getElementById('retry-button') as HTMLButtonElement;
const artifactsContainerEl = document.getElementById('artifacts-container') as HTMLDivElement;
const artifactsListEl = document.getElementById('artifacts-list') as HTMLUListElement;
const resultsContainerEl = document.getElementById('results-container') as HTMLDivElement;
const resultsEl = document.getElementById('results') as HTMLDivElement;

// UI Update Functions
function updateStatus(message: string): void {
  statusEl.textContent = message;
}

function updateProgress(percent: number): void {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  progressFillEl.style.width = `${clampedPercent}%`;
  progressTextEl.textContent = `${Math.round(clampedPercent)}%`;
}

function showError(message: string): void {
  errorMessageEl.textContent = message;
  errorContainerEl.classList.remove('hidden');
  console.error(`[ERROR] ${message}`);
}

function hideError(): void {
  errorContainerEl.classList.add('hidden');
}

function setLoading(isLoading: boolean): void {
  if (isLoading) {
    document.body.classList.add('loading');
  } else {
    document.body.classList.remove('loading');
  }
}

// Main Application
async function init() {
  updateStatus('Initializing...');
  updateProgress(0);
  hideError();

  try {
    const runId = getRunIdFromQuery();
    if (!runId) {
      showError('No run ID found in URL. Add ?run=test to the URL to load test data.');
      return;
    }

    updateStatus(`Starting artifact download (Run ID: ${runId})...`);

    // Set up progress callback
    const onProgress = (phase: string, percent: number, detail?: string) => {
      let message = `${phase}: ${Math.round(percent)}%`;
      if (detail) {
        message += ` - ${detail}`;
      }
      updateStatus(message);
      updateProgress(percent);
    };

    // Set up error callback
    const onError = (error: Error) => {
      showError(`Failed to process artifacts: ${error.message}`);
      updateProgress(0);
      updateStatus('Error occurred');
    };

    // Download and unzip artifacts
    await downloadAndStoreArtifacts(onProgress, onError);

    // Show the artifacts once they're loaded
    await showResults();

    updateStatus('All artifacts processed successfully');
    updateProgress(100);
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : 'Unknown error occurred';
    showError(`An unexpected error occurred: ${errorMessage}`);
    updateProgress(0);
    updateStatus('Error occurred');
  }
}

// Display results from downloaded data
async function showResults() {
  updateStatus('Processing artifacts...');
  resultsEl.innerHTML = '';

  // Download and process all artifacts
  const artifacts = await downloadAndStoreArtifacts(
    (phase, percent, detail) => {
      let message = `${phase}: ${Math.round(percent)}%`;
      if (detail) {
        message += ` - ${detail}`;
      }
      updateStatus(message);
      updateProgress(percent);
    },
    (error) => {
      showError(`Failed to process artifacts: ${error.message}`);
      updateProgress(0);
      updateStatus('Error occurred');
    }
  );

  // Create a global object to store the data for exploration
  (window as any).artifactsData = {};
  artifacts.forEach(artifact => {
    (window as any).artifactsData[artifact.name] = artifact.data;
  });

  console.log('%c✨ Developer Note: Access all artifacts data via window.artifactsData', 'color: #00c853; font-weight: bold;');

  // Display raw data for verification
  artifacts.forEach(artifact => {
    const section = document.createElement('div');
    section.className = 'results-section';

    const header = document.createElement('h2');
    header.textContent = artifact.name;
    section.appendChild(header);

    const count = document.createElement('p');
    count.textContent = `Total Results: ${artifact.data.length}`;
    section.appendChild(count);

    const list = document.createElement('ul');
    list.className = 'results-list';

    // Simply dump raw JSON data
    const li = document.createElement('li');
    li.className = 'result-item';
    li.innerHTML = `<pre>${JSON.stringify(artifact.data, null, 2)}</pre>`;
    list.appendChild(li);

    section.appendChild(list);
    resultsEl.appendChild(section);

  });

  if (artifacts.length > 0) {
    resultsContainerEl.classList.remove('hidden');
    updateStatus(`Displaying ${artifacts.length} artifacts`);
  } else {
    showError('No artifacts found. Try again with the retry button.');
  }
}

// Event listeners
retryButtonEl.addEventListener('click', () => {
  hideError();
  init();
});

// Start the application
init();
