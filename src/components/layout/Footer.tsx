import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-white pt-8 pb-4">
      <div className="container mx-auto container-responsive text-center">
        {/* Logos - Stack vertical no mobile, lado a lado no desktop */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 mb-6">
          <Image
            src="/images/Logo-CAV_branco_2020_sm0.png"
            alt="Logo CAV"
            width={120}
            height={30}
            className="object-contain md:w-[140px] md:h-[35px]"
          />
          <div className="hidden md:block w-px h-12 bg-gray-600"></div>
          <Image
            src="/images/LOGO-PREFEITURA.png"
            alt="Prefeitura de São Bernardo do Campo"
            width={180}
            height={72}
            className="object-contain md:w-[220px] md:h-[88px]"
          />
        </div>
        <div className="space-y-2 mb-4">
          <p className="text-small-responsive">Rua Helena Jacquey, 208 - Rudge Ramos, São Bernardo do Campo - SP</p>
          <p className="text-small-responsive">Tel.: (11) 2630-7874 - Email: centrodeaudiovisualsbc@gmail.com</p>
        </div>
        
        <p className="text-xs md:text-sm text-gray-500 mb-6">&copy; 2025 CAV. Todos os direitos reservados.</p>

        <div className="border-t border-gray-700 pt-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-2">
            <Link href="/area-de-downloads" className="text-small-responsive text-gray-400 hover:text-white transition-colors">
              Área de Downloads
            </Link>
            <span className="hidden md:inline text-gray-600 text-xs">|</span>
            <Link href="/admin/login" className="text-small-responsive text-gray-400 hover:text-white transition-colors">
              Acesso Administrativo
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
} 