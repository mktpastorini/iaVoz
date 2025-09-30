"use client";

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";
import { useSession } from "@/contexts/SessionContext";

const passwordSchema = z.object({
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

const UpdatePasswordPage = () => {
  const navigate = useNavigate();
  const { session, loading } = useSession(); // Usando o hook de sessão

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  // Efeito para verificar se o usuário chegou aqui sem um token válido
  useEffect(() => {
    if (!loading && !session) {
      // Atraso para dar tempo ao toast de aparecer antes do redirecionamento
      setTimeout(() => {
        showError("Sessão inválida. Por favor, use o link do seu e-mail.");
        navigate("/login", { replace: true });
      }, 500);
    }
  }, [session, loading, navigate]);

  const onSubmit = async (data: PasswordFormData) => {
    // Verificação final para garantir que a sessão existe antes de enviar
    if (!session) {
      showError("Sua sessão de autenticação não foi encontrada. Por favor, tente novamente a partir do link no seu e-mail.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });

    if (error) {
      showError("Erro ao atualizar a senha: " + error.message);
    } else {
      showSuccess("Senha definida com sucesso! Bem-vindo(a).");
      navigate("/admin", { replace: true });
    }
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0B022D] to-[#20053D] p-4">
        <p className="text-white">Verificando sua sessão...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0B022D] to-[#20053D] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <KeyRound className="h-10 w-10 text-primary" />
          </div>
          <CardTitle>Defina sua Senha</CardTitle>
          <CardDescription>
            Este é o último passo para ativar sua conta. Crie uma senha segura.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <Input
                id="password"
                type="password"
                {...register("password")}
              />
              {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirme a Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && <p className="text-destructive text-sm">{errors.confirmPassword.message}</p>}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting || loading}>
              {isSubmitting ? "Salvando..." : "Salvar e Acessar"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default UpdatePasswordPage;