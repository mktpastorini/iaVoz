"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Trash2, Edit, User } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface UserDataField {
  id: string;
  name: string;
  description: string | null;
  type: 'string' | 'number' | 'boolean';
}

interface UserFieldValue {
  field_id: string;
  value: string | null;
}

interface ClientData {
  profile: Profile;
  fieldValues: Record<string, string | number | boolean | null>;
}

// Schema for client data form
const clientDataSchema = z.object({
  id: z.string().optional(), // User ID
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  whatsapp: z.string().optional().or(z.literal("")),
  cidade: z.string().optional().or(z.literal("")),
  estado: z.string().optional().or(z.literal("")),
}).refine(data => data.email || data.whatsapp, {
  message: "Pelo menos um E-mail ou WhatsApp é obrigatório",
  path: ["email"], // Attach error to email field, but applies to both
});

type ClientFormData = z.infer<typeof clientDataSchema> & Record<string, any>; // Allow dynamic fields

const ClientsPage: React.FC = () => {
  const { workspace, loading: sessionLoading } = useSession();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [userDataFields, setUserDataFields] = useState<UserDataField[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientDataSchema),
    defaultValues: {
      nome: "",
      email: "",
      whatsapp: "",
      cidade: "",
      estado: "",
    },
  });

  const fetchClientsAndFields = useCallback(async () => {
    if (!workspace?.id) return;
    setLoadingClients(true);

    // Fetch all user data fields for the workspace
    const { data: fieldsData, error: fieldsError } = await supabase
      .from('user_data_fields')
      .select('id, name, type')
      .eq('workspace_id', workspace.id);

    if (fieldsError) {
      showError("Erro ao carregar definições de campos de dados.");
      console.error(fieldsError);
      setLoadingClients(false);
      return;
    }
    setUserDataFields(fieldsData || []);
    const fieldMap = new Map(fieldsData?.map(f => [f.id, f.name]));
    const fieldTypeMap = new Map(fieldsData?.map(f => [f.name, f.type]));

    // Fetch all profiles and their field values
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url');

    if (profilesError) {
      showError("Erro ao carregar perfis de clientes.");
      console.error(profilesError);
      setLoadingClients(false);
      return;
    }

    const clientPromises = (profilesData || []).map(async (profile) => {
      const { data: fieldValuesData, error: fieldValuesError } = await supabase
        .from('user_field_values')
        .select('field_id, value')
        .eq('user_id', profile.id);

      if (fieldValuesError) {
        console.error(`Error fetching field values for user ${profile.id}:`, fieldValuesError);
        return null;
      }

      const fieldValues: Record<string, string | number | boolean | null> = {};
      (fieldValuesData || []).forEach(fv => {
        const fieldName = fieldMap.get(fv.field_id);
        if (fieldName) {
          const fieldType = fieldTypeMap.get(fieldName);
          let parsedValue: any = fv.value;
          if (fv.value !== null) {
            if (fieldType === 'number') {
              parsedValue = parseFloat(fv.value);
              if (isNaN(parsedValue)) parsedValue = fv.value;
            } else if (fieldType === 'boolean') {
              parsedValue = fv.value.toLowerCase() === 'true';
            }
          }
          fieldValues[fieldName] = parsedValue;
        }
      });

      return { profile, fieldValues };
    });

    const allClients = (await Promise.all(clientPromises)).filter(Boolean) as ClientData[];
    setClients(allClients);
    setLoadingClients(false);
  }, [workspace?.id]);

  useEffect(() => {
    if (!sessionLoading && workspace) {
      fetchClientsAndFields();
    }
  }, [workspace, sessionLoading, fetchClientsAndFields]);

  const openEditModal = (client: ClientData) => {
    setEditingClient(client);
    const defaultValues: ClientFormData = {
      id: client.profile.id,
      nome: client.fieldValues.nome as string || "",
      email: client.fieldValues.email as string || "",
      whatsapp: client.fieldValues.whatsapp as string || "",
      cidade: client.fieldValues.cidade as string || "",
      estado: client.fieldValues.estado as string || "",
    };
    // Set values for custom fields too
    userDataFields.forEach(field => {
      if (!defaultValues.hasOwnProperty(field.name)) {
        defaultValues[field.name] = client.fieldValues[field.name] || "";
      }
    });
    reset(defaultValues);
    setIsModalOpen(true);
  };

  const closeEditModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
    reset();
  };

  const onSaveClientData = async (formData: ClientFormData) => {
    if (!editingClient?.profile.id) {
      showError("ID do cliente não encontrado para salvar.");
      return;
    }

    const userId = editingClient.profile.id;
    const updates = [];

    for (const fieldDef of userDataFields) {
      const newValue = formData[fieldDef.name];
      const currentValue = editingClient.fieldValues[fieldDef.name];

      // Only update if value has changed
      if (String(newValue) !== String(currentValue)) {
        updates.push({
          user_id: userId,
          field_id: fieldDef.id,
          value: newValue !== undefined && newValue !== null ? String(newValue) : null,
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (updates.length === 0) {
      showSuccess("Nenhuma alteração detectada para salvar.");
      closeEditModal();
      return;
    }

    const { error } = await supabase
      .from('user_field_values')
      .upsert(updates, { onConflict: 'user_id,field_id' });

    if (error) {
      showError("Erro ao salvar dados do cliente.");
      console.error(error);
    } else {
      showSuccess("Dados do cliente salvos com sucesso!");
      fetchClientsAndFields(); // Refresh the list
      closeEditModal();
    }
  };

  if (sessionLoading || loadingClients) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Clientes</h1>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Dados dos Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
          ) : (
            <ScrollArea className="h-[600px] w-full rounded-md border p-4">
              <div className="space-y-4">
                {clients.map((client) => (
                  <div key={client.profile.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center space-x-3">
                      {client.profile.avatar_url ? (
                        <img src={client.profile.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <User className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold">{client.fieldValues.nome || client.profile.first_name || "Nome não definido"}</h3>
                        <p className="text-sm text-muted-foreground">
                          {client.fieldValues.email || client.fieldValues.whatsapp || "Contato não definido"}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openEditModal(client)}>
                      <Edit className="h-4 w-4 mr-2" /> Editar
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Cliente: {editingClient?.fieldValues.nome || editingClient?.profile.first_name || "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSaveClientData)} className="space-y-4 py-4">
            {userDataFields.map(field => (
              <div key={field.id}>
                <Label htmlFor={`field-${field.name}`}>{field.name.charAt(0).toUpperCase() + field.name.slice(1).replace(/_/g, ' ')}</Label>
                <Controller
                  name={field.name as keyof ClientFormData}
                  control={control}
                  render={({ field: controllerField }) => {
                    if (field.type === 'boolean') {
                      return (
                        <input
                          type="checkbox"
                          id={`field-${field.name}`}
                          checked={controllerField.value as boolean}
                          onChange={e => controllerField.onChange(e.target.checked)}
                          className="ml-2"
                        />
                      );
                    }
                    return (
                      <Input
                        id={`field-${field.name}`}
                        type={field.type === 'number' ? 'number' : 'text'}
                        placeholder={field.description || `Insira o ${field.name}`}
                        {...controllerField}
                        value={controllerField.value === null || controllerField.value === undefined ? '' : controllerField.value}
                      />
                    );
                  }}
                />
                {errors[field.name] && <p className="text-destructive text-sm mt-1">{errors[field.name]?.message}</p>}
              </div>
            ))}
            {errors.email && !errors.whatsapp && <p className="text-destructive text-sm mt-1">{errors.email.message}</p>}
            {errors.whatsapp && !errors.email && <p className="text-destructive text-sm mt-1">{errors.whatsapp.message}</p>}
            {errors.email && errors.whatsapp && <p className="text-destructive text-sm mt-1">Pelo menos um E-mail ou WhatsApp é obrigatório.</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEditModal}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientsPage;