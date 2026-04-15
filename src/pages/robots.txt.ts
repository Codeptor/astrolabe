import type { APIRoute } from "astro"

export const GET: APIRoute = ({ site }) => {
  const base = site?.toString().replace(/\/$/, "") ?? "https://astrolabe.bhanueso.dev"
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    `Sitemap: ${base}/sitemap-index.xml`,
    `Host: ${base}`,
    "",
  ].join("\n")
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
