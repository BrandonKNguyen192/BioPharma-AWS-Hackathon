import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClearTrial",
  description: "Clinical trial matching and protocol intelligence.",
};

const themeScript = `
  (() => {
    try {
      const stored = window.localStorage.getItem("cleartrial-theme");
      const theme =
        stored === "light" || stored === "dark"
          ? stored
          : "light";
      document.documentElement.dataset.theme = theme;
    } catch {
      document.documentElement.dataset.theme = "light";
    }
  })();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
