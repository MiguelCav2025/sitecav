import Link from "next/link";
import Image from "next/image";

export default function Header() {
  const navLinks = [
    { href: "/cursos", label: "Cursos" },
    { href: "/portfolio-alunos", label: "Portfólio Alunos" },
    { href: "/projetos", label: "Projetos" },
    { href: "/area-do-candidato", label: "Processo Seletivo" },
    { href: "/contato", label: "Contato" },
  ];

  return (
    <header className="bg-blue-900 text-white shadow-md">
      <nav className="container mx-auto flex items-center justify-between px-16 py-6">
        <Link href="/" className="block transition-transform duration-300 ease-in-out hover:scale-105">
          <Image
            src="/images/Logo-CAV_branco_2020_sm0.png"
            alt="Logo CAV"
            width={180}
            height={45}
            priority
          />
        </Link>
        <ul className="flex items-center space-x-2">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="group relative block px-4 py-3 text-base tracking-wider font-medium overflow-hidden h-[3rem] flex items-center">
                <span className="block transition-all duration-300 ease-in-out group-hover:-translate-y-full group-hover:opacity-0">
                  {link.label}
                </span>
                <span className="absolute inset-0 flex items-center justify-center text-orange-400 transition-all duration-300 ease-in-out translate-y-full group-hover:translate-y-0 opacity-0 group-hover:opacity-100">
                  {link.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
} 