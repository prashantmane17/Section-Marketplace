/**
 * webhooks.app.scopes_update.jsx
 *
 * Handles app/scopes_update webhook from Shopify.
 * Fired when OAuth scopes change (e.g. merchant grants/revokes permissions).
 *
 * SECURITY: HMAC verification is done by authenticate.webhook().
 */

import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`[webhook] ${topic} for shop: ${shop}`);
  console.log(`[webhook] New scopes: ${JSON.stringify(payload.current)}`);

  if (session) {
    try {
      const newScope = Array.isArray(payload.current)
        ? payload.current.join(",")
        : String(payload.current);

      await db.session.update({
        where: { id: session.id },
        data:  { scope: newScope },
      });
      console.log(`[webhook] Updated scope for session ${session.id}`);
    } catch (err) {
      console.error(
        `[webhook] Failed to update scope for session ${session.id}:`,
        err.message
      );
    }
  }

  return new Response(null, { status: 200 });
};
