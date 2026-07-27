import { expect, test, type Page } from "@playwright/test";

// One real end-to-end pass through the golden path, against a real LLM (tech-design.md §15).
// No mocking — the point is proving the whole stack actually works together, not just each
// piece in isolation. Every step waits on a real UI signal, never a fixed sleep.
async function sendAndWaitForReply(page: Page, text: string) {
  await page.getByPlaceholder("Message Parcel Pilot…").fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status", { name: "Parcel Pilot is responding" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("status", { name: "Parcel Pilot is responding" })).toBeHidden({ timeout: 30_000 });
}

test("landing → track → verify → file a claim → confirm → traces shows the run", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/");
  await expect(page.getByText("Your delivery, sorted in one conversation.")).toBeVisible();

  // Copy a demo tracking number straight off the landing page — proves the button actually works,
  // not just that it renders.
  await page.getByRole("button", { name: "Copy SS-7130-DEMO" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe("SS-7130-DEMO");

  await page.getByRole("link", { name: "Try the demo" }).click();
  await page.waitForURL(/\/chat\/.+/);

  await sendAndWaitForReply(page, "Track SS-7130-DEMO");
  await sendAndWaitForReply(page, "7742");
  // Imperative phrasing ("file a damage claim now"), not a softer "I'd like to" — real users write
  // this way, and it's also more reliable at getting a one-shot tool call instead of a clarifying
  // question. sendAndWaitForReply already waits out the full response cycle, so by the time it
  // returns the model has had its full turn — no need for a separate pre-check/nudge race that
  // risks a confusing double-interaction if it fires while a slower response is still landing.
  await sendAndWaitForReply(page, "File a damage claim for this shipment right now — the box was crushed.");

  const confirmButton = page.getByRole("button", { name: "Confirm change" });
  await expect(confirmButton).toBeVisible({ timeout: 15_000 });
  await confirmButton.click();

  // The confirmation number is the one genuinely unique signal here — unlike a heading like "Claim
  // filed", it can't collide with unrelated text (e.g. a timeline event summary that happens to
  // also mention the claim).
  await expect(page.getByText(/Confirmation #CLM-/)).toBeVisible({ timeout: 10_000 });

  const chatUrl = page.url();
  const chatId = chatUrl.split("/chat/")[1];

  await page.goto("/traces");
  // One row per turn by design (see tech-design.md's traces/[id] note), not one row per chat —
  // several are expected here since the conversation had multiple turns.
  await expect(page.getByText(chatId, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
  expect(await page.getByText(chatId, { exact: false }).count()).toBeGreaterThan(0);
});
