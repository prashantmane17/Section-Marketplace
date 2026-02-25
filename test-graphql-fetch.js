// test-graphql-fetch.js
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function run() {
    try {
        const installed = await db.installedSection.findMany();
        console.log("Installed:", installed);

        if (installed.length > 0) {
            const shop = installed[0].shop;
            const themeId = installed[0].themeId;
            const sectionSlug = installed[0].sectionSlug;

            const session = await db.session.findFirst({ where: { shop } });
            if (!session) {
                console.log("No session found for shop", shop);
                return;
            }

            console.log("Checking if asset exists in theme API...");
            const url = `https://${shop}/admin/api/2025-01/graphql.json`;

            const query = `
        query {
          theme(id: "gid://shopify/OnlineStoreTheme/${themeId}") {
            id
            name
            role
            files(first: 50, query: "filename:sections/${sectionSlug}.liquid") {
              nodes {
                filename
                body {
                  ... on OnlineStoreThemeFileBodyText {
                    content
                  }
                }
              }
            }
          }
        }
      `;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": session.accessToken,
                },
                body: JSON.stringify({ query }),
            });

            const result = await response.json();
            console.log(JSON.stringify(result, null, 2));
        }
    } catch (err) {
        console.error(err);
    } finally {
        await db.$disconnect();
    }
}

run();
