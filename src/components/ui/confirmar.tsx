"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

/**
 * Confirmação no visual do sistema.
 *
 * O `confirm()` do navegador funciona, mas aparece com a cara do Chrome, no
 * topo da janela, longe do que a pessoa clicou. Pior: ele só aceita uma linha
 * de texto, e num painel que decide aprovação de aluno e acesso de professor a
 * caixa que pede confirmação é parte da explicação, não um obstáculo a
 * atravessar. "Excluir turma?" não diz que o histórico vai junto.
 */

export interface PedidoDeConfirmacao {
  titulo: string;
  /** O que vai acontecer. Aceita JSX para destacar o que importa. */
  descricao: React.ReactNode;
  /** Diga o verbo da ação, nunca "OK". */
  rotuloConfirmar?: string;
  /** Ação destrutiva ou irreversível: botão vermelho e ícone de alerta. */
  perigo?: boolean;
}

/**
 * Uso:
 *
 *   const { confirmar, dialogo } = useConfirmacao();
 *   ...
 *   if (!await confirmar({ titulo: "...", descricao: <p>...</p> })) return;
 *   ...
 *   return (<>{dialogo}  ...resto da tela... </>);
 *
 * `confirmar` devolve uma Promise<boolean>, então o código de chamada fica
 * igual ao que era com `confirm()` — só com `await` na frente.
 */
export function useConfirmacao() {
  const [pedido, setPedido] = useState<PedidoDeConfirmacao | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirmar = useCallback((p: PedidoDeConfirmacao) => {
    setPedido(p);
    return new Promise<boolean>(resolve => { resolver.current = resolve; });
  }, []);

  const responder = useCallback((ok: boolean) => {
    setPedido(null);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  const dialogo = (
    <Dialog open={pedido !== null} onOpenChange={v => { if (!v) responder(false); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {pedido?.perigo && <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />}
            {pedido?.titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm text-gray-600">{pedido?.descricao}</div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => responder(false)}>Cancelar</Button>
          <Button
            onClick={() => responder(true)}
            className={pedido?.perigo ? "bg-red-600 hover:bg-red-700" : undefined}
          >
            {pedido?.rotuloConfirmar ?? "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { confirmar, dialogo };
}

/** Versão controlada, para quem já tem o estado do lado de fora. */
export function Confirmacao({
  aberto, titulo, descricao, rotuloConfirmar = "Confirmar",
  perigo = false, carregando = false, onConfirmar, onCancelar,
}: PedidoDeConfirmacao & {
  aberto: boolean;
  carregando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={v => { if (!v) onCancelar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {perigo && <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />}
            {titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm text-gray-600">{descricao}</div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancelar} disabled={carregando}>Cancelar</Button>
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
