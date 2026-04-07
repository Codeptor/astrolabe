import { NextRequest } from "next/server"
import { resolveStar } from "@/lib/simbad"

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")
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
