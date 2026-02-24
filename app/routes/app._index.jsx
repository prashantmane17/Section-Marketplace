/**
 * app._index.jsx — Free Section Marketplace
 *
 * SECURITY MODEL:
 *  - loader  → server-side: authenticates request, reads DB, calls Shopify Admin REST API
 *  - action  → server-side: validates OS 2.0, uploads/removes Liquid files, updates DB
 *  - Component → client-side UI only; never calls Shopify Admin API directly
 *
 * Flow:
 *  1. Merchant opens app → loader fetches their themes + installed sections from DB
 *  2. Merchant selects a theme from the dropdown
 *  3. Merchant clicks Install → action validates OS 2.0 → uploads .liquid → saves DB record
 *  4. Merchant clicks Remove → action deletes .liquid from theme → removes DB record
 *  5. Merchant adds section to storefront via Theme Customizer (manual step, not automated)
 */

import { useState } from "react";
import { useLoaderData, useFetcher, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { SECTIONS_CATALOG, getSectionBySlug } from "../lib/sections-catalog";
import { getThemes, installSection, removeSection, OS2ValidationError } from "../lib/themes.server";
import { checkRateLimit } from "../lib/rate-limiter.server";

// ─── Loader: runs server-side ──────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  // Allow merchant to pick a theme via ?themeId=... (set by the UI dropdown)
  let activeThemeId = url.searchParams.get("themeId") || null;

  // Fetch all themes from Shopify
  let themes = [];
  try {
    themes = await getThemes(admin);
  } catch (err) {
    console.error("[loader] getThemes error:", err.message);
    // Non-fatal: return empty themes, UI shows an error callout
  }

  // If no themeId in query, default to published (main) theme
  if (!activeThemeId && themes.length > 0) {
    const main = themes.find((t) => t.role === "main") ?? themes[0];
    activeThemeId = String(main.id);
  }

  const activeTheme = themes.find((t) => String(t.id) === activeThemeId) ?? themes[0] ?? null;

  // Fetch installed sections for this shop + theme from DB
  const installedRows = activeThemeId
    ? await db.installedSection.findMany({
        where: { shop: session.shop, themeId: activeThemeId },
        select: { sectionSlug: true, installedAt: true },
      })
    : [];

  const installedSlugs = new Set(installedRows.map((r) => r.sectionSlug));

  return {
    shop: session.shop,
    themes,
    activeTheme,
    catalog: SECTIONS_CATALOG.map(({ slug, name, description, category }) => ({
      slug,
      name,
      description,
      category,
      installed: installedSlugs.has(slug),
    })),
  };
};

// ─── Action: runs server-side ──────────────────────────────────────────────────
export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent      = formData.get("intent");      // "install" | "remove"
  const sectionSlug = formData.get("sectionSlug"); // e.g. "hero-banner"
  const themeId     = formData.get("themeId");     // numeric string

  // ── Input validation ────────────────────────────────────────────────────────
  if (!intent || !sectionSlug || !themeId) {
    return { error: "Missing required fields." };
  }

  const section = getSectionBySlug(sectionSlug);
  if (!section) {
    return { error: `Unknown section: ${sectionSlug}` };
  }

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(session.shop, intent);
  if (!rl.allowed) {
    return {
      error: `Too many requests. Please wait ${rl.retryAfterSeconds}s and try again.`,
    };
  }

  // ── INSTALL ─────────────────────────────────────────────────────────────────
  if (intent === "install") {
    // Idempotency: already installed?
    const existing = await db.installedSection.findUnique({
      where: { shop_themeId_sectionSlug: { shop: session.shop, themeId, sectionSlug } },
    });
    if (existing) {
      return { success: true, message: `"${section.name}" is already installed.` };
    }

    try {
      const { assetKey } = await installSection(admin, themeId, section);

      // Persist record — get theme name from Shopify (best-effort)
      let themeName = "Unknown Theme";
      try {
        const themeResp = await admin.rest.get({ path: `themes/${themeId}` });
        if (themeResp.ok) {
          const body = await themeResp.json();
          themeName = body.theme?.name ?? themeName;
        }
      } catch (_) { /* non-fatal */ }

      await db.installedSection.create({
        data: {
          shop:        session.shop,
          themeId,
          themeName,
          sectionSlug,
          sectionName: section.name,
          assetKey,
        },
      });

      return {
        success: true,
        message: `"${section.name}" installed successfully! Add it to your page via Theme Customizer.`,
      };
    } catch (err) {
      if (err instanceof OS2ValidationError) {
        return { error: err.message };
      }
      console.error("[action] install error:", err);
      return { error: `Install failed: ${err.message}` };
    }
  }

  // ── REMOVE ──────────────────────────────────────────────────────────────────
  if (intent === "remove") {
    try {
      await removeSection(admin, themeId, sectionSlug);

      await db.installedSection.deleteMany({
        where: { shop: session.shop, themeId, sectionSlug },
      });

      return {
        success: true,
        message: `"${section.name}" removed from your theme.`,
      };
    } catch (err) {
      console.error("[action] remove error:", err);
      return { error: `Remove failed: ${err.message}` };
    }
  }

  return { error: `Unknown intent: ${intent}` };
};

// ─── Component (client-side UI) ───────────────────────────────────────────────
const CATEGORY_COLORS = {
  Marketing:    { bg: "#fff3cd", fg: "#856404" },
  Content:      { bg: "#d1ecf1", fg: "#0c5460" },
  "Social Proof": { bg: "#d4edda", fg: "#155724" },
};

