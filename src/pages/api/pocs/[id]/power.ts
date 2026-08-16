import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { setPocPower } from "@/lib/pocs";

const powerSchema = z.object({
  powerRatingKw: z.coerce.number().positive().max(350),
});

function isNoRowsError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "PGRST116";
}

export const PATCH: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idResult = z.uuid().safeParse(context.params.id);
  if (!idResult.success) {
    return Response.json({ error: "Invalid POC id" }, { status: 400 });
  }
  const id = idResult.data;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = powerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  try {
    const poc = await setPocPower(supabase, id, context.locals.user.id, parsed.data.powerRatingKw);
    return Response.json({ poc });
  } catch (error) {
    if (isNoRowsError(error)) {
      return Response.json({ error: "Not found" }, { status: 403 });
    }
    return Response.json({ error: "Failed to update power rating" }, { status: 500 });
  }
};
