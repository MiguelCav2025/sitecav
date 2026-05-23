"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import { AlertCircle } from "lucide-react";

export default function ProfessorLoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (error) { setErro("E-mail ou senha incorretos."); setLoading(false); return; }

    // Verifica se é professor
    const { data: prof } = await supabase.from("professores").select("id, senha_alterada").eq("id", data.user.id).single();
    if (!prof) {
      await supabase.auth.signOut();
      setErro("Acesso negado. Esta área é exclusiva para professores.");
      setLoading(false);
      return;
    }

    // Primeiro acesso → obriga troca de senha
    if (!prof.senha_alterada) {
      router.push("/professor/alterar-senha");
    } else {
      router.push("/professor/dashboard");
    }
  };

  return (
    <div className="flex items-start justify-center min-h-screen bg-blue-900 p-8 pt-16">
      <Card className="mx-auto w-full max-w-md p-6">
        <div className="flex justify-center mb-4">
          <Image src="/images/LOGO LARANJA CAV.png" alt="Logo CAV" width={200} height={80} className="object-contain" />
        </div>
        <CardHeader className="text-center pt-0">
          <CardTitle className="text-2xl">Área do Professor</CardTitle>
          <CardDescription>Acesse para registrar presença nas aulas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="senha">Senha</Label>
              <Input id="senha" type="password" required value={senha} onChange={e => setSenha(e.target.value)} />
            </div>
            {erro && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
              </div>
            )}
            <Button type="submit" variant="orange" className="w-full font-semibold" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
