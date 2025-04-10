declare const vi: any;

import { expect, test } from "bun:test";
import * as saveModule from "../src/db/save-artifact";
import * as downloadModule from "../src/download-artifact-zip";
import { downloadAndStoreArtifacts } from "../src/download-artifacts";
import * as fetchModule from "../src/fetch-artifacts-list";
import * as utils from "../src/utils";

test("downloads and stores all artifacts for a run", async () => {
  const runId = "14256285394";
  vi.spyOn(utils, "getRunIdFromQuery").mockReturnValue(runId);

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

  vi.spyOn(fetchModule, "fetchArtifactsList").mockResolvedValue(mockArtifacts as any);

  vi.spyOn(downloadModule, "downloadArtifactZip").mockImplementation(async () => new Blob(["dummy content"]));

  const saveSpy = vi.spyOn(saveModule, "saveArtifact").mockResolvedValue(undefined);

  await downloadAndStoreArtifacts();

  expect(fetchModule.fetchArtifactsList).toHaveBeenCalledWith(runId);
  expect(downloadModule.downloadArtifactZip).toHaveBeenCalledTimes(3);
  expect(saveSpy).toHaveBeenCalledTimes(3);
  expect(saveSpy).toHaveBeenCalledWith("artifact-one", expect.any(Blob));
  expect(saveSpy).toHaveBeenCalledWith("artifact-two", expect.any(Blob));
  expect(saveSpy).toHaveBeenCalledWith("artifact-three", expect.any(Blob));
});
