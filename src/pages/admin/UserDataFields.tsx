"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Trash2, Edit } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Tipos para o Supabase
interface UserDataField {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  type: 'string' | 'number' | 'boolean';
  created_at: string;
}

// Esquema de validação para o formulário de Campos de Dados do Usuário
const userDataFieldSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Nome do campo é obrigatório").regex(/^[a-zA-Z0-9_]+$/, "Nome do campo deve conter apenas letras, números e _"),
  description: z.string().optional().nullable(),
  type: z.enum(['string', 'number', 'boolean']),
});

type UserDataFieldFormData = z.infer<typeof userDataFieldSchema>;

// Fixed fields that cannot be deleted
const FIXED_FIELDS = [
  { name: 'nome', description: 'Nome completo do cliente', type: 'string' },
  { name: 'email', description: 'Endereço de e-mail do cliente', type: 'string' },
  { name: 'whatsapp', description: 'Número de WhatsApp do cliente', type: 'string' },
  { name: 'cidade', description: 'Cidade de residência do cliente', type: 'string' },
  { name: 'estado', description: 'Estado de residência do cliente', type: 'string' },
];

const UserDataFieldsPage: React.FC = () => {
  const { workspace, loading: sessionLoading } = useSession();
  const [fields, setFields] = useState<UserDataField[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UserDataFieldFormData>({
    resolver: zodResolver(userDataFieldSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "string",
    },
  });

  const fetchFields = useCallback(async () => {
    if (!workspace?.id) return;
    setLoadingFields(true);
    const { data, error } = await supabase
      .from('user_data_fields')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('name', { ascending: true });

    if (error) {
      showError("Erro ao carregar campos de dados do usuário.");
      console.error(error);
    } else {
      const existingFieldNames = new Set(data?.map(f => f.name));
      const missingFixedFields = FIXED_FIELDS.filter(ff => !existingFieldNames.has(ff.name));

      if (missingFixedFields.length > 0) {
        console.log("Inserting missing fixed fields:", missingFixedFields.map(f => f.name));
        const { error: insertError } = await supabase.from('user_data_fields').insert(
          missingFixedFields.map(ff => ({
            workspace_id: workspace.id,
            name: ff.name,
            description: ff.description,
            type: ff.type,
          }))
        );
        if (insertError) {
          console.error("Error inserting fixed fields:", insertError);
          showError("Erro ao adicionar campos fixos.");
        } else {
          // Refetch after inserting
          const { data: updatedData, error: updatedError } = await supabase
            .from('user_data_fields')
            .select('*')
            .eq('workspace_id', workspace.id)
            .order('name', { ascending: true });
          if (!updatedError) setFields(updatedData || []);
        }
      } else {
        setFields(data || []);
      }
    }
    setLoadingFields(false);
  }, [workspace?.id]);

  useEffect(() => {
    if (!sessionLoading && workspace) {
      fetchFields();
    }
  }, [workspace, sessionLoading, fetchFields]);

  const onSubmit = async (formData: UserDataFieldFormData) => {
    if (!workspace) {
      showError("Workspace não encontrado.");
      return;
    }

    const fieldData = {
      workspace_id: workspace.id,
      name: formData.name,
      description: formData.description,
      type: formData.type,
    };

    let error;
    if (editingFieldId) {
      const { error: updateError } = await supabase.from('user_data_fields').update(fieldData).eq('id', editingFieldId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('user_data_fields').insert(fieldData);
      error = insertError;
    }

    if (error) {
      showError(`Erro ao ${editingFieldId ? 'atualizar' : 'adicionar'} campo de dados.`);
      console.error(error);
    } else {
      showSuccess(`Campo de dados ${editingFieldId ? 'atualizado' : 'adicionado'} com sucesso!`);
      reset();
      setEditingFieldId(null);
      fetchFields();
    }
  };

  const onEdit = (field: UserDataField) => {
    setEditingFieldId(field.id);
    reset(field);
  };

  const onDelete = async (id: string, name: string) => {
    if (FIXED_FIELDS.some(ff => ff.name === name)) {
      showError("Este campo é fixo e não pode ser excluído.");
      return;
    }
    if (!confirm("Tem certeza que deseja excluir este campo de dados?")) return;
    const { error } = await supabase.from('user_data_fields').delete().eq('id', id);
    if (error) {
      showError("Erro ao excluir campo de dados.");
      console.error(error);
    } else {
      showSuccess("Campo de dados excluído com sucesso!");
      fetchFields();
      if (editingFieldId === id) {
        reset();
        setEditingFieldId(null);
      }
    }
  };

  if (sessionLoading || loadingFields) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Campos de Dados do Usuário</h1>

      <Card>
        <CardHeader>
          <CardTitle>Como Usar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Defina campos personalizados para armazenar informações específicas de cada usuário durante a interação com o assistente.
          </p>
          <p>
            Estes campos podem ser preenchidos e consultados pela IA através de "Poderes Internos" que serão configurados na próxima etapa.
          </p>
          <p className="p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
            Exemplo de uso pela IA: "Qual o nome do cliente?" ou "Salvar o email do cliente como {'{email_cliente}'}".
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{editingFieldId ? "Editar Campo de Dados" : "Adicionar Novo Campo de Dados"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="field-name">Nome do Campo (chave)</Label>
              <Input id="field-name" placeholder="Ex: nome_cliente, email_lead" {...register("name")} disabled={editingFieldId !== null && FIXED_FIELDS.some(ff => ff.name === watch("name"))} />
              {errors.name && <p className="text-destructive text-sm mt-1">{errors.name.message}</p>}
              <p className="text-sm text-muted-foreground mt-1">Use apenas letras, números e sublinhados. Este será o nome da chave para a IA.</p>
            </div>
            <div>
              <Label htmlFor="field-description">Descrição (para a IA)</Label>
              <Textarea id="field-description" placeholder="Descreva o propósito deste campo para a IA." rows={2} {...register("description")} />
            </div>
            <div>
              <Label htmlFor="field-type">Tipo de Dado</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value} disabled={editingFieldId !== null && FIXED_FIELDS.some(ff => ff.name === watch("name"))}>
                    <SelectTrigger id="field-type"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">Texto (String)</SelectItem>
                      <SelectItem value="number">Número (Number)</SelectItem>
                      <SelectItem value="boolean">Booleano (True/False)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex space-x-2">
              <Button type="submit" disabled={isSubmitting}><PlusCircle className="mr-2 h-4 w-4" /> {editingFieldId ? "Salvar Alterações" : "Adicionar Campo"}</Button>
              {editingFieldId && (<Button type="button" variant="outline" onClick={() => { reset(); setEditingFieldId(null); }} className="ml-2">Cancelar Edição</Button>)}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Campos de Dados Existentes</CardTitle></CardHeader>
        <CardContent>
          {fields.length === 0 ? (<p className="text-muted-foreground">Nenhum campo de dados adicionado ainda.</p>) : (
            <div className="space-y-4">
              {fields.map((field) => (
                <div key={field.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <h3 className="font-semibold">{field.name} <span className="text-xs text-blue-500">({field.type})</span></h3>
                    <p className="text-sm text-muted-foreground">{field.description}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(field)}><Edit className="h-4 w-4" /></Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => onDelete(field.id, field.name)}
                            disabled={FIXED_FIELDS.some(ff => ff.name === field.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {FIXED_FIELDS.some(ff => ff.name === field.name) && (
                        <TooltipContent>
                          <p>Este é um campo fixo e não pode ser excluído.</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserDataFieldsPage;