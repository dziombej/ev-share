import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreatePocInput, Poc } from "@/types";
import type { Database } from "@/lib/database.types";

type PocRow = Database["public"]["Tables"]["pocs"]["Row"];
type SupabaseDb = SupabaseClient<Database>;

function mapRow(row: PocRow): Poc {
  return {
    id: row.id,
    ownerId: row.owner_id,
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

export async function createPoc(supabase: SupabaseDb, ownerId: string, input: CreatePocInput): Promise<Poc> {
  const { data, error } = await supabase
    .from("pocs")
    .insert({
      owner_id: ownerId,
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
