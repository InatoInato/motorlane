import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SessionProvider } from "./session";
import { SiteFooter, SiteHeader } from "./site-header";

export const metadata: Metadata = {
  title: "Motorlane | Find your next car",
  description:
    "Browse pre-owned cars, save your favorites and list a car of your own.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        <SessionProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </SessionProvider>
      </body>
    </html>
  );
}
