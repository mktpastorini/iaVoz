"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Trash2, Edit, UserPlus } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Tipos
interface Client {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  custom_fields?: Record<string, string>; // Para exibição
}

interface UserDataField {
  id: string;
  name: string;
  type: string;
}

// Esquema de validação
const clientSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido").optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  custom_fields: z.record(z.string()).optional(),
}).refine(data => !!data.email || !!data.whatsapp, {
  message: "É obrigatório preencher o E-mail ou o WhatsApp",
  path: ["email"], // Onde o erro aparecerá
});

type ClientFormData = z.infer<typeof clientSchema>;

const ClientsPage: React.FC = () => {
  const { workspace, loading: sessionLoading } = useSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [customFields, setCustomFields] = useState<UserDataField[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
  });

  const fetchClientsAndFields = useCallback(async () => {
    if (!workspace?.id) return;
    setLoadingData(true);

    // Fetch Clients and their custom fields
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('*, client_field_values(value, user_data_fields(name))')
      .eq('workspace_id', workspace.id);

    if (clientsError) {
      showError("Erro ao carregar clientes.");
    } else {
      const formattedClients = clientsData.map((c: any) => ({
        ...c,
        custom_fields: c.client_field_values.reduce((acc: any, cfv: any) => {
          acc[cfv.user_data_fields.name] = cfv.value;
          return acc;
        }, {}),
      }));
      setClients(formattedClients);
    }

    // Fetch Custom Field Definitions
    const { data: fieldsData, error: fieldsError } = await supabase
      .from('user_data_fields')
      .select('id, name, type')
      .eq('workspace_id', workspace.id);

    if (fieldsError) showError("Erro ao carregar campos customizados.");
    else setCustomFields(fieldsData || []);

    setLoadingData(false);
  }, [workspace]);

  useEffect(() => {
    if (!sessionLoading && workspace) {
      fetchClientsAndFields();
    }
  }, [workspace, sessionLoading, fetchClientsAndFields]);

  const onSubmit = async (formData: ClientFormData) => {
    if (!workspace) return;

    const coreData = {
      workspace_id: workspace.id,
      name: formData.name,
      email: formData.email || null,
      whatsapp: formData.whatsapp || null,
      city: formData.city || null,
      state: formData.state || null,
    };

    let clientId = editingClientId;
    let error;

    if (editingClientId) {
      const { error: updateError } = await supabase.from('clients').update(coreData).eq('id', editingClientId);
      error = updateError;
    } else {
      const { data, error: insertError } = await supabase.from('clients').insert(coreData).select('id').single();
      error = insertError;
      if (data) clientId = data.id;
    }

    if (error) {
      showError(`Erro ao salvar cliente.`);
      return;
    }

    // Handle custom fields
    if (clientId && formData.custom_fields) {
      const valuesToUpsert = customFields
        .filter(field => formData.custom_fields?.[field.name] !== undefined)
        .map(field => ({
          client_id: clientId!,
          field_id: field.id,
          value: formData.custom_fields![field.name],
        }));

      if (valuesToUpsert.length > 0) {
        const { error: upsertError } = await supabase.from('client_field_values').upsert(valuesToUpsert);
        if (upsertError) {
          showError("Erro ao salvar campos customizados.");
          return;
        }
      }
    }

    showSuccess("Cliente salvo com sucesso!");
    reset({ name: '', email: '', whatsapp: '', city: '', state: '', custom_fields: {} });
    setEditingClientId(null);
    fetchClientsAndFields();
  };

  const onEdit = (client: Client) => {
    setEditingClientId(client.id);
    reset({
      ...client,
      custom_fields: client.custom_fields || {},
    });
  };

  const onDelete = async (id: string) => {
    if (!confirm("Tem certeza? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) showError("Erro ao excluir cliente.");
    else {
      showSuccess("Cliente excluído.");
      fetchClientsAndFields();
    }
  };

  if (loadingData) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Clientes</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <UserPlus className="mr-2" />
            {editingClientId ? "Editar Cliente" : "Adicionar Novo Cliente"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome Completo</Label>
                <Input id="name" {...register("name")} />
                {errors.name && <p className="text-destructive text-sm mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && <p className="text-destructive text-sm mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" {...register("whatsapp")} />
              </div>
              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" {...register("city")} />
              </div>
              <div>
                <Label htmlFor="state">Estado</Label>
                <Input id="state" {...register("state")} />
              </div>
            </div>
            {customFields.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-2">Campos Adicionais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customFields.map(field => (
                    <div key={field.id}>
                      <Label htmlFor={`custom_${field.name}`}>{field.name}</Label>
                      <Input id={`custom_${field.name}`} {...register(`custom_fields.${field.name}`)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex space-x-2">
              <Button type="submit" disabled={isSubmitting}>{editingClientId ? "Salvar Alterações" : "Adicionar Cliente"}</Button>
              {editingClientId && <Button type="button" variant="outline" onClick={() => { setEditingClientId(null); reset(); }}>Cancelar</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lista de Clientes</CardTitle></CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {clients.map(client => (
              <AccordionItem value={client.id} key={client.id}>
                <AccordionTrigger>{client.name}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    <p><strong>E-mail:</strong> {client.email || 'N/A'}</p>
                    <p><strong>WhatsApp:</strong> {client.whatsapp || 'N/A'}</p>
                    <p><strong>Cidade:</strong> {client.city || 'N/A'}</p>
                    <p><strong>Estado:</strong> {client.state || 'N/A'}</p>
                    {client.custom_fields && Object.keys(client.custom_fields).length > 0 && (
                      <div className="pt-2 border-t mt-2">
                        <h4 className="font-semibold">Dados Adicionais:</h4>
                        {Object.entries(client.custom_fields).map(([key, value]) => (
                          <p key={key}><strong>{key}:</strong> {value}</p>
                        ))}
                      </div>
                    )}
                    <div className="flex space-x-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => onEdit(client)}><Edit className="h-4 w-4 mr-2" /> Editar</Button>
                      <Button variant="destructive" size="sm" onClick={() => onDelete(client.id)}><Trash2 className="h-4 w-4 mr-2" /> Excluir</Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientsPage;