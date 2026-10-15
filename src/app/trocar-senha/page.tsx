"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/modules/auth/application/use-auth";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import { changeAdminPasswordApi } from "@/modules/auth/infrastructure/auth.api";

/** Mesma regra da API para senha nova (a do consultor): 8+ com maiúscula, minúscula, número e símbolo. */
const STRONG = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

/**
 * Troca obrigatória da senha temporária do admin (usuário novo do painel ou
 * "reenviar senha"). Fica fora do layout do painel de propósito: sem menu,
 * nada do painel abre antes da troca — a barreira mora no `useAuthGuard`.
 *
 * API antiga, sem a rota de troca (404): deixa entrar com a senha temporária,
 * avisando, em vez de prender o admin fora do painel.
 */
export default function TrocarSenhaPage() {
  const router = useRouter();
  const { isHydrated, isAuthenticated, mustChangePassword, clearMustChangePassword, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) router.replace("/login");
    else if (!mustChangePassword) router.replace("/dashboard");
  }, [isHydrated, isAuthenticated, mustChangePassword, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!STRONG.test(next)) {
      toast.error("A nova senha precisa ter 8 ou mais caracteres, com maiúscula, minúscula, número e símbolo.");
      return;
    }
    if (next !== confirm) {
      toast.error("A confirmação não é igual à nova senha.");
      return;
    }
    if (next === current) {
      toast.error("A nova senha precisa ser diferente da temporária.");
      return;
    }
    setLoading(true);
    try {
      await changeAdminPasswordApi(current, next);
      clearMustChangePassword();
      toast.success("Senha atualizada!");
      router.replace("/dashboard");
    } catch (err) {
      const error = apiErrorOf(err);
      if (error.status === 404) {
        // A API no ar ainda não tem a rota: não prende o admin fora do painel.
        clearMustChangePassword();
        toast.info(
          "A troca de senha ainda não está disponível no servidor. Você entrou com a senha temporária; troque assim que for liberada.",
        );
        router.replace("/dashboard");
        return;
      }
      toast.error(error.message ?? "Não foi possível trocar a senha. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  if (!isHydrated || !isAuthenticated || !mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Defina sua nova senha</CardTitle>
          <p className="text-sm text-[#737373]">
            Você entrou com uma senha temporária. Por segurança, troque antes de usar o painel.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current">Senha temporária</Label>
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next">Nova senha</Label>
              <Input
                id="next"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
              />
              <p className="text-xs text-[#737373]">8 ou mais caracteres, com maiúscula, minúscula, número e símbolo.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar nova senha</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#eca826] font-medium text-white hover:bg-[#d4951e]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}
            </Button>
            <button
              type="button"
              onClick={logout}
              disabled={loading}
              className="w-full min-h-10 text-sm text-[#737373] hover:text-[#1d1d1b] disabled:opacity-50"
            >
              Sair
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
