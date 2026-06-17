import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { SWRProvider } from "@/components/providers/SWRProvider";
import { ConditionalLayout } from "@/components/layout/ConditionalLayout";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DWCC AccessLib",
  description: "Digital library access management system for Divine Word College of Calapan",
  keywords: ["library", "management", "system", "DWCC", "access", "books", "lockers"],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <Script
          src="https://kit.fontawesome.com/b822ff51a6.js"
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
        
        <SessionProvider session={session}>
          <SWRProvider>
            <ConditionalLayout>
              {children}
            </ConditionalLayout>
          </SWRProvider>
        </SessionProvider>
      </body>
    </html>
  );
}