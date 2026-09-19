import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <Sidebar />

      <div className="flex min-h-full flex-1 flex-col">
        <Header />
        {children}
      </div>
    </div>
  );
}
