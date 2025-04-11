import { test, expect, mock } from "bun:test";
import * as utils from "../src/utils";
import * as fetchModule from "../src/fetch-artifacts-list";
import * as downloadModule from "../src/download-artifact";
import * as unzipModule from "../src/unzip-artifact";
import * as saveModule from "../src/db/save-artifact";
import { downloadAndStoreArtifacts } from "../src/download-artifacts";

test("downloads and stores all artifacts for a run", async () => {
  const runId = "14256285394";
  mock.module("../src/utils", () => ({
    getRunIdFromQuery: () => runId
  }));

  const mockArtifacts = [
    {
      id: 1,
      name: "artifact-one",
      archive_download_url: "https://example.com/artifact-one.zip",
    },
    {
      id: 2,
      name: "artifact-two",
      archive_download_url: "https://example.com/artifact-two.zip",
    },
    {
      id: 3,
      name: "artifact-three",
      archive_download_url: "https://example.com/artifact-three.zip",
    },
  ];

  // Mock the API responses
  mock.module("../src/fetch-artifacts-list", () => ({
    fetchArtifactsList: async () => mockArtifacts
  }));

  // Mock ZIP data (using a simple Uint8Array for test)
  const mockZipData = new Uint8Array([80, 75, 3, 4]); // Basic ZIP file header
  mock.module("../src/download-artifact", () => ({
    downloadArtifactZip: async () => mockZipData
  }));

  // Mock the unzip functionality
  const mockExtractedData = [{ test: "data" }];
  mock.module("../src/unzip-artifact", () => ({
    unzipArtifact: async () => mockExtractedData
  }));

  // Mock saving to IndexedDB
  let savedArtifacts: Array<[string, Blob]> = [];
  mock.module("../src/db/save-artifact", () => ({
    saveArtifact: async (name: string, blob: Blob) => {
      savedArtifacts.push([name, blob]);
    }
  }));

  await downloadAndStoreArtifacts();

  // Verify the flow
  expect(savedArtifacts.length).toBe(3);

  // Verify artifact names
  expect(savedArtifacts[0][0]).toBe("artifact-one");
  expect(savedArtifacts[1][0]).toBe("artifact-two");
  expect(savedArtifacts[2][0]).toBe("artifact-three");

  // Verify each saved item has a Blob
  savedArtifacts.forEach(([_name, blob]) => {
    expect(blob).toBeInstanceOf(Blob);
  });
});
