"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";

const ROTAS_SEM_LAYOUT = ["/professor", "/admin"];

export default function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const semLayout = ROTAS_SEM_LAYOUT.some(r => pathname.startsWith(r));

  if (semLayout) return <>{children}</>;

  return (
    <>
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
    </>
  );
}
