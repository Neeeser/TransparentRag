/**
 * Flow: an admin downloads the backend diagnostics bundle from Settings, and
 * the file is well-formed and redacted (scenario: diagnostics-mismatch).
 *
 * 1. Log in via the API (the seeded user is an admin) and run the seeded query
 *    once so the buffer holds a real request/failure chain to export.
 * 2. Open Admin -> Settings and download the diagnostics bundle.
 * 3. Assert the file parses as { metadata, records }, reports an effective log
 *    level (never null), and its records include structured HTTP events.
 * 4. Assert redaction: the login email, password, and JWT never appear in the
 *    bundle — the export can only contain what redacted stdout could.
 */
import { readFileSync } from "fs";

import { expect, test } from "@playwright/test";

import { loadHandoff, loginViaApi, seededLink } from "../helpers";

interface DiagnosticsBundle {
  metadata: {
    log_level: string | null;
    record_count: number;
    buffer_capacity: number;
    note: string;
  };
  records: { event?: string }[];
}

test("admin downloads a well-formed, redacted diagnostics bundle", async ({ page }) => {
  const handoff = loadHandoff();
  await loginViaApi(page);

  // 1. Drive one real (failing) query so the buffer has a request chain.
  await page.goto(`${seededLink(handoff, "collection")}/search`);
  await page.getByLabel("Search query").fill("aurora station power");
  await page.getByRole("button", { name: "Run query" }).click();
  await expect(page.getByText(/Retrieval failed/)).toBeVisible({ timeout: 60_000 });

  // 2. Download the bundle from Admin -> Settings.
  await page.goto("/admin/settings");
  const downloadButton = page.getByRole("button", { name: "Download diagnostics" });
  await expect(downloadButton).toBeVisible({ timeout: 20_000 });
  const downloadPromise = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^ragworks-diagnostics-.*\.json$/);

  const filePath = await download.path();
  const bundle = JSON.parse(readFileSync(filePath, "utf-8")) as DiagnosticsBundle;

  // 3. Shape: metadata header + records array, effective level, real events.
  expect(bundle.metadata.log_level).toBeTruthy(); // never a null override
  expect(bundle.metadata.buffer_capacity).toBeGreaterThan(0);
  expect(bundle.metadata.record_count).toBe(bundle.records.length);
  const events = bundle.records.map((r) => r.event);
  expect(events).toContain("http.request.completed");

  // 4. Redaction: no credentials or identifiers leak into the export.
  const raw = JSON.stringify(bundle);
  expect(raw).not.toContain(handoff.email ?? "sandbox@ragworks.dev");
  expect(raw).not.toContain(handoff.password ?? "ragworks-sandbox");
  expect(raw).not.toContain("Bearer ");
  expect(raw).not.toContain(handoff.token?.slice(0, 20) ?? "eyJhbGci");
});
