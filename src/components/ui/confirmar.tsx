"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
 * O campo de texto de `perguntar`.
 *
 * Existe porque o `prompt()` do navegador tem o mesmo problema do `confirm()`,
 * agravado: além da cara do Chrome, ele não deixa explicar o que se espera da
 * resposta. E aqui a resposta vira registro permanente — o motivo de um abono
 * fica no histórico do aluno com data e autor.
 */
export interface CampoDeTexto {
  /** O que se está pedindo. Fica acima do campo. */
  rotulo: string;
  /** Vai no placeholder: mostre um exemplo real, não "digite aqui". */
  exemplo?: string;
  /** Abaixo de quantos caracteres o botão continua travado. */
  minimo?: number;
  /** Altura do campo em linhas. 1 vira input de uma linha. */
  linhas?: number;
}

/**
 * Uso:
 *
 *   const { confirmar, perguntar, dialogo } = useConfirmacao();
 *   ...
 *   if (!await confirmar({ titulo: "...", descricao: <p>...</p> })) return;
 *   const motivo = await perguntar({ titulo: "...", campo: { rotulo: "..." } });
 *   if (motivo === null) return;          // cancelou
 *   ...
 *   return (<>{dialogo}  ...resto da tela... </>);
 *
 * `confirmar` devolve Promise<boolean> e `perguntar` devolve
 * Promise<string | null>, então o código de chamada fica igual ao que era com
 * `confirm()` e `prompt()` — só com `await` na frente.
 *
 * ATENÇÃO: sem `{dialogo}` no JSX a Promise nunca resolve e o botão fica mudo
 * para sempre — sem erro de tipo e sem erro de build.
 */
export function useConfirmacao() {
  const [pedido, setPedido] = useState<(PedidoDeConfirmacao & { campo?: CampoDeTexto }) | null>(null);
  const [texto, setTexto] = useState("");
  const resolver = useRef<((v: boolean | string | null) => void) | null>(null);

  const confirmar = useCallback((p: PedidoDeConfirmacao) => {
    setTexto("");
    setPedido(p);
    return new Promise<boolean>(resolve => {
      resolver.current = v => resolve(v === true);
    });
  }, []);

  const perguntar = useCallback((p: PedidoDeConfirmacao & { campo: CampoDeTexto }) => {
    setTexto("");
    setPedido(p);
    return new Promise<string | null>(resolve => {
      resolver.current = v => resolve(typeof v === "string" ? v : null);
    });
  }, []);

  const responder = useCallback((ok: boolean) => {
    // Com campo, a resposta É o texto; sem campo, é o sim/não de sempre.
    const resposta = pedido?.campo ? (ok ? texto.trim() : null) : ok;
    setPedido(null);
    setTexto("");
    resolver.current?.(resposta);
    resolver.current = null;
  }, [pedido, texto]);

  const minimo = pedido?.campo?.minimo ?? 3;
  const curtoDemais = pedido?.campo !== undefined && texto.trim().length < minimo;
  const linhas = pedido?.campo?.linhas ?? 3;

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

        {pedido?.campo && (
          <div className="space-y-1.5">
            <label htmlFor="campo-confirmacao" className="text-sm font-medium text-gray-700">
              {pedido.campo.rotulo}
            </label>
            {linhas <= 1 ? (
              <Input
                id="campo-confirmacao"
                autoFocus
                value={texto}
                placeholder={pedido.campo.exemplo}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !curtoDemais) responder(true); }}
              />
            ) : (
              <Textarea
                id="campo-confirmacao"
                autoFocus
                rows={linhas}
                value={texto}
                placeholder={pedido.campo.exemplo}
                onChange={e => setTexto(e.target.value)}
              />
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => responder(false)}>Cancelar</Button>
          <Button
            onClick={() => responder(true)}
            disabled={curtoDemais}
            title={curtoDemais ? `Escreva pelo menos ${minimo} caracteres.` : undefined}
            className={pedido?.perigo ? "bg-red-600 hover:bg-red-700" : undefined}
          >
            {pedido?.rotuloConfirmar ?? "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { confirmar, perguntar, dialogo };
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