function CategoryBadge({ category }) {
  const colors = CATEGORY_COLORS[category] ?? { bg: "#e9ecef", fg: "#495057" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: ".03em",
        textTransform: "uppercase",
        background: colors.bg,
        color: colors.fg,
      }}
    >
      {category}
    </span>
  );
}

function SectionCard({ section, themeId, isPending }) {
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const isSubmitting = fetcher.state !== "idle";

  // Optimistic UI: reflect the in-flight action immediately
  const optimisticInstalled =
    isSubmitting && fetcher.formData?.get("intent") === "install"
      ? true
      : isSubmitting && fetcher.formData?.get("intent") === "remove"
        ? false
        : section.installed;

  // Toast on response
  if (fetcher.data?.success && !isSubmitting) {
    shopify.toast.show(fetcher.data.message, { duration: 4000 });
  }
  if (fetcher.data?.error && !isSubmitting) {
    shopify.toast.show(fetcher.data.error, { isError: true, duration: 6000 });
  }

  const handleInstall = () => {
    fetcher.submit(
      { intent: "install", sectionSlug: section.slug, themeId },
      { method: "POST" }
    );
  };

  const handleRemove = () => {
    fetcher.submit(
      { intent: "remove", sectionSlug: section.slug, themeId },
      { method: "POST" }
    );
  };

  return (
    <div
      style={{
        border: "1px solid #e1e3e5",
        borderRadius: "12px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        background: "#fff",
        opacity: isPending ? 0.6 : 1,
        transition: "box-shadow .15s",
      }}
    >
      {/* Card header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <s-text variant="headingMd">{section.name}</s-text>
        {optimisticInstalled && (
          <span
            style={{
              background: "#d4edda",
              color: "#155724",
              fontSize: "11px",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: "10px",
            }}
          >
            ✓ Installed
          </span>
        )}
      </div>

      <CategoryBadge category={section.category} />

      <s-text variant="bodyMd" tone="subdued">
        {section.description}
      </s-text>

      {/* Action buttons */}
      {optimisticInstalled ? (
        <s-button
          variant="secondary"
          tone="critical"
          onClick={handleRemove}
          loading={isSubmitting ? true : undefined}
          disabled={isPending || undefined}
        >
          Remove
        </s-button>
      ) : (
        <s-button
          variant="primary"
          onClick={handleInstall}
          loading={isSubmitting ? true : undefined}
          disabled={isPending || undefined}
        >
          Install
        </s-button>
      )}
    </div>
  );
}

export default function MarketplacePage() {
  const { shop: _shop, themes, activeTheme, catalog } = useLoaderData();
  const revalidator = useRevalidator();

  const [selectedThemeId, setSelectedThemeId] = useState(
    activeTheme ? String(activeTheme.id) : ""
  );

  const isPending = revalidator.state === "loading";

  const handleThemeChange = (e) => {
    const newId = e.target.value;
    setSelectedThemeId(newId);
    // Re-run the loader with the new theme selected
    const url = new URL(window.location.href);
    url.searchParams.set("themeId", newId);
    window.history.pushState({}, "", url.toString());
    revalidator.revalidate();
  };

  // Group catalog by category for display
  const categories = [...new Set(catalog.map((s) => s.category))];
  const installedCount = catalog.filter((s) => s.installed).length;

  return (
    <s-page heading="Free Section Marketplace">
      {/* ── Stats callout ─────────────────────────────────────────────────── */}
      <s-section slot="aside" heading="Your Installation">
        <s-paragraph>
          <s-text variant="headingLg">{installedCount}</s-text>
          <s-text> of {catalog.length} sections installed</s-text>
        </s-paragraph>
        {activeTheme && (
          <s-paragraph>
            <s-text tone="subdued">Active theme: </s-text>
            <s-text fontWeight="semibold">{activeTheme.name}</s-text>
          </s-paragraph>
        )}
      </s-section>

      <s-section slot="aside" heading="How to use">
        <s-unordered-list>
          <s-list-item>Select your theme below</s-list-item>
          <s-list-item>Click Install on any section</s-list-item>
          <s-list-item>Open Theme Customizer in Shopify Admin</s-list-item>
          <s-list-item>Add the section to any page using the "+" button</s-list-item>
        </s-unordered-list>
      </s-section>

      {/* ── Theme selector ─────────────────────────────────────────────────── */}
      {themes.length > 0 ? (
        <s-section heading="Select Theme">
          <div style={{ maxWidth: "400px" }}>
            <select
              value={selectedThemeId}
              onChange={handleThemeChange}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #c9cccf",
                fontSize: "14px",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              {themes.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name} {t.role === "main" ? "(Published)" : `(${t.role})`}
                </option>
              ))}
            </select>
            <p style={{ marginTop: "6px", fontSize: "12px", color: "#6d7175" }}>
              Only OS 2.0 themes are supported. Installing on a 1.0 theme will fail gracefully.
            </p>
          </div>
        </s-section>
      ) : (
        <s-section heading="No themes found">
          <s-paragraph>
            Unable to load themes. Make sure the app has <strong>read_themes</strong> scope.
          </s-paragraph>
        </s-section>
      )}

      {/* ── Section catalog by category ────────────────────────────────────── */}
      {categories.map((category) => {
        const sections = catalog.filter((s) => s.category === category);
        return (
          <s-section key={category} heading={category}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "16px",
              }}
            >
              {sections.map((section) => (
                <SectionCard
                  key={section.slug}
                  section={section}
                  themeId={selectedThemeId}
                  isPending={isPending}
                />
              ))}
            </div>
          </s-section>
        );
      })}
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => boundary.headers(headersArgs);

// ─── Fix missing import ───────────────────────────────────────────────────────
import { useRouteError } from "react-router";
