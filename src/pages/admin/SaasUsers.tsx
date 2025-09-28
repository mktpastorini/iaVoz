"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users } from 'lucide-react';

const SaasUsersPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Users className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários da Plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Esta área será dedicada ao gerenciamento de todos os usuários da plataforma SaaS.
            Aqui, o administrador poderá adicionar, editar, remover e gerenciar as permissões dos usuários.
          </p>
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="font-semibold text-blue-800 dark:text-blue-300">Funcionalidade em desenvolvimento.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SaasUsersPage;