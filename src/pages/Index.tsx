"use client";

import { Rodape } from "@/components/rodape";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";

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
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="p-4 border-b">
        <h1 className="text-2xl font-bold">Meu Site Incrível</h1>
      </header>
      <main className="flex-grow p-8 space-y-4">
        <h2 className="text-3xl font-semibold">Bem-vindo ao Futuro</h2>
        <p className="text-lg text-muted-foreground">
          {loading ? "Carregando..." : `Este é um exemplo de página onde o assistente de voz pode ser implementado. Diga "${activationPhrase}" para começar a interagir.`}
        </p>
        <div className="space-x-4">
          <Button>Botão Principal</Button>
          <Button variant="secondary">Outra Ação</Button>
        </div>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero.
          Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet.
          Duis sagittis ipsum. Praesent mauris. Fusce nec tellus sed augue semper porta.
          Mauris massa. Vestibulum lacinia arcu eget nulla.
        </p>
      </main>
      <Rodape />
      {/* O assistente foi movido para App.tsx para ser global */}
    </div>
  );
};

export default Index;