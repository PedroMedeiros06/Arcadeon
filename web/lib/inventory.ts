import { createClient } from "@/lib/supabase/client";
import type { Avatar, UserAvatar } from "@/lib/types";

export async function getShopCatalog(): Promise<Avatar[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("avatars").select("*").order("name");
  if (error) throw error;
  return data ?? [];
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

/** Valor e elegibilidade decididos no banco (uma vez por dia/modo, so com vitoria registrada). */
export async function claimTermoWinReward(boardCount: number, playDate: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("claim_termo_win_reward", {
    p_board_count: boardCount,
    p_play_date: playDate,
  });
  if (error) throw error;
  return data ?? 0;
}
