"use client";

import React from 'react';
import { useSession } from '@/contexts/SessionContext';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Copy, Info } from 'lucide-react';
import { showSuccess } from '@/utils/toast';

const InstallationPage: React.FC = () => {
  const { workspace } = useSession();

  if (!workspace) {
    return <div>Carregando informações do workspace...</div>;
  }

  const appUrl = "https://assistenteia.intrategica.com.br"; 
  const widgetScriptUrl = `${appUrl}/assets/widget.js`;

  const embedCode = `<!-- Container para o Assistente IAM -->
<div id="iam-assistant-widget"></div>

<!-- Script para carregar o Assistente IAM -->
<script type="module" src="${widgetScriptUrl}" data-workspace-id="${workspace.id}"></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    showSuccess("Código copiado para a área de transferência!");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Instalação do Widget</h1>
      <Card>
        <CardHeader>
          <CardTitle>Como Instalar o Assistente no Seu Site</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Copie e cole o código abaixo no HTML do seu site, logo antes do fechamento da tag <code>&lt;/body&gt;</code>.
            O assistente será carregado automaticamente para os visitantes do seu site.
          </p>
          <div>
            <Label htmlFor="embed-code">Seu Código de Instalação</Label>
            <div className="relative">
              <Textarea
                id="embed-code"
                readOnly
                value={embedCode}
                className="font-mono h-48"
              />
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={handleCopy}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-blue-800 dark:text-blue-300 flex items-start gap-3">
            <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Nota:</p>
              <p>Após instalar o script, pode ser necessário limpar o cache do seu navegador ou aguardar alguns minutos para que as alterações no assistente apareçam no seu site.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstallationPage;