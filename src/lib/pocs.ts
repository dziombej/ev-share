import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreatePocInput, Poc } from "@/types";
import type { Database } from "@/lib/database.types";

type PocRow = Database["public"]["Tables"]["pocs"]["Row"];
type SupabaseDb = SupabaseClient<Database>;

function mapRow(row: PocRow): Poc {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerEmail: row.owner_email,
    latitude: row.latitude,
    longitude: row.longitude,
    powerRatingKw: row.power_rating_kw,
    isAvailable: row.is_available,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPocs(supabase: SupabaseDb): Promise<Poc[]> {
  const { data, error } = await supabase.from("pocs").select("*").order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(mapRow);
}

export async function listPocsForOwner(supabase: SupabaseDb, ownerId: string): Promise<Poc[]> {
  const { data, error } = await supabase
    .from("pocs")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(mapRow);
}

export async function createPoc(
  supabase: SupabaseDb,
  ownerId: string,
  ownerEmail: string,
  input: CreatePocInput,
): Promise<Poc> {
  const { data, error } = await supabase
    .from("pocs")
    .insert({
      owner_id: ownerId,
      owner_email: ownerEmail,
      latitude: input.latitude,
      longitude: input.longitude,
      power_rating_kw: input.powerRatingKw,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapRow(data);
}

/**
 * Updates is_available on a POC, scoped to both the RLS policy and an explicit
 * owner_id filter. `.single()` errors with code PGRST116 when zero rows match
 * (not the owner, or the POC doesn't exist) — callers use this to return 403.
 */
export async function setPocAvailability(
  supabase: SupabaseDb,
  pocId: string,
  ownerId: string,
  isAvailable: boolean,
): Promise<Poc> {
  const { data, error } = await supabase
    .from("pocs")
    .update({ is_available: isAvailable })
    .eq("id", pocId)
    .eq("owner_id", ownerId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapRow(data);
}

/**
 * Same owner-scoping and PGRST116-as-403 convention as setPocAvailability, updating
 * power_rating_kw instead of is_available.
 */
export async function setPocPower(
  supabase: SupabaseDb,
  pocId: string,
  ownerId: string,
  powerRatingKw: number,
): Promise<Poc> {
  const { data, error } = await supabase
    .from("pocs")
    .update({ power_rating_kw: powerRatingKw })
    .eq("id", pocId)
    .eq("owner_id", ownerId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapRow(data);
}

/**
 * Deletes a POC scoped to its owner. Two distinguishable failure modes for callers:
 * a Postgres foreign-key violation (code 23503) means charging_sessions still
 * references this POC — the FK's default `on delete no action` rejects the delete
 * rather than this function needing its own pre-check. Zero rows returned (no error)
 * means the POC doesn't exist or isn't owned by `ownerId` — `.delete()` doesn't error
 * on zero matched rows the way `.update().single()` does, so callers check the
 * returned array's length instead of catching PGRST116.
 */
export async function removePoc(supabase: SupabaseDb, pocId: string, ownerId: string): Promise<{ removed: boolean }> {
  const { data, error } = await supabase.from("pocs").delete().eq("id", pocId).eq("owner_id", ownerId).select();

  if (error) {
    throw error;
  }

  return { removed: data.length > 0 };
}
