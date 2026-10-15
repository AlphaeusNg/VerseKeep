import { expect } from "@playwright/test";

/** Open a collapsed disclosure without toggling it shut when it is already open. */
export async function openDetails(page, selector) {
  const details = page.locator(selector);
  await expect(details).toBeAttached();
  if (await details.evaluate((node) => node.open)) return;
  await details.locator("> summary").click();
  await expect(details).toHaveJSProperty("open", true);
}

export async function openMedOptions(page) {
  await openDetails(page, "#med-options");
}

export async function openTopics(page) {
  await openDetails(page, "#topics-disclosure");
}

export async function openTopicTools(page) {
  await openTopics(page);
  await openDetails(page, "#topic-tools");
}

export async function openBooks(page) {
  await openDetails(page, "#books-disclosure");
}

export async function openMemorize(page) {
  await openDetails(page, "#memorize-disclosure");
}

/** More is a button panel. Focus mode hides it and parks Exit focus in the primary row. */
export async function openMedMore(page) {
  const more = page.locator("#med-more");
  if (!(await more.isVisible())) return;
  if ((await more.getAttribute("aria-expanded")) === "true") return;
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
}
