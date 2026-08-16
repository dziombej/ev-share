import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { removePoc } from "@/lib/pocs";

export const prerender = false;

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23503";
}

export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idResult = z.uuid().safeParse(context.params.id);
  if (!idResult.success) {
    return Response.json({ error: "Invalid POC id" }, { status: 400 });
  }
  const id = idResult.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  try {
    const { removed } = await removePoc(supabase, id, context.locals.user.id);
    if (!removed) {
      return Response.json({ error: "Not found" }, { status: 403 });
    }
    return Response.json({ success: true });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return Response.json({ error: "This charging point has logged sessions and can't be removed" }, { status: 409 });
    }
    return Response.json({ error: "Failed to remove charging point" }, { status: 500 });
  }
};
