"use client";

import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Trash2, Edit, Play } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from '@/contexts/SessionContext';
import { useSystem } from '@/contexts/SystemContext'; // Importar o hook do sistema
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { replacePlaceholders } from '@/lib/utils'; // Importar a função utilitária

// Tipos para o Supabase
interface Power {
  id: string;
  name: string;
  description: string | null;
  method: string;
  url: string | null;
  headers: Record<string, string> | null;
  body: Record<string, any> | null;
  api_key_id: string | null;
  parameters_schema: Record<string, any> | null;
}

interface ApiKey {
  id: string;
  label: string;
  provider: string;
}

// Esquema de validação para o formulário de Poderes
const powerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Nome do Poder é obrigatório"),
  description: z.string().optional().nullable(),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  url: z.string().url("URL inválida").optional().nullable(),
  headers: z.string().optional().nullable(), // JSON string
  body: z.string().optional().nullable(), // JSON string
  api_key_id: z.string().optional().nullable(),
  parameters_schema: z.string().optional().nullable(), // JSON string
  // Campo para o editor de formulário, não vai para o DB diretamente
  formParameters: z.array(z.object({
    name: z.string().min(1, "Nome do atributo é obrigatório"),
    type: z.enum(['string', 'number', 'boolean']),
    description: z.string().min(1, "Descrição é obrigatória"),
    required: z.boolean(),
  })).optional(),
});

type PowerFormData = z.infer<typeof powerSchema>;

