import { TermoGame } from "@/components/termo/TermoGame";

export default function TermoPage() {
  return (
    <div data-game="termo" className="flex flex-1 flex-col">
      <TermoGame />
    </div>
  );
}
