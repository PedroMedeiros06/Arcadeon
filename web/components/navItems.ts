import { Home, ShoppingBag, Trophy, User, Users } from "lucide-react";

// Mesma lista na sidebar (PC) e na barra de baixo (celular); so rotas que existem.
export const NAV_ITEMS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/shop", label: "Loja", icon: ShoppingBag },
  { href: "/leaderboard", label: "Placares", icon: Trophy },
  { href: "/amigos", label: "Amigos", icon: Users },
  { href: "/profile", label: "Perfil", icon: User },
];

export function isNavActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
