import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { searchUsersByEmailPrefix } from "@/lib/users";

const MIN_QUERY_LENGTH = 3;

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = context.url.searchParams.get("q") ?? "";
  if (q.trim().length < MIN_QUERY_LENGTH) {
    return Response.json({ users: [] });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  try {
    const users = await searchUsersByEmailPrefix(supabase, q.trim(), context.locals.user.id);
    return Response.json({ users });
  } catch (error) {
    console.error("Failed to search users:", error);
    return Response.json({ error: "Failed to search users" }, { status: 500 });
  }
};
