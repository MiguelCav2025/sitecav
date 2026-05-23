import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Área do Professor — CAV",
};

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-blue-900">
      {children}
    </div>
  );
}
