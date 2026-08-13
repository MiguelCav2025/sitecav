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
  // Sem `cover`, o env(safe-area-inset-*) do CSS vale sempre zero e as margens
  // da área segura não fazem nada. Com `black-translucent` declarado acima, o
  // resultado era o cabeçalho nascendo atrás do relógio e do notch.
  viewportFit: "cover",
  // O app é uma ferramenta de sala de aula: dar zoom no meio da chamada só
  // atrapalha, e o layout já é feito para caber na tela do celular.
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-blue-900 safe-x safe-bottom">
      {children}
    </div>
  );
}
