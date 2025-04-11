import { getArtifact } from "./db/get-artifact";
import { downloadAndStoreArtifacts } from "./download-artifacts";
import { getRunIdFromQuery } from "./utils";

console.log("Hello from TypeScript!");

const runId = getRunIdFromQuery();
console.log("Run ID detected in main.ts:", runId);

const heading = document.querySelector("h1");
if (heading) {
  heading.textContent = "Hello from bundled TypeScript!";
}

// Create a div for displaying results
const resultsDiv = document.createElement('div');
resultsDiv.id = 'results';
document.body.appendChild(resultsDiv);

async function showResults() {
  const artifactNames = [
    "results-ubiquity-os-marketplace",
    "results-ubiquity-os",
    "results-ubiquity"
  ];

  for (const name of artifactNames) {
    console.log(`Fetching artifact from IndexedDB: ${name}`);
    const blob = await getArtifact(name);
    if (blob) {
      console.log(`Found blob for ${name}, size:`, blob.size);
      const text = await blob.text();
      console.log(`Content for ${name}:`, text);

      const data = JSON.parse(text);
      console.log(`Raw data for ${name}:`, data);

      // Handle both array and single object cases, and flatten if needed
      let results = [];
      if (Array.isArray(data)) {
        results = data.flat();
      } else if (typeof data === 'object' && data !== null) {
        results = [data];
      }
      console.log(`Processed ${results.length} results for ${name}`);

      // Display in UI
      const section = document.createElement('div');
      section.className = 'results-section';

      const header = document.createElement('h2');
      header.textContent = name;
      section.appendChild(header);

      const count = document.createElement('p');
      count.textContent = `Total Results: ${results.length}`;
      section.appendChild(count);

      const list = document.createElement('ul');
      list.className = 'results-list';

      results.forEach((item: any) => {
        const li = document.createElement('li');
        li.className = 'result-item';
        li.innerHTML = `
          <strong>${item.repository || 'Unknown Repo'}#${item.issue_number || 'N/A'}</strong>
          <p>${item.title || 'No Title'}</p>
        `;
        list.appendChild(li);
      });

      section.appendChild(list);
      resultsDiv.appendChild(section);
    } else {
      console.log(`No data found for ${name}`);
    }
  }
}

// Wait for data to be stored then show it
await downloadAndStoreArtifacts();
await showResults();
