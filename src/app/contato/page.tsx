import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MapPin, Phone } from "lucide-react";

export default function ContatoPage() {
  return (
    <div className="bg-blue-900 py-8 px-12">
      <div className="container mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2">

            {/* Coluna da Esquerda: Informações e Mapa */}
            <div className="p-10 bg-gray-50">
              <h2 className="text-3xl font-bold text-blue-900 mb-2">Informações de Contato</h2>
              <p className="text-gray-600 mb-6">
                
                Estamos sempre disponíveis para tirar suas dúvidas.<br /> Entre em contato por um dos canais abaixo ou nos faça uma visita.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <MapPin className="h-6 w-6 text-orange-500 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-lg text-blue-900">Endereço</h3>
                    <p className="text-gray-600">Rua Helena Jacquey, 208 - Rudge Ramos - São Bernardo do Campo - SP - 09635-060</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <Phone className="h-6 w-6 text-orange-500 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-lg text-blue-900">Telefone</h3>
                    <p className="text-gray-600">(11) 2630-7874</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <Mail className="h-6 w-6 text-orange-500 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-lg text-blue-900">Email</h3>
                    <p className="text-gray-600">centrodeaudiovisualsbc@gmail.com</p>
                  </div>
                </div>
              </div>

              <div className="mt-10 rounded-lg overflow-hidden aspect-w-16 aspect-h-9">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3653.486665793427!2d-46.57029158486874!3d-23.69384317260783!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce43b2f5a72e8d%3A0x8e0de85e3a5a74e0!2sRua%20Helena%20Jacquey%2C%20208%20-%20Rudge%20Ramos%2C%20S%C3%A3o%20Bernardo%20do%20Campo%20-%20SP%2C%2009635-060!5e0!3m2!1spt-BR!2sbr!4v1678886562479!5m2!1spt-BR!2sbr"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen={true}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>
            </div>

            {/* Coluna da Direita: Formulário de Contato */}
            <div className="p-10">
              <h2 className="text-3xl font-bold text-blue-900 mb-8">Envie uma Mensagem</h2>
              <form className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <Input type="text" id="name" placeholder="Seu nome completo" className="bg-gray-100 focus:bg-white" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <Input type="email" id="email" placeholder="seu@email.com" className="bg-gray-100 focus:bg-white" />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                  <Textarea id="message" placeholder="Escreva sua mensagem aqui..." rows={6} className="bg-gray-100 focus:bg-white" />
                </div>
                <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3">
                  Enviar Mensagem
                </Button>
              </form>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
} 