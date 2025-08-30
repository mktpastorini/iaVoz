"use client";

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface ClientAction {
  id: string;
  trigger_phrase: string;
  action_type: 'OPEN_URL' | 'SHOW_IMAGE' | 'OPEN_IFRAME_URL'; // Adicionado novo tipo
  action_payload: {
    url?: string;
    imageUrl?: string;
    altText?: string;
  };
}

const clientActionSchema = z.object({
  id: z.string().optional(),
  trigger_phrase: z.string().min(1, "Frase de gatilho é obrigatória"),
  action_type: z.enum(['OPEN_URL', 'SHOW_IMAGE', 'OPEN_IFRAME_URL']), // Adicionado novo tipo
  url: z.string().url("URL inválida").optional().nullable(),
  imageUrl: z.string().url("URL da imagem inválida").optional().nullable(),
  altText: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if ((data.action_type === 'OPEN_URL' || data.action_type === 'OPEN_IFRAME_URL') && (!data.url || data.url.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "URL é obrigatória para a ação 'Abrir URL' ou 'Abrir URL em Overlay'.",
      path: ['url'],
    });
  }
  if (data.action_type === 'SHOW_IMAGE' && (!data.imageUrl || data.imageUrl.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "URL da Imagem é obrigatória para a ação 'Mostrar Imagem'.",
      path: ['imageUrl'],
    });
  }
});

type ClientActionFormData = z.infer<typeof clientActionSchema>;

const ClientActionsPage: React.FC = () => {
  const { workspace, loading: sessionLoading } = useSession();
  const [actions, setActions] = useState<ClientAction[]>([]);
  const [loadingActions, setLoadingActions] = useState(true);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClientActionFormData>({
    resolver: zodResolver(clientActionSchema),
    defaultValues: {
      trigger_phrase: "",
      action_type: "OPEN_URL",
      url: "",
      imageUrl: "",
      altText: "",
    },
  });

  const actionType = watch("action_type");

  const fetchActions = async () => {
    if (!workspace?.id) return;
    setLoadingActions(true);
    const { data, error } = await supabase.from('client_actions').select('*').eq('workspace_id', workspace.id);
    if (error) {
      showError("Erro ao carregar ações.");
    } else {
      setActions(data || []);
    }
    setLoadingActions(false);
  };

  useEffect(() => {
    if (!sessionLoading && workspace) {
      fetchActions();
    }
  }, [workspace, sessionLoading]);

  const onSubmit = async (formData: ClientActionFormData) => {
    if (!workspace) return;

    let payload = {};
    if (formData.action_type === 'OPEN_URL' || formData.action_type === 'OPEN_IFRAME_URL') {
      payload = { url: formData.url };
    } else if (formData.action_type === 'SHOW_IMAGE') {
      payload = { imageUrl: formData.imageUrl, altText: formData.altText };
    }

    const actionData = {
      workspace_id: workspace.id,
      trigger_phrase: formData.trigger_phrase.toLowerCase(),
      action_type: formData.action_type,
      action_payload: payload,
    };

    let error;
    if (editingActionId) {
      const { error: updateError } = await supabase.from('client_actions').update(actionData).eq('id', editingActionId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('client_actions').insert(actionData);
      error = insertError;
    }

    if (error) {
      showError(`Erro ao ${editingActionId ? 'atualizar' : 'salvar'} ação.`);
    } else {
      showSuccess(`Ação ${editingActionId ? 'atualizada' : 'salva'} com sucesso!`);
      reset();
      setEditingActionId(null);
      fetchActions();
    }
  };

  const onEdit = (action: ClientAction) => {
    setEditingActionId(action.id);
    reset({
      id: action.id,
      trigger_phrase: action.trigger_phrase,
      action_type: action.action_type,
      url: action.action_payload.url,
      imageUrl: action.action_payload.imageUrl,
      altText: action.action_payload.altText,
    });
  };

  const onDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta ação?")) return;
    const { error } = await supabase.from('client_actions').delete().eq('id', id);
    if (error) {
      showError("Erro ao excluir ação.");
    } else {
      showSuccess("Ação excluída com sucesso!");
      fetchActions();
      if (editingActionId === id) {
        reset();
        setEditingActionId(null);
      }
    }
  };

  if (sessionLoading || loadingActions) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Ações do Cliente</h1>
      <Card>
        <CardHeader><CardTitle>{editingActionId ? "Editar Ação" : "Adicionar Nova Ação"}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="trigger_phrase">Frase de Gatilho</Label>
              <Input id="trigger_phrase" placeholder="Ex: abrir google, mostrar logo" {...register("trigger_phrase")} />
              {errors.trigger_phrase && <p className="text-destructive text-sm mt-1">{errors.trigger_phrase.message}</p>}
            </div>
            <div>
              <Label htmlFor="action_type">Tipo de Ação</Label>
              <Select onValueChange={(value) => setValue("action_type", value as any)} value={actionType}>
                <SelectTrigger id="action_type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN_URL">Abrir URL em Nova Aba</SelectItem>
                  <SelectItem value="OPEN_IFRAME_URL">Abrir URL em Overlay</SelectItem> {/* Nova opção */}
                  <SelectItem value="SHOW_IMAGE">Mostrar Imagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(actionType === 'OPEN_URL' || actionType === 'OPEN_IFRAME_URL') && (
              <div>
                <Label htmlFor="url">URL para Abrir</Label>
                <Input id="url" type="url" placeholder="https://google.com" {...register("url")} />
                {errors.url && <p className="text-destructive text-sm mt-1">{errors.url.message}</p>}
              </div>
            )}
            {actionType === 'SHOW_IMAGE' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="imageUrl">URL da Imagem</Label>
                  <Input id="imageUrl" type="url" placeholder="https://site.com/imagem.png" {...register("imageUrl")} />
                  {errors.imageUrl && <p className="text-destructive text-sm mt-1">{errors.imageUrl.message}</p>}
                </div>
                <div>
                  <Label htmlFor="altText">Texto Alternativo (Opcional)</Label>
                  <Input id="altText" placeholder="Descrição da imagem" {...register("altText")} />
                </div>
              </div>
            )}
            <div className="flex space-x-2">
              <Button type="submit" disabled={isSubmitting}><PlusCircle className="mr-2 h-4 w-4" /> {editingActionId ? "Salvar" : "Adicionar"}</Button>
              {editingActionId && <Button type="button" variant="outline" onClick={() => { reset(); setEditingActionId(null); }}>Cancelar</Button>}
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Ações Existentes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {actions.map(action => (
            <div key={action.id} className="flex justify-between items-center p-2 border rounded">
              <div>
                <p className="font-semibold">{action.trigger_phrase}</p>
                <p className="text-sm text-muted-foreground">
                  {action.action_type === 'OPEN_URL' && `Abrir em Nova Aba: ${action.action_payload.url}`}
                  {action.action_type === 'OPEN_IFRAME_URL' && `Abrir em Overlay: ${action.action_payload.url}`}
                  {action.action_type === 'SHOW_IMAGE' && `Mostrar Imagem`}
                </p>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="icon" onClick={() => onEdit(action)}><Edit className="h-4 w-4" /></Button>
                <Button variant="destructive" size="icon" onClick={() => onDelete(action.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientActionsPage;