import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { setPocAvailability } from "@/lib/pocs";

const toggleSchema = z.object({
  isAvailable: z.boolean(),
});

function isNoRowsError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "PGRST116";
}

export const PATCH: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = context.params;
  if (!id) {
    return Response.json({ error: "Missing POC id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  try {
    const poc = await setPocAvailability(supabase, id, context.locals.user.id, parsed.data.isAvailable);
    return Response.json({ poc });
  } catch (error) {
    if (isNoRowsError(error)) {
      return Response.json({ error: "Not found" }, { status: 403 });
    }
    return Response.json({ error: "Failed to update availability" }, { status: 500 });
  }
};