const PowersPage: React.FC = () => {
  const { workspace, loading: sessionLoading } = useSession();
  const { systemVariables } = useSystem(); // Obter as variáveis do sistema
  const [powers, setPowers] = useState<Power[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loadingPowers, setLoadingPowers] = useState(true);
  const [editingPowerId, setEditingPowerId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testingPower, setTestingPower] = useState(false);
  const [editorMode, setEditorMode] = useState<'form' | 'json'>('form');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PowerFormData>({
    resolver: zodResolver(powerSchema),
    defaultValues: {
      name: "",
      description: "",
      method: "GET",
      url: "",
      headers: '{"Content-Type": "application/json"}',
      body: "{}",
      api_key_id: null,
      parameters_schema: '{\n  "type": "object",\n  "properties": {},\n  "required": []\n}',
      formParameters: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "formParameters",
  });

  const currentMethod = watch("method");
  const formParameters = watch("formParameters");

  // Sincroniza o editor de formulário com o campo de texto JSON
  useEffect(() => {
    if (editorMode === 'form') {
      try {
        const schema = {
          type: "object",
          properties: formParameters.reduce((acc, param) => {
            if (param.name) {
              acc[param.name] = {
                type: param.type,
                description: param.description,
              };
            }
            return acc;
          }, {} as Record<string, any>),
          required: formParameters.filter(p => p.required && p.name).map(p => p.name),
        };
        setValue("parameters_schema", JSON.stringify(schema, null, 2));
      } catch (e) {
        console.error("Erro ao gerar JSON Schema a partir do formulário:", e);
      }
    }
  }, [formParameters, editorMode, setValue]);

  // Carregar poderes e chaves de API
  useEffect(() => {
    const fetchPowersAndApiKeys = async () => {
      if (!workspace?.id) return;
      setLoadingPowers(true);
      const { data: powersData, error: powersError } = await supabase.from('powers').select('*').eq('workspace_id', workspace.id);
      if (powersError) {
        showError("Erro ao carregar poderes.");
        console.error(powersError);
      } else {
        setPowers(powersData || []);
      }
      const { data: apiKeysData, error: apiKeysError } = await supabase.from('api_keys').select('id, label, provider').eq('workspace_id', workspace.id);
      if (apiKeysError) {
        showError("Erro ao carregar chaves de API.");
        console.error(apiKeysError);
      } else {
        setApiKeys(apiKeysData || []);
      }
      setLoadingPowers(false);
    };
    if (!sessionLoading && workspace) {
      fetchPowersAndApiKeys();
    }
  }, [workspace, sessionLoading]);

  const parseSchemaToFields = (schema: Record<string, any> | null) => {
    if (!schema || !schema.properties) return [];
    const requiredFields = new Set(schema.required || []);
    return Object.entries(schema.properties).map(([name, props]) => ({
      name,
      type: props.type || 'string',
      description: props.description || '',
      required: requiredFields.has(name),
    }));
  };

  const handleTabChange = (newMode: 'form' | 'json') => {
    if (newMode === 'form') {
      try {
        const schemaStr = getValues("parameters_schema") || '{}';
        const schema = JSON.parse(schemaStr);
        const fields = parseSchemaToFields(schema);
        setValue("formParameters", fields);
      } catch (e) {
        showError("O JSON Schema atual é inválido. Corrija-o antes de mudar para o modo formulário.");
        return; // Impede a mudança de aba
      }
    }
    setEditorMode(newMode);
  };

  const onSubmit = async (formData: PowerFormData) => {
    if (!workspace) {
      showError("Workspace não encontrado.");
      return;
    }
    try {
      const parsedHeaders = formData.headers ? JSON.parse(formData.headers) : {};
      const parsedBody = (formData.body && (currentMethod === "POST" || currentMethod === "PUT" || currentMethod === "PATCH")) ? JSON.parse(formData.body) : {};
      const parsedParametersSchema = formData.parameters_schema ? JSON.parse(formData.parameters_schema) : {};
      const powerData = {
        workspace_id: workspace.id,
        name: formData.name,
        description: formData.description,
        method: formData.method,
        url: formData.url,
        headers: parsedHeaders,
        body: parsedBody,
        api_key_id: formData.api_key_id || null,
        parameters_schema: parsedParametersSchema,
      };
      let error;
      if (editingPowerId) {
        const { error: updateError } = await supabase.from('powers').update(powerData).eq('id', editingPowerId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('powers').insert(powerData);
        error = insertError;
      }
      if (error) {
        showError(`Erro ao ${editingPowerId ? 'atualizar' : 'adicionar'} poder.`);
        console.error(error);
      } else {
        showSuccess(`Poder ${editingPowerId ? 'atualizado' : 'adicionado'} com sucesso!`);
        reset();
        setEditingPowerId(null);
        setTestResult(null);
        const { data: updatedPowers, error: fetchError } = await supabase.from('powers').select('*').eq('workspace_id', workspace.id);
        if (!fetchError) setPowers(updatedPowers || []);
      }
    } catch (e: any) {
      showError(`Erro ao processar JSON: ${e.message}`);
      console.error(e);
    }
  };

  const onEdit = (power: Power) => {
    setEditingPowerId(power.id);
    const formValues = {
      ...power,
      headers: JSON.stringify(power.headers || {}, null, 2),
      body: JSON.stringify(power.body || {}, null, 2),
      parameters_schema: JSON.stringify(power.parameters_schema || {}, null, 2),
      formParameters: parseSchemaToFields(power.parameters_schema),
    };
    reset(formValues);
    setTestResult(null);
    setEditorMode('form');
  };

  const onDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este poder?")) return;
    const { error } = await supabase.from('powers').delete().eq('id', id);
    if (error) {
      showError("Erro ao excluir poder.");
      console.error(error);
    } else {
      showSuccess("Poder excluído com sucesso!");
      setPowers(powers.filter(p => p.id !== id));
      if (editingPowerId === id) {
        reset();
        setEditingPowerId(null);
        setTestResult(null);
      }
    }
  };

  const handleTestPower = async () => {
    setTestingPower(true);
    setTestResult(null);
    const formData = getValues();
    if (!formData.url) {
      showError("URL do Endpoint é obrigatória para testar.");
      setTestingPower(false);
      return;
    }
    try {
      // Substituir placeholders antes de enviar
      const processedUrl = replacePlaceholders(formData.url || '', systemVariables);
      const processedHeadersStr = replacePlaceholders(formData.headers || '{}', systemVariables);
      const processedBodyStr = replacePlaceholders(formData.body || '{}', systemVariables);

      const parsedHeaders = JSON.parse(processedHeadersStr);
      const parsedBody = (currentMethod === "POST" || currentMethod === "PUT" || currentMethod === "PATCH") ? JSON.parse(processedBodyStr) : undefined;
      
      const payload = { url: processedUrl, method: formData.method, headers: parsedHeaders, body: parsedBody };
      
      const { data, error: invokeError } = await supabase.functions.invoke('proxy-api', { body: payload });
      if (invokeError) {
        let detailedError = invokeError.message;
        let errorStack = (invokeError as any).stack;
        if ((invokeError as any).context && typeof (invokeError as any).context.json === 'function') {
          try {
            const errorBody = await (invokeError as any).context.json();
            detailedError = errorBody.error || detailedError;
            errorStack = errorBody.stack || errorStack;
          } catch (e) {
            console.error("Could not parse JSON from Edge Function error response:", e);
          }
        }
        showError(`Erro da Edge Function: ${detailedError}`);
        setTestResult({ error: `Erro da Edge Function: ${detailedError}`, details: errorStack });
        console.error("Erro ao invocar Edge Function:", invokeError);
        return;
      }
      setTestResult(data);
      showSuccess("Teste de poder concluído via Edge Function!");
    } catch (e: any) {
      showError(`Erro ao testar poder: ${e.message}`);
      setTestResult({ error: `Erro ao testar poder: ${e.message}`, details: e.stack });
      console.error("Erro ao testar poder:", e);
    } finally {
      setTestingPower(false);
    }
  };

  if (sessionLoading || loadingPowers) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Poderes da IA (APIs/Webhooks)</h1>
      <Card>
        <CardHeader><CardTitle>{editingPowerId ? "Editar Poder" : "Adicionar Novo Poder"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="power-name">Nome do Poder</Label>
              <Input id="power-name" placeholder="Ex: data_hora, clima_cidade" {...register("name")} />
              {errors.name && <p className="text-destructive text-sm mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="power-description">Descrição (para o prompt da IA)</Label>
              <Textarea id="power-description" placeholder="Descreva o que este poder faz e como a IA deve usá-lo." rows={3} {...register("description")} />
            </div>
            <div>
              <Label>Esquema de Parâmetros</Label>
              <Tabs value={editorMode} onValueChange={(value) => handleTabChange(value as 'form' | 'json')} className="w-full">
                <TabsList><TabsTrigger value="form">Formulário</TabsTrigger><TabsTrigger value="json">JSON</TabsTrigger></TabsList>
                <TabsContent value="form" className="space-y-2 rounded-md border p-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-start border-b pb-2">
                      <div className="col-span-3"><Label>Atributo</Label><Input placeholder="nome_param" {...register(`formParameters.${index}.name`)} /></div>
                      <div className="col-span-2"><Label>Tipo</Label>
                        <Controller control={control} name={`formParameters.${index}.type`} render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="string">String</SelectItem><SelectItem value="number">Number</SelectItem><SelectItem value="boolean">Boolean</SelectItem></SelectContent>
                          </Select>)} />
                      </div>
                      <div className="col-span-5"><Label>Descrição</Label><Input placeholder="Descrição para a IA" {...register(`formParameters.${index}.description`)} /></div>
                      <div className="col-span-1 flex flex-col items-center pt-1"><Label className="mb-2">Obrigatório</Label>
                        <Controller control={control} name={`formParameters.${index}.required`} render={({ field }) => (
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />)} />
                      </div>
                      <div className="col-span-1 flex items-end"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button></div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '', type: 'string', description: '', required: false })}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Parâmetro</Button>
                </TabsContent>
                <TabsContent value="json">
                  <Textarea id="power-parameters-schema" placeholder='Define o JSON Schema para os parâmetros' rows={8} {...register("parameters_schema")} />
                  {errors.parameters_schema && <p className="text-destructive text-sm mt-1">{errors.parameters_schema.message as string}</p>}
                </TabsContent>
              </Tabs>
            </div>
            <div>
              <Label htmlFor="power-method">Método HTTP</Label>
              <Select onValueChange={(value) => setValue("method", value as any)} value={currentMethod}>
                <SelectTrigger id="power-method"><SelectValue placeholder="Selecione o método" /></SelectTrigger>
                <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem><SelectItem value="PUT">PUT</SelectItem><SelectItem value="DELETE">DELETE</SelectItem><SelectItem value="PATCH">PATCH</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="power-url">URL do Endpoint</Label>
              <Input id="power-url" placeholder="https://api.exemplo.com/recurso" {...register("url")} />
              {errors.url && <p className="text-destructive text-sm mt-1">{errors.url.message}</p>}
            </div>
            <div>
              <Label htmlFor="power-headers">Cabeçalhos (JSON)</Label>
              <Textarea id="power-headers" placeholder='{"Content-Type": "application/json"}' rows={3} {...register("headers")} />
            </div>
            {(currentMethod === "POST" || currentMethod === "PUT" || currentMethod === "PATCH") && (
              <div><Label htmlFor="power-body">Corpo da Requisição (JSON)</Label><Textarea id="power-body" placeholder='{"chave": "valor"}' rows={5} {...register("body")} /></div>
            )}
            <div>
              <Label htmlFor="power-api-key">Chave de API (Opcional)</Label>
              <Select onValueChange={(value) => setValue("api_key_id", value === "none" ? null : value)} value={watch("api_key_id") || "none"}>
                <SelectTrigger id="power-api-key"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Nenhuma</SelectItem>{apiKeys.map((key) => (<SelectItem key={key.id} value={key.id}>{key.label} ({key.provider})</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="flex space-x-2">
              <Button type="submit" disabled={isSubmitting}><PlusCircle className="mr-2 h-4 w-4" /> {editingPowerId ? "Salvar Alterações" : "Adicionar Poder"}</Button>
              <Button type="button" onClick={handleTestPower} disabled={testingPower || isSubmitting} variant="secondary"><Play className="mr-2 h-4 w-4" /> {testingPower ? "Testando..." : "Testar Poder"}</Button>
              {editingPowerId && (<Button type="button" variant="outline" onClick={() => { reset(); setEditingPowerId(null); setTestResult(null); }} className="ml-2">Cancelar Edição</Button>)}
            </div>
          </form>
        </CardContent>
      </Card>
      {testResult && (
        <Card>
          <CardHeader><CardTitle>Resultado do Teste</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {testResult.error ? (
              <div className="text-destructive">
                <p className="font-semibold">Erro:</p><pre className="bg-red-100 dark:bg-red-900 p-2 rounded-md text-sm overflow-auto">{testResult.error}</pre>
                {testResult.details && (<><p className="font-semibold mt-2">Detalhes:</p><pre className="bg-red-100 dark:bg-red-900 p-2 rounded-md text-sm overflow-auto">{testResult.details}</pre></>)}
              </div>
            ) : (
              <div>
                <p className={testResult.ok ? "text-green-600" : "text-orange-600"}>Status: {testResult.status} {testResult.statusText} ({testResult.ok ? "OK" : "Erro"})</p>
                <p className="font-semibold mt-2">Headers da Resposta:</p><pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md text-sm overflow-auto">{JSON.stringify(testResult.headers, null, 2)}</pre>
                <p className="font-semibold mt-2">Dados da Resposta:</p><pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md text-sm overflow-auto">{typeof testResult.data === 'object' ? JSON.stringify(testResult.data, null, 2) : testResult.data}</pre>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4">Nota: Este teste utiliza uma Edge Function do Supabase para contornar problemas de CORS.</p>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Poderes Existentes</CardTitle></CardHeader>
        <CardContent>
          {powers.length === 0 ? (<p className="text-muted-foreground">Nenhum poder adicionado ainda.</p>) : (
            <div className="space-y-4">
              {powers.map((power) => (
                <div key={power.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <h3 className="font-semibold">{power.name}</h3>
                    <p className="text-sm text-muted-foreground">{power.description}</p>
                    <p className="text-xs text-muted-foreground">{power.method} {power.url}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(power)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="destructive" size="sm" onClick={() => onDelete(power.id)}><Trash2 className="h-4 w-4" /></Button>
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

export default PowersPage;