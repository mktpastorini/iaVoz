"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DollarSign } from 'lucide-react';

const SaasFinancialPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <DollarSign className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Painel Financeiro</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visão Geral Financeira</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Esta seção fornecerá uma visão geral das assinaturas, pagamentos e métricas financeiras da plataforma SaaS.
            O administrador poderá visualizar relatórios, gerenciar planos e acompanhar a receita.
          </p>
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="font-semibold text-blue-800 dark:text-blue-300">Funcionalidade em desenvolvimento.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SaasFinancialPage;