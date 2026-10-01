import { Suspense } from "react";
import { BuggleGame } from "@/components/buggle/BuggleGame";
import { gameMetadata } from "@/lib/seo";

export const metadata = gameMetadata("buggle");

export default function BugglePage() {
  return (
    <div data-game="buggle" className="flex flex-1 flex-col">
      <Suspense>
        <BuggleGame />
      </Suspense>
    </div>
  );
}
