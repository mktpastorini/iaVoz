"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { FieldInsertPopover } from "@/components/FieldInsertPopover";
import { Badge } from "@/components/ui/badge";
import { X, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Interface para o tipo de dado do campo do usuário
interface UserDataField {
  id: string;
  name: string;
  description: string | null;
  type: 'string' | 'number' | 'boolean';
}

// Interface para o tipo de dado do Poder (simplificada para o popover)
interface Power {
  id: string;
  name: string;
  description: string | null;
}

const settingsSchema = z.object({
  system_prompt: z.string().min(10, "Prompt do sistema é obrigatório"),
  assistant_prompt: z.string().min(10, "Prompt do assistente é obrigatório"),
  ai_model: z.enum(["gpt-4-turbo", "gpt-3.5-turbo", "gemini-pro", "gpt-4o-mini"]),
  voice_model: z.enum(["browser", "openai-tts", "gemini-tts"]),
  openai_tts_voice: z.string().optional().nullable(),
  voice_sensitivity: z.number().min(0).max(100),
  openai_api_key: z.string().optional().nullable(),
  gemini_api_key: z.string().optional().nullable(),
  deepgram_api_key: z.string().optional().nullable(),
  openai_stt_api_key: z.string().optional().nullable(), // Nova chave
  google_stt_api_key: z.string().optional().nullable(), // Nova chave
  conversation_memory_length: z.number().min(0).max(10),
  activation_phrases: z.array(z.string()).min(1, "É necessária pelo menos uma frase de ativação."),
  deactivation_phrases: z.array(z.string()).min(1, "É necessária pelo menos uma frase de desativação."),
  welcome_message: z.string().optional().nullable(),
  continuation_phrase: z.string().optional().nullable(),
  show_transcript: z.boolean(),
  input_mode: z.enum(['local', 'streaming']),
  output_mode: z.enum(['buffered', 'streaming']),
  streaming_stt_provider: z.enum(['deepgram', 'openai', 'google']).optional().nullable(), // Novo seletor
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const defaultValues: SettingsFormData = {
  system_prompt:
    `Você é Intra, a IA da Intratégica.

Regras de Clientes:
- Clientes são identificados por um 'client_code' único (ex: CL000001) ou por 'name'. Sempre dê preferência ao 'client_code' se você o conhecer, pois é mais preciso.
- Ao criar um novo cliente, um 'client_code' será gerado automaticamente. Informe o usuário sobre o código gerado.
- Se o usuário fornecer informações de um cliente em partes, colete todos os detalhes antes de chamar 'save_client_data'.
- Ao chamar 'save_client_data', inclua TODAS as informações do cliente que você coletou na conversa.

Ferramentas Disponíveis (Poderes):
- get_client_data: Use para buscar um cliente pelo 'client_code' ou 'name'.
- save_client_data: Use para criar ou ATUALIZAR um cliente. Para atualizar, use o 'client_code' se souber, ou o 'name'.
- get_user_field: Use para obter dados do usuário atual.
- set_user_field: Use para salvar dados do usuário atual.`,
  assistant_prompt:
    "Você é um assistente amigável e profissional que ajuda agências de tecnologia a automatizar processos e criar soluções de IA personalizadas.",
  ai_model: "gpt-4o-mini",
  voice_model: "browser",
  openai_tts_voice: "alloy",
  voice_sensitivity: 50,
  openai_api_key: "",
  gemini_api_key: "",
  deepgram_api_key: "",
  openai_stt_api_key: "",
  google_stt_api_key: "",
  conversation_memory_length: 5,
  activation_phrases: ["ativar"],
  deactivation_phrases: ["fechar", "encerrar"],
  welcome_message: "Bem-vindo ao site! Diga 'ativar' para começar a conversar.",
  continuation_phrase: "Pode falar.",
  show_transcript: true,
  input_mode: 'local',
  output_mode: 'buffered',
  streaming_stt_provider: 'deepgram', // Padrão para Deepgram
};

const OPENAI_TTS_VOICES = [
  { value: "nova", label: "Nova" },
  { value: "shimmer", label: "Shimmer" },
  { value: "echo", label: "Echo" },
  { value: "onyx", label: "Onyx" },
  { value: "fable", label: "Fable" },
  { value: "alloy", label: "Alloy (padrão)" },
];

const SettingsPage: React.FC = () => {
  const { workspace, loading } = useSession();
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [userDataFields, setUserDataFields] = useState<UserDataField[]>([]);
  const [powers, setPowers] = useState<Power[]>([]);
  const [activationInput, setActivationInput] = useState("");
  const [deactivationInput, setDeactivationInput] = useState("");

  const systemPromptRef = useRef<HTMLTextAreaElement>(null);
  const assistantPromptRef = useRef<HTMLTextAreaElement>(null);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  });

  const voiceModel = watch("voice_model");
  const inputMode = watch("input_mode");
  const streamingSttProvider = watch("streaming_stt_provider");
  const activationPhrases = watch("activation_phrases");
  const deactivationPhrases = watch("deactivation_phrases");

  const onSubmit = useCallback(async (formData: SettingsFormData) => {
    if (!workspace) {
      showError("Workspace não encontrado.");
      return;
    }

    const { error } = await supabase.from("settings").upsert(
      {
        workspace_id: workspace.id,
        ...formData,
        openai_tts_voice: formData.openai_tts_voice || null,
        openai_api_key: formData.openai_api_key || null,
        gemini_api_key: formData.gemini_api_key || null,
        deepgram_api_key: formData.deepgram_api_key || null,
        openai_stt_api_key: formData.openai_stt_api_key || null,
        google_stt_api_key: formData.google_stt_api_key || null,
        welcome_message: formData.welcome_message || null,
        continuation_phrase: formData.continuation_phrase || null,
        streaming_stt_provider: formData.streaming_stt_provider || null,
      },
      { onConflict: "workspace_id" }
    );

    if (error) {
      showError("Erro ao salvar configurações.");
      console.error(error);
    } else {
      showSuccess("Configurações salvas com sucesso!");
    }
  }, [workspace]);

  useEffect(() => {
    const fetchSettingsAndFieldsAndPowers = async () => {
      if (!workspace?.id) return;
      setLoadingSettings(true);
      const { data: settingsData, error: settingsError } = await supabase
        .from("settings")
        .select("*")
        .eq("workspace_id", workspace.id)
        .single();

      if (settingsError && settingsError.code !== "PGRST116") {
        showError("Erro ao carregar configurações.");
      } else if (settingsData) {
        Object.keys(defaultValues).forEach(key => {
          setValue(key as keyof SettingsFormData, settingsData[key] ?? defaultValues[key]);
        });
      }

      const { data: fieldsData } = await supabase.from('user_data_fields').select('id, name, description, type').eq('workspace_id', workspace.id);
      setUserDataFields(fieldsData || []);
      const { data: powersData } = await supabase.from('powers').select('id, name, description').eq('workspace_id', workspace.id);
      setPowers(powersData || []);
      setLoadingSettings(false);
    };

    if (!loading && workspace) {
      fetchSettingsAndFieldsAndPowers();
    }
  }, [workspace, loading, setValue]);

  const handleAddPhrase = (type: 'activation' | 'deactivation') => {
    const input = type === 'activation' ? activationInput.trim().toLowerCase() : deactivationInput.trim().toLowerCase();
    if (!input) return;
    const currentPhrases = getValues(type === 'activation' ? 'activation_phrases' : 'deactivation_phrases');
    if (!currentPhrases.includes(input)) {
      setValue(type === 'activation' ? 'activation_phrases' : 'deactivation_phrases', [...currentPhrases, input]);
    }
    if (type === 'activation') setActivationInput(""); else setDeactivationInput("");
  };

  const handleRemovePhrase = (type: 'activation' | 'deactivation', phraseToRemove: string) => {
    const currentPhrases = getValues(type === 'activation' ? 'activation_phrases' : 'deactivation_phrases');
    setValue(type === 'activation' ? 'activation_phrases' : 'deactivation_phrases', currentPhrases.filter(p => p !== phraseToRemove));
  };

  const insertAtCursor = useCallback((textareaRef: React.RefObject<HTMLTextAreaElement>, textToInsert: string, fieldName: keyof SettingsFormData) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = getValues(fieldName) as string;
    const newValue = value.substring(0, start) + textToInsert + value.substring(end);
    setValue(fieldName, newValue, { shouldValidate: true });
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
      }
    }, 0);
  }, [getValues, setValue]);

  if (loading || loadingSettings) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h1 className="text-3xl font-bold">Configurações do Assistente IA</h1>

      <Card>
        <CardHeader><CardTitle>Modos de Operação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="input_mode">Entrada de Microfone</Label>
            <Controller
              control={control}
              name="input_mode"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="input_mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local (Recomendado)</SelectItem>
                    <SelectItem value="streaming">Streaming</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-sm text-muted-foreground mt-1">Modo como o áudio do usuário é processado.</p>
          </div>
          <div>
            <Label htmlFor="output_mode">Saída de Áudio (Voz)</Label>
            <Controller
              control={control}
              name="output_mode"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="output_mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buffered">Padrão (Fala no final)</SelectItem>
                    <SelectItem value="streaming">Streaming (Fala enquanto gera)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-sm text-muted-foreground mt-1">Modo como a resposta da IA é falada.</p>
          </div>
          <div className="flex items-center space-x-2">
            <Controller
              control={control}
              name="show_transcript"
              render={({ field }) => (
                <Switch id="show_transcript" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="show_transcript">Exibir transcrições de texto na tela</Label>
          </div>
          {inputMode === 'streaming' && (
            <div>
              <Label htmlFor="streaming_stt_provider">Provedor de Streaming STT</Label>
              <Controller
                control={control}
                name="streaming_stt_provider"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || 'deepgram'}>
                    <SelectTrigger id="streaming_stt_provider"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deepgram">Deepgram</SelectItem>
                      <SelectItem value="openai" disabled>OpenAI (Em breve)</SelectItem>
                      <SelectItem value="google" disabled>Google (Em breve)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-sm text-muted-foreground mt-1">Serviço usado para converter voz em texto em tempo real.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Mensagens e Frases</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Mensagem de Boas-Vindas</Label>
            <Textarea {...register("welcome_message")} rows={2} placeholder="Mensagem que o assistente falará ao iniciar" />
          </div>
          <div>
            <Label>Frase de Continuação</Label>
            <Input {...register("continuation_phrase")} placeholder="Ex: Pode falar, Estou ouvindo" />
            <p className="text-sm text-muted-foreground mt-1">Dita quando o assistente é reaberto.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Prompts da IA</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center mb-2">
              <Label htmlFor="system_prompt">Prompt do Sistema</Label>
              <FieldInsertPopover fields={userDataFields} onInsert={(name) => insertAtCursor(systemPromptRef, `{${name}}`, "system_prompt")} label="Campo" />
              <FieldInsertPopover fields={powers} onInsert={(name) => insertAtCursor(systemPromptRef, `{power:${name}}`, "system_prompt")} label="Poder" />
            </div>
            <Controller control={control} name="system_prompt" render={({ field }) => (<Textarea id="system_prompt" {...field} rows={3} ref={(e) => { systemPromptRef.current = e; field.ref(e); }} />)} />
          </div>
          <div>
            <div className="flex items-center mb-2">
              <Label htmlFor="assistant_prompt">Prompt do Assistente</Label>
              <FieldInsertPopover fields={userDataFields} onInsert={(name) => insertAtCursor(assistantPromptRef, `{${name}}`, "assistant_prompt")} label="Campo" />
              <FieldInsertPopover fields={powers} onInsert={(name) => insertAtCursor(assistantPromptRef, `{power:${name}}`, "assistant_prompt")} label="Poder" />
            </div>
            <Controller control={control} name="assistant_prompt" render={({ field }) => (<Textarea id="assistant_prompt" {...field} rows={3} ref={(e) => { assistantPromptRef.current = e; field.ref(e); }} />)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Frases de Ativação</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-2">
              <Input value={activationInput} onChange={(e) => setActivationInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPhrase('activation'); } }} placeholder="Digite e tecle Enter" />
              <Button type="button" onClick={() => handleAddPhrase('activation')}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">{activationPhrases?.map(p => (<Badge key={p} variant="secondary" className="flex items-center gap-1">{p}<button type="button" onClick={() => handleRemovePhrase('activation', p)} className="rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="h-3 w-3" /></button></Badge>))}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Frases de Desativação</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-2">
              <Input value={deactivationInput} onChange={(e) => setDeactivationInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPhrase('deactivation'); } }} placeholder="Digite e tecle Enter" />
              <Button type="button" onClick={() => handleAddPhrase('deactivation')}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">{deactivationPhrases?.map(p => (<Badge key={p} variant="secondary" className="flex items-center gap-1">{p}<button type="button" onClick={() => handleRemovePhrase('deactivation', p)} className="rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="h-3 w-3" /></button></Badge>))}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Chaves de API e Parâmetros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label>Chave API OpenAI (IA)</Label>
            <Input {...register("openai_api_key")} type="password" placeholder="sk-..." autoComplete="new-password" />
          </div>
          <div>
            <Label>Chave API Gemini (IA)</Label>
            <Input {...register("gemini_api_key")} type="password" placeholder="..." autoComplete="new-password" />
          </div>
          <div>
            <Label>Chave API Deepgram (Streaming STT)</Label>
            <Input {...register("deepgram_api_key")} type="password" placeholder="..." autoComplete="new-password" />
          </div>
          <div>
            <Label>Chave API OpenAI (Streaming STT)</Label>
            <Input {...register("openai_stt_api_key")} type="password" placeholder="..." autoComplete="new-password" />
          </div>
          <div>
            <Label>Chave API Google (Streaming STT)</Label>
            <Input {...register("google_stt_api_key")} type="password" placeholder="..." autoComplete="new-password" />
          </div>
          <div className="md:col-span-1.5">
            <Label>Memória da Conversa</Label>
            <Controller control={control} name="conversation_memory_length" render={({ field }) => (<Slider value={[field.value ?? 5]} onValueChange={(v) => field.onChange(v[0])} min={0} max={10} step={1} />)} />
            <p className="text-sm text-muted-foreground mt-1">Pares de mensagens a serem lembrados: {watch("conversation_memory_length")}</p>
          </div>
          <div className="md:col-span-1.5">
            <Label>Sensibilidade do Microfone</Label>
            <Controller control={control} name="voice_sensitivity" render={({ field }) => (<Slider value={[field.value ?? 50]} onValueChange={(v) => field.onChange(v[0])} min={0} max={100} step={1} />)} />
            <p className="text-sm text-muted-foreground mt-1">Sensibilidade: {watch("voice_sensitivity")}</p>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSubmitting}>Salvar Configurações</Button>
    </form>
  );
};

export default SettingsPage;