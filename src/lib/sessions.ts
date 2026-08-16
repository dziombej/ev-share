import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChargingSession, LogSessionInput } from "@/types";
import type { Database } from "@/lib/database.types";

type ChargingSessionRow = Database["public"]["Tables"]["charging_sessions"]["Row"];
type SupabaseDb = SupabaseClient<Database>;

interface ChargingSessionRowWithPoc extends ChargingSessionRow {
  poc: { id: string; latitude: number; longitude: number; power_rating_kw: number };
}

function mapRow(row: ChargingSessionRowWithPoc): ChargingSession {
  return {
    id: row.id,
    pocId: row.poc_id,
    hostId: row.host_id,
    hostEmail: row.host_email,
    seekerId: row.seeker_id,
    seekerEmail: row.seeker_email,
    kwh: row.kwh,
    createdAt: row.created_at,
    poc: {
      id: row.poc.id,
      latitude: row.poc.latitude,
      longitude: row.poc.longitude,
      powerRatingKw: row.poc.power_rating_kw,
    },
  };
}

export async function logSession(
  supabase: SupabaseDb,
  hostId: string,
  hostEmail: string,
  input: LogSessionInput,
): Promise<ChargingSession> {
  const { data: poc, error: pocError } = await supabase
    .from("pocs")
    .select("id, owner_id")
    .eq("id", input.pocId)
    .maybeSingle();

  if (pocError) {
    console.error("Failed to look up POC for session:", pocError);
    throw new Error("Failed to log session");
  }

  if (poc?.owner_id !== hostId) {
    throw new Error("You can only log sessions against your own charging point");
  }

  if (input.seekerId === hostId) {
    throw new Error("You cannot log a session for yourself");
  }

  const { data, error } = await supabase
    .from("charging_sessions")
    .insert({
      poc_id: input.pocId,
      host_id: hostId,
      host_email: hostEmail,
      seeker_id: input.seekerId,
      seeker_email: input.seekerEmail,
      kwh: input.kwh,
    })
    .select("*, poc:pocs(id, latitude, longitude, power_rating_kw)")
    .single();

  if (error) {
    console.error("Failed to insert charging session:", error);
    throw new Error("Failed to log session");
  }

  return mapRow(data);
}

export async function listSessionsForUser(supabase: SupabaseDb, userId: string): Promise<ChargingSession[]> {
  const { data, error } = await supabase
    .from("charging_sessions")
    .select("*, poc:pocs(id, latitude, longitude, power_rating_kw)")
    .or(`host_id.eq.${userId},seeker_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(mapRow);
}

export function computeBalance(sessions: ChargingSession[], userId: string): number {
  return sessions.reduce((balance, session) => {
    if (session.hostId === userId) return balance + session.kwh;
    if (session.seekerId === userId) return balance - session.kwh;
    return balance;
  }, 0);
}
