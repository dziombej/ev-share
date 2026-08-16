import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserSearchResult } from "@/types";
import type { Database } from "@/lib/database.types";

type SupabaseDb = SupabaseClient<Database>;

const MAX_RESULTS = 5;

/**
 * Fetches one extra result beyond MAX_RESULTS so filtering out the caller's own
 * id (a self-match) doesn't shrink the visible result count below what a real
 * search would show.
 */
export async function searchUsersByEmailPrefix(
  supabase: SupabaseDb,
  prefix: string,
  excludeUserId: string,
): Promise<UserSearchResult[]> {
  const { data, error } = await supabase.rpc("search_users_by_email_prefix", {
    p_prefix: prefix,
    p_limit: MAX_RESULTS + 1,
  });

  if (error) {
    throw error;
  }

  return data.filter((user) => user.id !== excludeUserId).slice(0, MAX_RESULTS);
}
