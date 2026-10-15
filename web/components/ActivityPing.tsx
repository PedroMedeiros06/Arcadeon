"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { logActivity } from "@/lib/activity";

/** Registra a visita ao hub. Espera o login resolver pra gravar com o usuario certo. */
export function ActivityPing() {
  const { loading } = useAuth();
  useEffect(() => {
    if (!loading) void logActivity("hub");
  }, [loading]);
  return null;
}
