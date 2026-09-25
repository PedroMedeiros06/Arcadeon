import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { TransitionProvider } from "@/lib/transition/TransitionProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// so em titulos e na marca; o texto corrido continua em Geist
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arcadeon",
  description: "Central de jogos multiplayer",
  icons: {
    icon: "/Logo@4x.png",
  },
};

const noFlashScript = `
try {
  var stored = localStorage.getItem('theme');
  var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (theme === 'dark') document.documentElement.classList.add('dark');
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background font-medium text-foreground">
        <Script id="no-flash-theme" strategy="beforeInteractive">
          {noFlashScript}
        </Script>
        <ThemeProvider>
          <AuthProvider>
            <TransitionProvider>{children}</TransitionProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
