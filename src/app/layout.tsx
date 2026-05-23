import PublicShell from "@/components/layout/PublicShell";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CAV - Centro de Audiovisual",
  description: "Site do Centro de Audiovisual de São Bernardo do Campo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="flex flex-col min-h-screen">
        <PublicShell>{children}</PublicShell>
      </body>
    </html>
  );
}
