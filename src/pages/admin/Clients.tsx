"use client";

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AgendaView from './AgendaView';
import ClientListView from './ClientListView';

const ClientsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">CRM</h1>
      <Tabs defaultValue="agenda" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="list">Lista de Clientes</TabsTrigger>
        </TabsList>
        <TabsContent value="agenda" className="mt-6">
          <AgendaView />
        </TabsContent>
        <TabsContent value="list" className="mt-6">
          <ClientListView />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientsPage;