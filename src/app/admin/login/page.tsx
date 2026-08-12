'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('E-mail ou senha incorretos.');
      return;
    }

    // Se for professor, redireciona para a área deles
    const { data: prof } = await supabase
      .from('professores')
      .select('id, senha_alterada')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (prof) {
      if (!prof.senha_alterada) {
        router.push('/professor/alterar-senha');
      } else {
        router.push('/professor/dashboard');
      }
      return;
    }

    router.push('/admin/dashboard');
  };

  return (
    <div className="flex items-start justify-center min-h-screen bg-blue-900 p-18 pt-12">
      <Card className="mx-auto w-full max-w-xl p-8">
        <div className="flex justify-center mb-4">
          <Image 
            src="/images/LOGO LARANJA CAV.png" 
            alt="Logo CAV" 
            width={250} 
            height={100} 
            className="object-contain"
          />
        </div>
        <CardHeader className="text-center pt-0">
          <CardTitle className="text-3xl">Login</CardTitle>
          <CardDescription>
            Acesso ao painel administrativo do CAV
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder=""
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Senha</Label>
              </div>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <Button type="submit" variant="orange" className="w-full py-3 text-base font-semibold tracking-wide">
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 