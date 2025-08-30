"use client";

import { Rodape } from "@/components/rodape";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const Index = () => {
  const [activationPhrase, setActivationPhrase] = useState("ativar");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivationPhrase = async () => {
      const { data, error } = await supabase.from("settings").select("activation_phrase").limit(1).single();
      if (!error && data?.activation_phrase) {
        setActivationPhrase(data.activation_phrase);
      }
      setLoading(false);
    };
    fetchActivationPhrase();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-950 via-indigo-950 to-blue-950 text-white">
      <header className="p-6 md:p-8 border-b border-purple-700/50 shadow-lg">
        <nav className="flex justify-between items-center max-w-7xl mx-auto">
          <h1 className="text-3xl font-extrabold text-cyan-400 drop-shadow-lg">Intra IA</h1>
          <Button variant="ghost" className="text-cyan-300 hover:text-pink-400 transition-colors">
            Login
          </Button>
        </nav>
      </header>

      <main className="flex-grow flex items-center justify-center p-8 md:p-12 text-center relative overflow-hidden">
        {/* Efeitos de fundo futuristas */}
        <div className="absolute inset-0 z-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute top-1/2 right-1/4 w-72 h-72 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-8">
          <h2 className="text-5xl md:text-7xl font-extrabold leading-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 drop-shadow-2xl">
            Seu Assistente de Voz Inteligente
          </h2>
          <p className="text-lg md:text-xl text-gray-200 max-w-2xl mx-auto leading-relaxed">
            {loading ? "Carregando..." : `Diga "${activationPhrase}" para ativar a Intra IA e explorar um novo nível de interação e automação.`}
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Button
              size="lg"
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300"
            >
              Começar Agora <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-2 border-cyan-400 text-cyan-300 hover:bg-cyan-900/30 hover:text-cyan-200 font-bold py-3 px-8 rounded-full shadow-md transform hover:scale-105 transition-all duration-300"
            >
              Saiba Mais
            </Button>
          </div>
        </div>
      </main>

      <Rodape />
    </div>
  );
};

export default Index;