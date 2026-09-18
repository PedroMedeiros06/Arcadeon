import { Suspense } from "react";
import { BuggleGame } from "@/components/buggle/BuggleGame";

export default function BugglePage() {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense>
        <BuggleGame />
      </Suspense>
    </div>
  );
}
