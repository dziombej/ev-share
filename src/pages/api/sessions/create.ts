import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { logSession } from "@/lib/sessions";

const logSessionSchema = z.object({
  pocId: z.uuid(),
  seekerEmail: z.email(),
  kwh: z.coerce.number().positive().max(500),
});

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const hostEmail = context.locals.user.email;
  if (!hostEmail) {
    return context.redirect(`/dashboard/sessions?error=${encodeURIComponent("Your account is missing an email")}`);
  }

  const form = await context.request.formData();
  const parsed = logSessionSchema.safeParse({
    pocId: form.get("pocId"),
    seekerEmail: form.get("seekerEmail"),
    kwh: form.get("kwh"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return context.redirect(`/dashboard/sessions?error=${encodeURIComponent(message)}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/dashboard/sessions?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  try {
    await logSession(supabase, context.locals.user.id, hostEmail, parsed.data);
  } catch (error) {
    console.error("Failed to log session:", error);
    const message = error instanceof Error ? error.message : "Failed to log session";
    return context.redirect(`/dashboard/sessions?error=${encodeURIComponent(message)}`);
  }

  return context.redirect("/dashboard/sessions?success=1");
};
