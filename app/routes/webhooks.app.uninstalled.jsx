/**
 * webhooks.app.uninstalled.jsx
 *
 * Handles app/uninstalled webhook from Shopify.
 *
 * SECURITY: HMAC signature is verified by @shopify/shopify-app-react-router
 * BEFORE this action is called — do NOT skip authenticate.webhook().
 *
 * On uninstall we:
 *  1. Delete all sessions for the shop (revokes access token)
 *  2. Delete all InstalledSection records for the shop (data cleanup)
 *
 * NOTE: We do NOT call the Themes API to remove section files.
 * The merchant uninstalled the app — we respect their data and leave
 * any already-installed files in place (they can delete manually if desired).
 */

import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  // HMAC verification happens inside authenticate.webhook — mandatory
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`[webhook] ${topic} received for shop: ${shop}`);

  // Webhook may fire multiple times; be idempotent
  try {
    if (session) {
      // 1. Remove all Shopify sessions (offline + any online) for this shop
      const deleted = await db.session.deleteMany({ where: { shop } });
      console.log(`[webhook] Deleted ${deleted.count} session(s) for ${shop}`);
    }

    // 2. Remove all installed-section tracking records for this shop
    const cleanedSections = await db.installedSection.deleteMany({ where: { shop } });
    console.log(`[webhook] Removed ${cleanedSections.count} installed-section record(s) for ${shop}`);
  } catch (err) {
    // Log but don't throw — Shopify retries on non-2xx responses
    console.error(`[webhook] Error during uninstall cleanup for ${shop}:`, err.message);
  }

  return new Response(null, { status: 200 });
};
