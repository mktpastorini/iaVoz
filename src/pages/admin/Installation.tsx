"use client";

import React from 'react';
import { useSession } from '@/contexts/SessionContext';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Copy } from 'lucide-react';
import { showSuccess } from '@/utils/toast';

const InstallationPage: React.FC = () => {
  const { workspace } = useSession();

  if (!workspace) {
    return <div>Carregando informações do workspace...</div>;
  }

  // ATENÇÃO: Substitua 'https://SUA_URL_AQUI' pela URL real da sua aplicação em produção.
  const appUrl = "https://assistenteia.intrategica.com.br"; 
  
  const widgetScriptUrl = `${appUrl}/assets/widget.js`;

  const embedCode = `<!-- Container para o Assistente IAM -->
<div id="iam-assistant-widget"></div>

<!-- Script para carregar o Assistente IAM -->
<script src="${widgetScriptUrl}" data-workspace-id="${workspace.id}" defer></script>`;

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
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
            <p className="font-semibold">Importante:</p>
            <p>Este código é único para o seu workspace. Não o compartilhe.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstallationPage;