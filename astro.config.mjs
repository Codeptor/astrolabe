import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import vercel from "@astrojs/vercel"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"

const SITE = process.env.ASTRO_SITE ?? "https://astrolabe.bhanueso.dev"

export default defineConfig({
  site: SITE,
  output: "static",
  trailingSlash: "never",
  adapter: vercel({
    imageService: false,
    webAnalytics: { enabled: false },
    maxDuration: 10,
  }),
  integrations: [
    react(),
    sitemap({
      filter: (page) =>
        !page.includes("/api/") &&
        !page.endsWith("/og.png") &&
        !page.endsWith("/robots.txt"),
      serialize(item) {
        if (item.url === `${SITE}/`) {
          return { ...item, priority: 1, changefreq: "monthly" }
        }
        return item
      },
      customPages: [`${SITE}/?mode=1972`],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ["react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
  },
})
