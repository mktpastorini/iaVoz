"use client";

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { KeyRound } from "lucide-react";

const LoginPage = () => {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) {
      navigate("/admin", { replace: true });
    }
  }, [session, loading, navigate]);

  // Se a sessão já estiver carregada e existir, não renderiza nada para evitar um flash da UI de login
  if (loading || session) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0B022D] to-[#20053D] p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-indigo-950/40 p-8 shadow-2xl border border-blue-500/30 shadow-blue-500/20">
        <div className="flex justify-center mb-6">
          <KeyRound className="h-10 w-10 text-blue-400" />
        </div>
        <h2 className="text-3xl font-bold text-center text-white mb-8 tracking-wide">
          Acesso ao Painel
        </h2>

        <Auth
          supabaseClient={supabase}
          view="sign_in"
          showLinks={false}
          providers={[]}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: "hsl(217, 91%, 60%)", // Azul brilhante para o botão
                  brandAccent: "hsl(217, 91%, 70%)",
                  inputBackground: "rgba(0, 0, 0, 0.2)",
                  inputBorder: "hsl(240, 4%, 30%)",
                  inputBorderHover: "hsl(217, 91%, 70%)",
                  inputBorderFocus: "hsl(217, 91%, 60%)",
                  inputText: "hsl(0, 0%, 100%)",
                  defaultButtonBackground: "hsl(217, 91%, 60%)",
                  defaultButtonBackgroundHover: "hsl(217, 91%, 70%)",
                  defaultButtonBorder: "hsl(217, 91%, 60%)",
                  defaultButtonText: "hsl(0, 0%, 100%)",
                  messageText: "hsl(240, 5%, 65%)",
                  anchorTextColor: "hsl(217, 91%, 75%)",
                  labelTextColor: "hsl(240, 5%, 65%)",
                },
                fontSizes: {
                  baseButtonSize: "1rem",
                  baseInputSize: "1rem",
                },
                radii: {
                  borderRadiusButton: "0.5rem",
                  borderRadiusInput: "0.5rem",
                },
                space: {
                  inputPadding: "0.75rem 1rem",
                  buttonPadding: "0.6rem 1.5rem",
                }
              },
            },
          }}
          localization={{
            variables: {
              sign_in: {
                email_label: "Seu E-mail",
                password_label: "Sua Senha",
                email_input_placeholder: "email@exemplo.com",
                password_input_placeholder: "••••••••",
                button_label: "Entrar",
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default LoginPage;