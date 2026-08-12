"use client";

import { useEffect, useState } from "react";
import { Share, MoreVertical, PlusSquare, Smartphone, Check } from "lucide-react";

/**
 * Evento não-padrão do Chrome. O navegador o dispara quando o app atende aos
 * critérios de instalação; guardá-lo permite abrir o instalador no clique do
 * usuário, em vez de depender do menu do navegador.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Plataforma = "ios" | "android-com-prompt" | "outra";

function rodandoInstalado(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS não implementa display-mode; expõe esta propriedade própria.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Explica ao professor como colocar o app na tela inicial do celular.
 * Some sozinho quando o app já está instalado.
 */
export default function InstalarApp() {
  const [instalado, setInstalado] = useState(true); // assume instalado até saber
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalado(rodandoInstalado());
    setIos(ehIOS());

    const aoPoderInstalar = (e: Event) => {
      e.preventDefault(); // impede o mini-infobar padrão
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const aoInstalar = () => {
      setInstalado(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  if (instalado) return null;

  const plataforma: Plataforma = promptEvent
    ? "android-com-prompt"
    : ios
      ? "ios"
      : "outra";

  const instalar = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setInstalado(true);
    setPromptEvent(null);
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
          <Smartphone className="h-4 w-4 text-blue-600" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-gray-800">
            Coloque o CAV na tela inicial do celular
          </p>
          <p className="text-sm text-gray-600">
            Assim você abre a chamada direto pelo ícone, sem precisar procurar o endereço no navegador.
          </p>

          {plataforma === "android-com-prompt" && (
            <button
              type="button"
              onClick={instalar}
              className="mt-1 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              <PlusSquare className="h-4 w-4" />
              Instalar aplicativo
            </button>
          )}

          {plataforma === "ios" && (
            <ol className="mt-1 space-y-1.5 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">1.</span>
                Toque em <Share className="inline h-4 w-4 text-blue-600" /> Compartilhar, na barra do Safari
              </li>
              <li className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">2.</span>
                Escolha <strong className="font-semibold text-gray-700">Adicionar à Tela de Início</strong>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">3.</span>
                Confirme em <Check className="inline h-4 w-4 text-blue-600" /> Adicionar
              </li>
            </ol>
          )}

          {plataforma === "outra" && (
            <ol className="mt-1 space-y-1.5 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">1.</span>
                Abra o menu <MoreVertical className="inline h-4 w-4 text-blue-600" /> do navegador
              </li>
              <li className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">2.</span>
                Escolha <strong className="font-semibold text-gray-700">Instalar aplicativo</strong> ou{" "}
                <strong className="font-semibold text-gray-700">Adicionar à tela inicial</strong>
              </li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
