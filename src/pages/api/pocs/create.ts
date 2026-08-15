import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { createPoc } from "@/lib/pocs";

const createPocSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  powerRatingKw: z.coerce.number().positive().max(350),
});

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const parsed = createPocSchema.safeParse({
    latitude: form.get("latitude"),
    longitude: form.get("longitude"),
    powerRatingKw: form.get("powerRatingKw"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return context.redirect(`/dashboard/pocs?error=${encodeURIComponent(message)}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/dashboard/pocs?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  try {
    await createPoc(supabase, context.locals.user.id, parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create POC";
    return context.redirect(`/dashboard/pocs?error=${encodeURIComponent(message)}`);
  }

  return context.redirect("/dashboard/pocs");
};
