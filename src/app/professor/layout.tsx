import type { Metadata, Viewport } from "next";

// O manifest é declarado só aqui, e não no layout raiz, porque o PWA é a área
// do professor. Assim o site institucional não oferece instalação a visitantes.
// O `scope` do manifest também está limitado a /professor/.
export const metadata: Metadata = {
  title: "Área do Professor — CAV",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CAV Professor",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#172554",
};

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-blue-900">
      {children}
    </div>
  );
}
