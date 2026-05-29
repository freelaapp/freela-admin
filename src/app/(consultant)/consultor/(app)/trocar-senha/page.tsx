"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { changeConsultantPasswordApi } from "@/modules/consultant/infrastructure/consultant-api";
import { useConsultantAuth } from "@/modules/consultant/application/use-consultant-auth";

const STRONG = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export default function ConsultorTrocarSenhaPage() {
  const router = useRouter();
  const { clearMustChangePassword } = useConsultantAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!STRONG.test(next)) {
      toast.error("A senha deve ter 8+ caracteres com maiúscula, minúscula, número e símbolo.");
      return;
    }
    if (next !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      await changeConsultantPasswordApi(current, next);
      clearMustChangePassword();
      toast.success("Senha atualizada!");
      router.replace("/consultor");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao trocar a senha"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-center pt-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Defina sua nova senha</CardTitle>
          <p className="text-sm text-[#737373]">
            Por segurança, troque a senha temporária no primeiro acesso.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current">Senha temporária</Label>
              <Input
                id="current"
                type="password"
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
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar nova senha</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar nova senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
