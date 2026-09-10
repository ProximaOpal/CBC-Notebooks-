import type { ReactNode } from "react";
import { AuthProvider } from "@/providers/AuthProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import "./globals.css";

export const metadata = {
  title: "CBC Notebooks",
  description: "CBC learning for Kenya Grades 4–10",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <JsonLd />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
