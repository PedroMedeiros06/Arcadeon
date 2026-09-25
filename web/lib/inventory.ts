import { createClient } from "@/lib/supabase/client";
import type { Avatar, UserAvatar } from "@/lib/types";

export async function getShopCatalog(): Promise<Avatar[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("avatars")
    .select("*, achievement:unlock_achievement_id(name, description)")
    .order("price_coins", { ascending: true, nullsFirst: false })
    .order("name");
  if (error) throw error;
  return (data ?? []) as Avatar[];
}

export async function getInventory(userId: string): Promise<UserAvatar[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_avatars")
    .select("avatar_id, acquired_via")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function purchaseAvatar(avatarId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("purchase_avatar", { p_avatar_id: avatarId });
  if (error) throw error;
}

export async function equipAvatar(userId: string, avatarId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ equipped_avatar_id: avatarId })
    .eq("id", userId);
  if (error) throw error;
}

/** Validacao de formato e unicidade feita no banco; devolve o nome salvo. */
export async function updateUsername(username: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("update_username", { p_username: username });
  if (error) throw error;
  return data as string;
}
