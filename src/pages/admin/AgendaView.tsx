"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from 'lucide-react';

const AgendaView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Agenda da Semana</h2>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Adicionar Evento
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Calendário</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">A visualização da agenda semanal aparecerá aqui em breve.</p>
          {/* Placeholder for the calendar grid */}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgendaView;