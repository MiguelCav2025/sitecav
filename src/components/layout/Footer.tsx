import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-white pt-8 pb-4">
      <div className="container mx-auto px-4 text-center">
        {/* Logos lado a lado */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <Image
            src="/images/Logo-CAV_branco_2020_sm0.png"
            alt="Logo CAV"
            width={140}
            height={35}
            className="object-contain"
          />
          <div className="w-px h-12 bg-gray-600"></div>
          <Image
            src="/images/LOGO-PREFEITURA.png"
            alt="Prefeitura de São Bernardo do Campo"
            width={240}
            height={95}
            className="object-contain"
          />
        </div>
        <p className="text-sm">Rua Helena Jacquey, 208 - Rudge Ramos, São Bernardo do Campo - SP</p>
        <p className="text-sm">Tel.: (11) 2630-7874 - Email: centrodeaudiovisualsbc@gmail.com</p>
        
        <p className="text-xs text-gray-500 mt-4">&copy; 2025 CAV. Todos os direitos reservados.</p>

        <div className="mt-6 border-t border-gray-700 pt-4">
          <div className="flex items-center justify-center gap-2">
            <Link href="/area-de-downloads" className="text-sm text-gray-400 hover:text-white transition-colors">
              Área de Downloads
            </Link>
            <span className="text-gray-600 text-xs">|</span>
            <Link href="/admin/login" className="text-sm text-gray-400 hover:text-white transition-colors">
              Acesso Administrativo
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
} 