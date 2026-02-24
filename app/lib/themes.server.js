/**
 * themes.server.js — Shopify Theme API utilities
 *
 * ALL functions in this file run server-side only (inside loaders/actions).
 * The merchant's access token is never exposed to the browser.
 *
 * Admin REST API docs:
 *   https://shopify.dev/docs/api/admin-rest/latest/resources/theme
 *   https://shopify.dev/docs/api/admin-rest/latest/resources/asset
 */

export async function getThemes(session) {
  const url = `https://${session.shop}/admin/api/2025-01/themes.json`;
  const response = await fetch(url, {
    headers: { "X-Shopify-Access-Token": session.accessToken },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify themes list failed (${response.status}): ${text}`);
  }
  const { themes } = await response.json();
  return themes.sort((a, b) => {
    if (a.role === "main") return -1;
    if (b.role === "main") return 1;
    return 0;
  });
}

export async function getMainTheme(session) {
  const themes = await getThemes(session);
  const main = themes.find((t) => t.role === "main");
  if (!main) throw new Error("No published theme found in this store.");
  return main;
}

export async function validateOS2(session, themeId) {
  const url = `https://${session.shop}/admin/api/2025-01/themes/${themeId}/assets.json?asset[key]=templates/index.json`;
  const response = await fetch(url, {
    headers: { "X-Shopify-Access-Token": session.accessToken },
  });
  if (response.ok) {
    return { isOS2: true, reason: "Theme uses JSON templates (OS 2.0 confirmed)." };
  }
  if (response.status === 404) {
    return {
      isOS2: false,
      reason: "This theme does not use JSON templates. Only Online Store 2.0 themes are supported.",
    };
  }
  const text = await response.text();
  throw new Error(`OS 2.0 validation failed (${response.status}): ${text}`);
}

export async function sectionExists(session, themeId, sectionSlug) {
  const assetKey = `sections/${sectionSlug}.liquid`;
  const url = `https://${session.shop}/admin/api/2025-01/themes/${themeId}/assets.json?asset[key]=${assetKey}`;
  const response = await fetch(url, {
    headers: { "X-Shopify-Access-Token": session.accessToken },
  });
  return response.ok;
}

export async function installSection(session, themeId, section) {
  const { isOS2, reason } = await validateOS2(session, themeId);
  if (!isOS2) throw new OS2ValidationError(reason);

  const assetKey = `sections/${section.slug}.liquid`;
  const url = `https://${session.shop}/admin/api/2025-01/themes/${themeId}/assets.json`;
  const uploadResponse = await fetch(url, {
    method: "PUT",
    body: JSON.stringify({
      asset: { key: assetKey, value: section.liquid },
    }),
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(`Failed to upload section (${uploadResponse.status}): ${text}`);
  }
  return { assetKey };
}

export async function removeSection(session, themeId, sectionSlug) {
  const assetKey = `sections/${sectionSlug}.liquid`;
  const url = `https://${session.shop}/admin/api/2025-01/themes/${themeId}/assets.json?asset[key]=${assetKey}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: { "X-Shopify-Access-Token": session.accessToken },
  });
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`Failed to remove section (${response.status}): ${text}`);
  }
}


// ─── Custom error types ───────────────────────────────────────────────────────

export class OS2ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "OS2ValidationError";
  }
}
