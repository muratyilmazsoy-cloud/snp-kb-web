import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "./components/Navigation";
import { AuthProvider } from "@/contexts/AuthContext";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SnP Knowledge Base",
  description: "AI sohbetlerinizi arşivleyin, arayın, bağlayın.",
};

const dragPreventScript = `
  (function() {
    window.addEventListener('dragover', function(e) { e.preventDefault(); }, false);
    window.addEventListener('drop', function(e) { e.preventDefault(); }, false);
  })();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();

  return (
    <html lang="tr" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: dragPreventScript }} />
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <Navigation />
            <main className="pt-14">{children}</main>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
