import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { createPoc } from "@/lib/pocs";

export const prerender = false;

const createPocSchema = z.object({
  latitude: z.string().trim().min(1, "Latitude is required").transform(Number).pipe(z.number().min(-90).max(90)),
  longitude: z.string().trim().min(1, "Longitude is required").transform(Number).pipe(z.number().min(-180).max(180)),
  powerRatingKw: z.coerce.number().positive().max(350),
});

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const ownerEmail = context.locals.user.email;
  if (!ownerEmail) {
    return context.redirect(`/dashboard/pocs?error=${encodeURIComponent("Your account is missing an email")}`);
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
    await createPoc(supabase, context.locals.user.id, ownerEmail, parsed.data);
  } catch (error) {
    console.error("Failed to create POC:", error);
    return context.redirect(`/dashboard/pocs?error=${encodeURIComponent("Failed to register POC")}`);
  }

  return context.redirect("/dashboard/pocs");
};
