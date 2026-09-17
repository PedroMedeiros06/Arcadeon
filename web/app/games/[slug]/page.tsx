import { notFound } from "next/navigation";
import Link from "next/link";
import { games } from "@/lib/games";

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = games.find((g) => g.slug === slug);

  if (!game || game.status !== "available") {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">{game.title}</h1>
      <p className="text-gray-400">Jogo em construcao.</p>
      <Link href="/" className="text-blue-400 hover:underline">
        Voltar ao Hub
      </Link>
    </div>
  );
}
