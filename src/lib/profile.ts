import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserLocation } from "@/types";
import type { Database } from "@/lib/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type SupabaseDb = SupabaseClient<Database>;

function mapRow(row: ProfileRow): UserLocation {
  return {
    latitude: row.latitude,
    longitude: row.longitude,
    updatedAt: row.updated_at,
  };
}

export async function getUserLocation(supabase: SupabaseDb, userId: string): Promise<UserLocation | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapRow(data) : null;
}

export async function upsertUserLocation(
  supabase: SupabaseDb,
  userId: string,
  latitude: number,
  longitude: number,
): Promise<UserLocation> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, latitude, longitude }, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapRow(data);
}
