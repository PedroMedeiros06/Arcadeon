import { ProfilePageContent } from "@/components/profile/ProfilePageContent";

export default function ProfilePage() {
  return (
    <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <ProfilePageContent />
      </div>
    </main>
  );
}
