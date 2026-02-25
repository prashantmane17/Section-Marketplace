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

  // Use GraphQL for asset uploads
  const url = `https://${session.shop}/admin/api/2025-01/graphql.json`;

  const mutation = `
    mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
      themeFilesUpsert(themeId: $themeId, files: $files) {
        upsertedThemeFiles {
          filename
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    themeId: `gid://shopify/OnlineStoreTheme/${themeId}`,
    files: [
      {
        filename: assetKey,
        body: { type: "TEXT", value: section.liquid }
      }
    ]
  };

  const uploadResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify({ query: mutation, variables })
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    console.error(`[installSection] HTTP Error ${uploadResponse.status}:`, text);
    throw new Error(`Failed to upload section HTTP (${uploadResponse.status}): ${text}`);
  }

  const result = await uploadResponse.json();
  console.log(`[installSection] GraphQL Result for ${section.slug}:`, JSON.stringify(result, null, 2));

  const errors = result.data?.themeFilesUpsert?.userErrors || [];

  if (errors.length > 0) {
    const errorMsg = errors.map(e => e.message).join(", ");
    console.error(`[installSection] UserErrors:`, errorMsg);
    throw new Error(`Failed to upload section: ${errorMsg}`);
  }

  return { assetKey, result };
}

export async function removeSection(session, themeId, sectionSlug) {
  const assetKey = `sections/${sectionSlug}.liquid`;

  const url = `https://${session.shop}/admin/api/2025-01/graphql.json`;

  const mutation = `
    mutation themeFilesDelete($themeId: ID!, $files: [String!]!) {
      themeFilesDelete(themeId: $themeId, files: $files) {
        deletedThemeFiles {
          filename
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    themeId: `gid://shopify/OnlineStoreTheme/${themeId}`,
    files: [assetKey]
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify({ query: mutation, variables })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to remove section HTTP (${response.status}): ${text}`);
  }

  const result = await response.json();
  const errors = result.data?.themeFilesDelete?.userErrors || [];

  if (errors.length > 0) {
    // 404s (file not found) in REST were ignored, but GraphQL might error. We log it but don't crash if it's already gone.
    if (errors.some(e => e.message.toLowerCase().includes("not found"))) {
      return;
    }
    throw new Error(`Failed to remove section: ${errors.map(e => e.message).join(", ")}`);
  }
}


// ─── Custom error types ───────────────────────────────────────────────────────

export class OS2ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "OS2ValidationError";
  }
}
