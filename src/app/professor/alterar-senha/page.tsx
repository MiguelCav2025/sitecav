"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, KeyRound } from "lucide-react";
import Image from "next/image";
import InstalarApp from "@/components/pwa/InstalarApp";

export default function AlterarSenhaPage() {
  const supabase = createClient();
  const router = useRouter();
  const [nome, setNome] = useState("");
  // id do registro em `professores` — desde a fase 2 ele não é mais o id do login
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    const verificar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/professor/login"); return; }

      const { data: prof } = await supabase
        .from("professores")
        .select("id, nome, senha_alterada")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!prof) { router.push("/professor/login"); return; }

      // Se já alterou, não precisa estar aqui
      if (prof.senha_alterada) { router.push("/professor/dashboard"); return; }

      setProfessorId(prof.id);
      setNome(prof.nome.split(" ")[0]);
      setVerificando(false);
    };
    verificar();
  }, []);

  const handleAlterarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (novaSenha.length < 8) return setErro("A senha deve ter pelo menos 8 caracteres.");
    if (novaSenha !== confirmar) return setErro("As senhas não coincidem.");

    setLoading(true);

    const { error: errSenha } = await supabase.auth.updateUser({ password: novaSenha });
    if (errSenha) { setErro("Erro ao atualizar senha. Tente novamente."); setLoading(false); return; }

    const { error: errFlag } = await supabase
      .from("professores")
      .update({ senha_alterada: true })
      .eq("id", professorId);

    // Se a marcação falhar, a senha já mudou mas o professor cairia de volta
    // aqui no próximo acesso. Melhor avisar do que deixar em loop silencioso.
    if (errFlag) {
      setErro("Senha alterada, mas houve falha ao concluir o cadastro. Avise a coordenação.");
      setLoading(false);
      return;
    }

    router.push("/professor/dashboard");
  };

  if (verificando) return null;

  return (
    <div className="flex items-start justify-center min-h-screen bg-blue-900 p-8 pt-16">
      <Card className="mx-auto w-full max-w-md p-6">
        <div className="flex justify-center mb-4">
          <Image src="/images/LOGO LARANJA CAV.png" alt="Logo CAV" width={200} height={80} className="object-contain" />
        </div>
        <CardHeader className="text-center pt-0">
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <KeyRound className="h-6 w-6 text-orange-500" />
            </div>
          </div>
          <CardTitle className="text-xl">Bem-vindo, {nome}!</CardTitle>
          <CardDescription>
            Este é seu primeiro acesso. Por segurança, defina uma senha pessoal antes de continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAlterarSenha} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="nova">Nova senha</Label>
              <Input
                id="nova"
                type="password"
                required
                placeholder="Mínimo 8 caracteres"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmar">Confirmar nova senha</Label>
              <Input
                id="confirmar"
                type="password"
                required
                placeholder="Digite a senha novamente"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
              />
            </div>

            {novaSenha.length >= 8 && novaSenha === confirmar && (
              <div className="flex items-center gap-2 text-green-700 text-sm">
                <CheckCircle className="h-4 w-4" /> Senhas coincidem
              </div>
            )}

            {erro && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
              </div>
            )}

            <Button type="submit" variant="orange" className="w-full font-semibold" disabled={loading}>
              {loading ? "Salvando..." : "Definir senha e entrar"}
            </Button>
          </form>

          {/* D28 — o primeiro acesso também ensina a instalar o app */}
          <div className="mt-6 border-t border-gray-100 pt-5">
            <InstalarApp />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
