import { expect, mock, spyOn, test } from "bun:test";
import { strToU8, zipSync } from "fflate";
import type { AggregatedResultEntry } from "../src/data-transform";
import * as artifactStorage from "../src/db/save-artifact";

// Capture the worker's registered handler for direct invocation in Bun.
const originalOnMessage = self.onmessage;
await import("../src/workers/artifact-processor");
const handleArtifactMessage = self.onmessage;
self.onmessage = originalOnMessage;

test("downloads and stores the final aggregated artifact for a run", async () => {
  const runId = "14256285394";
  const metadataUrl = `/api/artifacts?runId=${runId}`;
  const downloadUrl = `/api/download-artifact?id=42&run=${runId}`;
  const entry: AggregatedResultEntry = {
    org: "example-org",
    repo: "example-repo",
    issueId: "7",
    metadata: {
      contributor: {
        userId: 123,
        total: 5,
        task: null,
        comments: [{ id: 1, timestamp: "2025-04-12T00:00:00Z", score: { reward: 5 } }],
        evaluationCommentHtml: null,
      },
    },
  };
  const archive = zipSync({ "aggregated_results.json": strToU8(JSON.stringify([entry])) });
  const expected = { "example-org/example-repo": { "7": entry.metadata } };

  const originalFetch = globalThis.fetch;
  const fetchMock = mock(async (url: Parameters<typeof fetch>[0]) => {
    switch (url) {
      case metadataUrl:
        return Response.json({
          artifacts: [
            { id: 1, name: "other-results" },
            { id: 42, name: "final-aggregated-results" },
          ],
        });
      case downloadUrl:
        return new Response(archive);
      default:
        throw new Error(`Unexpected fetch: ${url}`);
    }
  });
  const saveMock = spyOn(artifactStorage, "saveArtifact").mockResolvedValue(undefined);
  const postMessageMock = spyOn(self, "postMessage").mockImplementation(() => {});

  try {
    globalThis.fetch = Object.assign(fetchMock, {
      preconnect() {
        throw new Error("Unexpected fetch.preconnect call");
      },
    });
    if (!handleArtifactMessage) throw new Error("The artifact worker did not register a message handler");
    await handleArtifactMessage.call(self, new MessageEvent("message", { data: { type: "process-artifacts", runId } }));

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([metadataUrl, downloadUrl]);
    expect(saveMock).toHaveBeenCalledTimes(1);
    const [savedRunId, savedBlob] = saveMock.mock.calls[0];
    expect(savedRunId).toBe(runId);
    expect(savedBlob).toBeInstanceOf(Blob);
    expect(JSON.parse(await savedBlob.text())).toEqual(expected);
    expect(postMessageMock).toHaveBeenLastCalledWith({ type: "complete", data: { [runId]: expected } });
  } finally {
    postMessageMock.mockRestore();
    saveMock.mockRestore();
    globalThis.fetch = originalFetch;
  }
});
