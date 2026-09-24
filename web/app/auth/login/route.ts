import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const INVALID = "Usuario ou senha invalidos";

// login por email OU nome de usuario. A busca username -> email roda so no
// servidor (service role), pra nao expor o email de ninguem pro navegador.
// Devolve os tokens da sessao; o client chama setSession com eles.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!identifier || !password) {
    return NextResponse.json({ error: INVALID }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

  let email = identifier;
  if (!identifier.includes("@")) {
    if (!serviceKey) {
      return NextResponse.json({ error: "Login por usuario indisponivel" }, { status: 500 });
    }
    const admin = createSupabaseClient(url, serviceKey, noSession);
    // case-insensitive; escapa curingas do ilike (% _ \)
    const pattern = identifier.replace(/[\\%_]/g, (c: string) => `\\${c}`);
    const { data: profiles } = await admin.from("profiles").select("id").ilike("username", pattern).limit(2);
    if (!profiles || profiles.length !== 1) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }
    const { data: userData } = await admin.auth.admin.getUserById(profiles[0].id);
    if (!userData.user?.email) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }
    email = userData.user.email;
  }

  const supabase = createSupabaseClient(url, anonKey, noSession);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
