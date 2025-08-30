"use client";

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Trash2, Edit, Copy } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

interface ProductService {
  id: string;
  name: string;
  description: string | null;
  page_url: string | null;
  image_url: string | null;
  video_url: string | null;
  item_key: string | null;
}

const productServiceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional().nullable(),
  page_url: z.string().url("URL da página inválida").or(z.literal('')).optional().nullable(),
  image_url: z.string().url("URL da imagem inválida").or(z.literal('')).optional().nullable(),
  video_url: z.string().url("URL do vídeo inválida").or(z.literal('')).optional().nullable(),
});

type ProductServiceFormData = z.infer<typeof productServiceSchema>;

const generateKeyFromName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize("NFD") // Normaliza para decompor acentos
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/\s+/g, '_') // Substitui espaços por underscores
    .replace(/[^a-z0-9_]/g, ''); // Remove caracteres não alfanuméricos
};

const ProductsServicesPage: React.FC = () => {
  const { workspace, loading: sessionLoading } = useSession();
  const [productsServices, setProductsServices] = useState<ProductService[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductServiceFormData>({
    resolver: zodResolver(productServiceSchema),
    defaultValues: { name: "", description: "", page_url: "", image_url: "", video_url: "" },
  });

  const fetchProductsServices = async () => {
    if (!workspace?.id) return;
    setLoadingData(true);
    const { data, error } = await supabase.from('products_services').select('*').eq('workspace_id', workspace.id).order('name', { ascending: true });
    if (error) {
      showError("Erro ao carregar produtos/serviços.");
    } else {
      setProductsServices(data || []);
    }
    setLoadingData(false);
  };

  useEffect(() => {
    if (!sessionLoading && workspace) fetchProductsServices();
  }, [workspace, sessionLoading]);

  const onSubmit = async (formData: ProductServiceFormData) => {
    if (!workspace) return;

    const itemKey = generateKeyFromName(formData.name);
    if (!itemKey) {
      showError("O nome do produto/serviço deve conter caracteres válidos para gerar uma chave.");
      return;
    }

    const dataToSave = {
      workspace_id: workspace.id,
      name: formData.name,
      item_key: itemKey,
      description: formData.description || null,
      page_url: formData.page_url || null,
      image_url: formData.image_url || null,
      video_url: formData.video_url || null,
    };

    let error;
    if (editingId) {
      const { error: updateError } = await supabase.from('products_services').update(dataToSave).eq('id', editingId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('products_services').insert(dataToSave);
      error = insertError;
    }

    if (error) {
      if (error.code === '23505') { // Erro de violação de unicidade
        showError("Já existe um produto/serviço com um nome similar. Por favor, escolha um nome diferente.");
      } else {
        showError(`Erro ao ${editingId ? 'atualizar' : 'adicionar'} produto/serviço.`);
      }
      console.error(error);
    } else {
      showSuccess(`Produto/serviço ${editingId ? 'atualizado' : 'adicionado'} com sucesso!`);
      reset();
      setEditingId(null);
      fetchProductsServices();
    }
  };

  const onEdit = (item: ProductService) => {
    setEditingId(item.id);
    reset({
      id: item.id,
      name: item.name,
      description: item.description || "",
      page_url: item.page_url || "",
      image_url: item.image_url || "",
      video_url: item.video_url || "",
    });
  };

  const onDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto/serviço?")) return;
    const { error } = await supabase.from('products_services').delete().eq('id', id);
    if (error) {
      showError("Erro ao excluir produto/serviço.");
    } else {
      showSuccess("Produto/serviço excluído com sucesso!");
      fetchProductsServices();
      if (editingId === id) {
        reset();
        setEditingId(null);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess("Chave copiada!");
  };

  if (sessionLoading || loadingData) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Produtos e Serviços</h1>
      <Card>
        <CardHeader><CardTitle>{editingId ? "Editar" : "Adicionar Novo"} Produto/Serviço</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div><Label htmlFor="name">Nome</Label><Input id="name" placeholder="Ex: Consultoria de IA" {...register("name")} />{errors.name && <p className="text-destructive text-sm mt-1">{errors.name.message}</p>}</div>
            <div><Label htmlFor="description">Descrição (para o assistente falar)</Label><Textarea id="description" placeholder="Uma breve descrição..." rows={3} {...register("description")} /></div>
            <div><Label htmlFor="page_url">URL da Página (Opcional)</Label><Input id="page_url" type="url" placeholder="https://..." {...register("page_url")} />{errors.page_url && <p className="text-destructive text-sm mt-1">{errors.page_url.message}</p>}</div>
            <div><Label htmlFor="image_url">URL da Imagem (Opcional)</Label><Input id="image_url" type="url" placeholder="https://..." {...register("image_url")} />{errors.image_url && <p className="text-destructive text-sm mt-1">{errors.image_url.message}</p>}</div>
            <div><Label htmlFor="video_url">URL do Vídeo (Opcional)</Label><Input id="video_url" type="url" placeholder="https://..." {...register("video_url")} />{errors.video_url && <p className="text-destructive text-sm mt-1">{errors.video_url.message}</p>}</div>
            <div className="flex space-x-2">
              <Button type="submit" disabled={isSubmitting}><PlusCircle className="mr-2 h-4 w-4" /> {editingId ? "Salvar" : "Adicionar"}</Button>
              {editingId && <Button type="button" variant="outline" onClick={() => { reset(); setEditingId(null); }}>Cancelar</Button>}
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Produtos e Serviços Existentes</CardTitle></CardHeader>
        <CardContent>
          {productsServices.length === 0 ? <p className="text-muted-foreground">Nenhum item adicionado.</p> : (
            <div className="space-y-4">
              {productsServices.map((item) => (
                <div key={item.id} className="p-3 border rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{item.name}</h3>
                      {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => onEdit(item)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="destructive" size="sm" onClick={() => onDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  {item.item_key && (
                    <div className="mt-3 pt-3 border-t text-xs text-muted-foreground space-y-1">
                      <h4 className="font-semibold text-sm">Chaves de Variáveis:</h4>
                      <div className="flex items-center gap-2"><code>{`{${item.item_key}_name}`}</code><Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(`{${item.item_key}_name}`)}><Copy className="h-3 w-3" /></Button></div>
                      {item.description && <div className="flex items-center gap-2"><code>{`{${item.item_key}_description}`}</code><Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(`{${item.item_key}_description}`)}><Copy className="h-3 w-3" /></Button></div>}
                      {item.page_url && <div className="flex items-center gap-2"><code>{`{${item.item_key}_page_url}`}</code><Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(`{${item.item_key}_page_url}`)}><Copy className="h-3 w-3" /></Button></div>}
                      {item.image_url && <div className="flex items-center gap-2"><code>{`{${item.item_key}_image_url}`}</code><Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(`{${item.item_key}_image_url}`)}><Copy className="h-3 w-3" /></Button></div>}
                      {item.video_url && <div className="flex items-center gap-2"><code>{`{${item.item_key}_video_url}`}</code><Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(`{${item.item_key}_video_url}`)}><Copy className="h-3 w-3" /></Button></div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductsServicesPage;