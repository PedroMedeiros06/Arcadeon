import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { TransitionProvider } from "@/lib/transition/TransitionProvider";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
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
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — jogos online grátis com amigos`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["arcadeon", "jogos online", "jogos grátis", "jogos com amigos", "jogos de palavras", "jogos no navegador"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: "pt_BR",
    title: `${SITE_NAME} — jogos online grátis com amigos`,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
  // codigo da "Tag HTML" do Google Search Console (propriedade de prefixo de URL)
  verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
  icons: {
    icon: "/Logo@4x.png",
    apple: "/Logo@4x.png",
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
