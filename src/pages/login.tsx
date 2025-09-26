"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";

const LoginPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0B022D] to-[#20053D] p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl">
        {/* Fundo animado que cria a borda */}
        <div className="absolute inset-0 animate-rotate [background:conic-gradient(from_180deg_at_50%_50%,#E255F2_0%,#8255F2_50%,#2D83F2_100%)]" />
        
        {/* Cartão interno que cobre o fundo, criando o efeito de borda */}
        <div className="relative z-10 rounded-[15px] bg-gray-900 p-8">
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
                    brand: "hsl(260 80% 60%)",
                    brandAccent: "hsl(260 80% 70%)",
                    inputBackground: "hsl(220 20% 12%)",
                    inputBorder: "hsl(220 20% 25%)",
                    inputBorderHover: "hsl(260 80% 70%)",
                    inputBorderFocus: "hsl(260 80% 60%)",
                    inputText: "hsl(0 0% 95%)",
                    defaultButtonBackground: "hsl(260 80% 60%)",
                    defaultButtonBackgroundHover: "hsl(260 80% 70%)",
                    defaultButtonBorder: "hsl(260 80% 60%)",
                    defaultButtonText: "hsl(0 0% 100%)",
                    messageBackground: "hsl(220 20% 15%)",
                    messageText: "hsl(0 0% 80%)",
                  },
                  fontSizes: {
                    baseButtonSize: "1rem",
                    baseInputSize: "1rem",
                  },
                  radii: {
                    borderRadiusButton: "0.75rem",
                    borderRadiusInput: "0.75rem",
                  },
                  space: {
                    inputPadding: "1rem",
                    buttonPadding: "0.75rem 1.5rem",
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
    </div>
  );
};

export default LoginPage;