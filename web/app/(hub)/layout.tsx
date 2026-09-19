import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <Sidebar />

      <div className="flex min-h-full flex-1 flex-col pb-16 lg:pb-0">
        <Header />
        {children}
      </div>

      <MobileNav />
    </div>
  );
}
