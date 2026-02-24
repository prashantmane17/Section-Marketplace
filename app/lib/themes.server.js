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

/**
 * Fetch all themes for the store.
 * Returns an array sorted: published first.
 *
 * @param {object} admin  - admin object from authenticate.admin(request)
 * @returns {Promise<Array<{id: string, name: string, role: string}>>}
 */
export async function getThemes(admin) {
  const response = await admin.rest.get({ path: "themes" });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify themes list failed (${response.status}): ${text}`);
  }

  const { themes } = await response.json();

  // Sort: published/main theme first
  return themes.sort((a, b) => {
    if (a.role === "main") return -1;
    if (b.role === "main") return 1;
    return 0;
  });
}

/**
 * Returns the published (main) theme.
 * Throws if no published theme found.
 *
 * @param {object} admin
 * @returns {Promise<{id: string, name: string, role: string}>}
 */
export async function getMainTheme(admin) {
  const themes = await getThemes(admin);
  const main = themes.find((t) => t.role === "main");

  if (!main) {
    throw new Error("No published theme found in this store.");
  }

  return main;
}

/**
 * Validate that a theme is OS 2.0-compatible.
 *
 * Strategy: attempt to fetch templates/index.json from the theme's assets.
 *   - OS 2.0 themes use JSON templates → templates/index.json EXISTS
 *   - OS 1.0 themes use Liquid templates → templates/index.json is MISSING
 *
 * @param {object} admin
 * @param {string|number} themeId
 * @returns {Promise<{ isOS2: boolean; reason: string }>}
 */
export async function validateOS2(admin, themeId) {
  const response = await admin.rest.get({
    path:  `themes/${themeId}/assets`,
    query: { "asset[key]": "templates/index.json" },
  });

  // 200 → asset exists → OS 2.0 ✓
  if (response.ok) {
    return { isOS2: true, reason: "Theme uses JSON templates (OS 2.0 confirmed)." };
  }

  // 404 → asset missing → not OS 2.0
  if (response.status === 404) {
    return {
      isOS2:  false,
      reason: "This theme does not use JSON templates. Only Online Store 2.0 themes are supported.",
    };
  }

  // Unexpected error
  const text = await response.text();
  throw new Error(`OS 2.0 validation failed (${response.status}): ${text}`);
}

/**
 * Check if a section asset already exists in the theme.
 *
 * @param {object} admin
 * @param {string|number} themeId
 * @param {string} sectionSlug   e.g. "hero-banner"
 * @returns {Promise<boolean>}
 */
export async function sectionExists(admin, themeId, sectionSlug) {
  const assetKey = `sections/${sectionSlug}.liquid`;
  const response = await admin.rest.get({
    path:  `themes/${themeId}/assets`,
    query: { "asset[key]": assetKey },
  });
  return response.ok;
}

/**
 * Install a section Liquid file into the theme's /sections directory.
 *
 * Steps:
 *  1. Validate the theme is OS 2.0
 *  2. Upload the Liquid file via REST PUT
 *
 * @param {object} admin
 * @param {string|number} themeId
 * @param {{ slug: string; name: string; liquid: string }} section
 * @returns {Promise<{ assetKey: string }>}
 */
export async function installSection(admin, themeId, section) {
  // ── 1. OS 2.0 guard ──────────────────────────────────────────────────────
  const { isOS2, reason } = await validateOS2(admin, themeId);
  if (!isOS2) {
    throw new OS2ValidationError(reason);
  }

  // ── 2. Upload the Liquid file ─────────────────────────────────────────────
  const assetKey = `sections/${section.slug}.liquid`;

  const uploadResponse = await admin.rest.put({
    path: `themes/${themeId}/assets`,
    data: {
      asset: {
        key:   assetKey,
        value: section.liquid,
      },
    },
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(`Failed to upload section (${uploadResponse.status}): ${text}`);
  }

  return { assetKey };
}

/**
 * Remove a section Liquid file from the theme.
 *
 * @param {object} admin
 * @param {string|number} themeId
 * @param {string} sectionSlug   e.g. "hero-banner"
 * @returns {Promise<void>}
 */
export async function removeSection(admin, themeId, sectionSlug) {
  const assetKey = `sections/${sectionSlug}.liquid`;

  const response = await admin.rest.delete({
    path:  `themes/${themeId}/assets`,
    query: { "asset[key]": assetKey },
  });

  // 200 = deleted, 404 = already gone — both are acceptable
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
