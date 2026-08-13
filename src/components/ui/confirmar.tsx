"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

/**
 * Confirmação no visual do sistema.
 *
 * O `confirm()` do navegador funciona, mas aparece com a cara do Chrome, no
 * topo da janela, longe do que a pessoa clicou — e não permite explicar a
 * consequência com o cuidado que algumas ações merecem. Num painel que decide
 * aprovação de aluno e acesso de professor, a caixa que pede confirmação é
 * parte da explicação, não um obstáculo a atravessar.
 */
export interface ConfirmacaoProps {
  aberto: boolean;
  titulo: string;
  /** O que vai acontecer, em uma ou duas frases. */
  descricao: React.ReactNode;
  /** Texto do botão que confirma. Diga o verbo, não "OK". */
  rotuloConfirmar?: string;
  /** Ação destrutiva ou irreversível pinta o botão de vermelho. */
  perigo?: boolean;
  carregando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function Confirmacao({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar = "Confirmar",
  perigo = false,
  carregando = false,
  onConfirmar,
  onCancelar,
}: ConfirmacaoProps) {
  return (
    <Dialog open={aberto} onOpenChange={v => { if (!v) onCancelar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {perigo && <AlertTriangle className="h-4 w-4 text-red-500" />}
            {titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-gray-600 space-y-2">{descricao}</div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancelar} disabled={carregando}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirmar}
            disabled={carregando}
            className={perigo ? "bg-red-600 hover:bg-red-700" : undefined}
          >
            {carregando ? "Aguarde..." : rotuloConfirmar}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
