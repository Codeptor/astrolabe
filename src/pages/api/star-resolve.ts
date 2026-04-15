import type { APIRoute } from "astro"
import { resolveStar } from "@/lib/simbad"

export const prerender = false

export const GET: APIRoute = async ({ url }) => {
  const name = url.searchParams.get("name")
  if (!name) {
    return Response.json({ error: "missing name parameter" }, { status: 400 })
  }

  const result = await resolveStar(name)
  if (!result) {
    return Response.json({ error: "not found" }, { status: 404 })
  }

  return Response.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  })
}
