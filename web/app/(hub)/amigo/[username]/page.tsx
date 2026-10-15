import type { Metadata } from "next";
import { FriendLinkContent } from "@/components/social/FriendLinkContent";

// link colado errado ("%E0") nao pode derrubar a pagina; vira "Link invalido"
function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

export async function generateMetadata(props: PageProps<"/amigo/[username]">): Promise<Metadata> {
  const { username } = await props.params;
  const name = decode(username);
  return { title: name ? `Adicionar ${name}` : "Link de amigo", robots: { index: false, follow: false } };
}

export default async function FriendLinkPage(props: PageProps<"/amigo/[username]">) {
  const { username } = await props.params;
  return (
    <main className="w-full flex-1 px-4 py-10 sm:px-6">
      <FriendLinkContent rawUsername={decode(username)} />
    </main>
  );
}
