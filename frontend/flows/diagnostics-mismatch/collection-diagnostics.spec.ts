/**
 * Flow: collection diagnostics surface an embedding-model mismatch, and a
 * search fails with a structured, node-named error (scenario:
 * diagnostics-mismatch).
 *
 * 1. Log in via the API (auth is not the subject) and open the seeded
 *    collection's Diagnostics tab.
 * 2. Expect the embedding_model_mismatch finding, naming both models.
 * 3. On the Overview, expect the Diagnostics widget to read inconsistent.
 * 4. On the search page, run a query and expect the failure panel to name the
 *    node that broke (the retrieval embedding no longer matches the index).
 */
import { expect, test } from "@playwright/test";

import { loadHandoff, loginViaApi, seededLink } from "../helpers";

test("diagnostics flag the embedding mismatch and search fails at the retriever", async ({
  page,
}) => {
  const handoff = loadHandoff();
  await loginViaApi(page);

  // 1–2. Diagnostics tab shows the mismatch finding with both model names.
  await page.goto(seededLink(handoff, "diagnostics"));
  await expect(page.getByText("Embedding models differ")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("openai/text-embedding-3-small").first()).toBeVisible();
  await expect(page.getByText("openai/text-embedding-3-large").first()).toBeVisible();

  // 3. Overview widget summarizes the state as inconsistent.
  await page.goto(seededLink(handoff, "collection"));
  await expect(page.getByText("Issues found")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/\d+ error/)).toBeVisible();

  // 4. A real search fails at the retriever with a structured, node-named error.
  await page.goto(`${seededLink(handoff, "collection")}/search`);
  await page.getByLabel("Search query").fill("How is power generated aboard Aurora Station?");
  await page.getByRole("button", { name: "Run query" }).click();
  await expect(page.getByText(/Retrieval failed/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Failed at/)).toBeVisible();
});
