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
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { FieldInsertPopover } from "@/components/FieldInsertPopover";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Switch } from "@/components/ui/switch";

// Interface for user data field type
interface UserDataField {
  id: string;
  name: string;
  description: string | null;
  type: 'string' | 'number' | 'boolean';
}

// Interface for Power data type (simplified for popover)
interface Power {
  id: string;
  name: string;
  description: string | null;
}

const settingsSchema = z.object({
  system_prompt: z.string().min(10, "Prompt do sistema é obrigatório"),
  assistant_prompt: z.string().min(10, "Prompt do assistente é obrigatório"),
  ai_model: z.enum(["gpt-4-turbo", "gpt-3.5-turbo", "gemini-pro", "gpt-4o-mini", "gemini-1.5-flash-latest"]),
  voice_model: z.enum(["browser", "openai-tts", "gemini-tts", "google-tts", "deepgram"]),
  openai_tts_voice: z.string().optional().nullable(),
  voice_sensitivity: z.number().min(0).max(100),
  openai_api_key: z.string().optional().nullable(),
  gemini_api_key: z.string().optional().nullable(),
  conversation_memory_length: z.number().min(0).max(10),
  activation_phrases: z.array(z.string()).min(1, "É necessária pelo menos uma frase de ativação."),
  deactivation_phrases: z.array(z.string()).min(1, "É necessária pelo menos uma frase de desativação."),
  welcome_message: z.string().optional().nullable(),
  continuation_phrase: z.string().optional().nullable(),
  // Streaming and STT fields
  enable_streaming_voice: z.boolean(),
  streaming_stt_provider: z.enum(["deepgram", "google", "openai"]).optional().nullable(),
  deepgram_api_key: z.string().optional().nullable(),
  openai_stt_api_key: z.string().optional().nullable(),
  google_stt_api_key: z.string().optional().nullable(),
  google_tts_api_key: z.string().optional().nullable(),
  // Detailed provider settings
  google_tts_voice_name: z.string().optional().nullable(),
  google_tts_speaking_rate: z.number().min(0.25).max(4.0).optional().nullable(),
  google_tts_pitch: z.number().min(-20.0).max(20.0).optional().nullable(),
  google_stt_model: z.string().optional().nullable(),
  google_stt_enhanced: z.boolean().optional(),
  deepgram_stt_model: z.string().optional().nullable(),
  deepgram_tts_model: z.string().optional().nullable(),
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
  conversation_memory_length: 5,
  activation_phrases: ["ativar"],
  deactivation_phrases: ["fechar", "encerrar"],
  welcome_message: "Bem-vindo ao site! Diga 'ativar' para começar a conversar.",
  continuation_phrase: "Pode falar.",
  enable_streaming_voice: false,
  streaming_stt_provider: "deepgram",
  deepgram_api_key: "",
  openai_stt_api_key: "",
  google_stt_api_key: "",
  google_tts_api_key: "",
  google_tts_voice_name: "pt-BR-Wavenet-A",
  google_tts_speaking_rate: 1.0,
  google_tts_pitch: 0.0,
  google_stt_model: "default",
  google_stt_enhanced: false,
  deepgram_stt_model: "nova-2",
  deepgram_tts_model: "aura-asteria-pt",
};

const OPENAI_TTS_VOICES = [
  { value: "nova", label: "Nova" },
  { value: "shimmer", label: "Shimmer" },
  { value: "echo", label: "Echo" },
  { value: "onyx", label: "Onyx" },
  { value: "fable", label: "Fable" },
  { value: "alloy", label: "Alloy (padrão)" },
];

const GOOGLE_TTS_VOICES = [
  { label: "Neural2", voices: [
    { value: "pt-BR-Neural2-A", label: "Feminina A (Neural2)" },
    { value: "pt-BR-Neural2-B", label: "Masculina B (Neural2)" },
    { value: "pt-BR-Neural2-C", label: "Feminina C (Neural2)" },
  ]},
  { label: "WaveNet", voices: [
    { value: "pt-BR-Wavenet-A", label: "Feminina A (WaveNet)" },
    { value: "pt-BR-Wavenet-B", label: "Masculina B (WaveNet)" },
    { value: "pt-BR-Wavenet-C", label: "Masculina C (WaveNet)" },
    { value: "pt-BR-Wavenet-D", label: "Feminina D (WaveNet)" },
  ]},
  { label: "Standard", voices: [
    { value: "pt-BR-Standard-A", label: "Feminina A (Standard)" },
    { value: "pt-BR-Standard-B", label: "Masculina B (Standard)" },
    { value: "pt-BR-Standard-C", label: "Masculina C (Standard)" },
    { value: "pt-BR-Standard-D", label: "Feminina D (Standard)" },
  ]},
];

const DEEPGRAM_TTS_VOICES = [
    { value: "aura-asteria-pt", label: "Asteria (Português)" },
    { value: "aura-luna-pt", label: "Luna (Português)" },
    { value: "aura-stella-pt", label: "Stella (Português)" },
    { value: "aura-athena-en", label: "Athena (Inglês)" },
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
  const sttProvider = watch("streaming_stt_provider");
  const activationPhrases = watch("activation_phrases");
  const deactivationPhrases = watch("deactivation_phrases");

  const onSubmit = useCallback(async (formData: SettingsFormData) => {
    if (!workspace) {
      showError("Workspace não encontrado.");
      return;
    }

    const { ...settingsData } = formData;
    const payload = {
      workspace_id: workspace.id,
      ...settingsData,
    };

    const { error } = await supabase.from("settings").upsert(payload, { onConflict: "workspace_id" });

    if (error) {
      showError("Erro ao salvar configurações.");
      console.error(error);
    } else {
      showSuccess("Configurações salvas com sucesso!");
    }
  }, [workspace]);

  useEffect(() => {
    const fetchSettingsAndRelatedData = async () => {
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
        Object.keys(settingsData).forEach(key => {
          const formKey = key as keyof SettingsFormData;
          if (formKey in defaultValues) {
            setValue(formKey, settingsData[key] ?? defaultValues[formKey]);
          }
        });
      }

      const { data: fieldsData } = await supabase
        .from('user_data_fields')
        .select('id, name, description, type')
        .eq('workspace_id', workspace.id)
        .order('name', { ascending: true });
      setUserDataFields(fieldsData || []);

      const { data: powersData } = await supabase
        .from('powers')
        .select('id, name, description')
        .eq('workspace_id', workspace.id)
        .order('name', { ascending: true });
      setPowers(powersData || []);

      setLoadingSettings(false);
    };

    if (!loading && workspace) {
      fetchSettingsAndRelatedData();
    }
  }, [workspace, loading, setValue]);

  const handleAddPhrase = (type: 'activation' | 'deactivation') => {
    const input = type === 'activation' ? activationInput.trim().toLowerCase() : deactivationInput.trim().toLowerCase();
    if (!input) return;
    const fieldName = type === 'activation' ? 'activation_phrases' : 'deactivation_phrases';
    const currentPhrases = getValues(fieldName);
    if (!currentPhrases.includes(input)) {
      setValue(fieldName, [...currentPhrases, input]);
    }
    if (type === 'activation') setActivationInput("");
    else setDeactivationInput("");
  };

  const handleRemovePhrase = (type: 'activation' | 'deactivation', phraseToRemove: string) => {
    const fieldName = type === 'activation' ? 'activation_phrases' : 'deactivation_phrases';
    const currentPhrases = getValues(fieldName);
    setValue(fieldName, currentPhrases.filter(p => p !== phraseToRemove));
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
        <CardHeader><CardTitle>Mensagens do Assistente</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Mensagem de Boas-Vindas</Label><Textarea {...register("welcome_message")} rows={2} placeholder="Mensagem que o assistente falará ao iniciar" /></div>
          <div><Label>Frase de Continuação</Label><Input {...register("continuation_phrase")} placeholder="Ex: Pode falar, Estou ouvindo" /><p className="text-sm text-muted-foreground mt-1">Dita quando o assistente é reaberto.</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Prompts da IA</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center mb-2 justify-between"><Label htmlFor="system_prompt">Prompt do Sistema</Label><div><FieldInsertPopover fields={userDataFields} onInsert={(name) => insertAtCursor(systemPromptRef, `{${name}}`, "system_prompt")} label="Campo" /><FieldInsertPopover fields={powers} onInsert={(name) => insertAtCursor(systemPromptRef, `{power:${name}}`, "system_prompt")} label="Poder" /></div></div>
            <Controller control={control} name="system_prompt" render={({ field }) => (<Textarea id="system_prompt" {...field} rows={3} ref={(e) => { systemPromptRef.current = e; field.ref(e); }} />)} />
          </div>
          <div>
            <div className="flex items-center mb-2 justify-between"><Label htmlFor="assistant_prompt">Prompt do Assistente</Label><div><FieldInsertPopover fields={userDataFields} onInsert={(name) => insertAtCursor(assistantPromptRef, `{${name}}`, "assistant_prompt")} label="Campo" /><FieldInsertPopover fields={powers} onInsert={(name) => insertAtCursor(assistantPromptRef, `{power:${name}}`, "assistant_prompt")} label="Poder" /></div></div>
            <Controller control={control} name="assistant_prompt" render={({ field }) => (<Textarea id="assistant_prompt" {...field} rows={3} ref={(e) => { assistantPromptRef.current = e; field.ref(e); }} />)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card><CardHeader><CardTitle>Frases de Ativação</CardTitle></CardHeader><CardContent><div className="flex gap-2 mb-2"><Input value={activationInput} onChange={(e) => setActivationInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPhrase('activation'); } }} placeholder="Digite e tecle Enter" /><Button type="button" onClick={() => handleAddPhrase('activation')}>Adicionar</Button></div><div className="flex flex-wrap gap-2 min-h-[2.5rem]">{activationPhrases?.map(phrase => (<Badge key={phrase} variant="secondary" className="flex items-center gap-1">{phrase}<button type="button" onClick={() => handleRemovePhrase('activation', phrase)} className="rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="h-3 w-3" /></button></Badge>))}</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Frases de Desativação</CardTitle></CardHeader><CardContent><div className="flex gap-2 mb-2"><Input value={deactivationInput} onChange={(e) => setDeactivationInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPhrase('deactivation'); } }} placeholder="Digite e tecle Enter" /><Button type="button" onClick={() => handleAddPhrase('deactivation')}>Adicionar</Button></div><div className="flex flex-wrap gap-2 min-h-[2.5rem]">{deactivationPhrases?.map(phrase => (<Badge key={phrase} variant="secondary" className="flex items-center gap-1">{phrase}<button type="button" onClick={() => handleRemovePhrase('deactivation', phrase)} className="rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="h-3 w-3" /></button></Badge>))}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Modelos de IA e Voz</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <div><Label>Modelo de IA</Label><Controller control={control} name="ai_model" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem><SelectItem value="gpt-4-turbo">OpenAI GPT-4 Turbo</SelectItem><SelectItem value="gpt-3.5-turbo">OpenAI GPT-3.5 Turbo</SelectItem><SelectItem value="gemini-1.5-flash-latest">Gemini 1.5 Flash</SelectItem><SelectItem value="gemini-pro" disabled>Gemini Pro (em breve)</SelectItem></SelectContent></Select>)} /></div>
          <div><Label>Modelo de Voz (TTS)</Label><Controller control={control} name="voice_model" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="browser">Navegador (Padrão)</SelectItem><SelectItem value="openai-tts">OpenAI TTS</SelectItem><SelectItem value="google-tts">Google TTS</SelectItem><SelectItem value="deepgram">Deepgram Aura</SelectItem><SelectItem value="gemini-tts" disabled>Gemini TTS (em breve)</SelectItem></SelectContent></Select>)} /></div>
          {voiceModel === "openai-tts" && (<div><Label>Voz OpenAI TTS</Label><Controller control={control} name="openai_tts_voice" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value || "alloy"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OPENAI_TTS_VOICES.map((voice) => (<SelectItem key={voice.value} value={voice.value}>{voice.label}</SelectItem>))}</SelectContent></Select>)} /></div>)}
          {voiceModel === "google-tts" && (<><div className="col-span-2 grid md:grid-cols-2 gap-6 items-end"><div><Label>Voz Google TTS</Label><Controller control={control} name="google_tts_voice_name" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value || "pt-BR-Wavenet-A"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{GOOGLE_TTS_VOICES.map(group => (<SelectGroup key={group.label}><SelectLabel>{group.label}</SelectLabel>{group.voices.map(voice => (<SelectItem key={voice.value} value={voice.value}>{voice.label}</SelectItem>))}</SelectGroup>))}</SelectContent></Select>)} /></div></div><div className="col-span-2 grid md:grid-cols-2 gap-6"><div><Label>Velocidade da Fala</Label><Controller control={control} name="google_tts_speaking_rate" render={({ field }) => (<Slider value={[field.value ?? 1]} onValueChange={(v) => field.onChange(v[0])} min={0.25} max={4.0} step={0.05} />)} /><p className="text-sm text-muted-foreground mt-1">Valor: {watch("google_tts_speaking_rate")?.toFixed(2)}x</p></div><div><Label>Tom (Pitch)</Label><Controller control={control} name="google_tts_pitch" render={({ field }) => (<Slider value={[field.value ?? 0]} onValueChange={(v) => field.onChange(v[0])} min={-20} max={20} step={0.5} />)} /><p className="text-sm text-muted-foreground mt-1">Valor: {watch("google_tts_pitch")?.toFixed(1)}</p></div></div></>)}
          {voiceModel === "deepgram" && (<div><Label>Voz Deepgram Aura</Label><Controller control={control} name="deepgram_tts_model" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value || "aura-asteria-pt"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DEEPGRAM_TTS_VOICES.map((voice) => (<SelectItem key={voice.value} value={voice.value}>{voice.label}</SelectItem>))}</SelectContent></Select>)} /></div>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Streaming e Transcrição (STT)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2"><Controller control={control} name="enable_streaming_voice" render={({ field }) => (<Switch id="enable_streaming_voice" checked={field.value} onCheckedChange={field.onChange} />)} /><Label htmlFor="enable_streaming_voice">Habilitar Voz em Tempo Real (Streaming)</Label></div>
          <div><Label>Provedor de Transcrição (STT)</Label><Controller control={control} name="streaming_stt_provider" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value ?? "deepgram"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="deepgram">Deepgram</SelectItem><SelectItem value="google">Google STT</SelectItem><SelectItem value="openai">OpenAI Whisper</SelectItem></SelectContent></Select>)} /></div>
          {sttProvider === "google" && (<div className="grid md:grid-cols-2 gap-6 items-center"><div><Label>Modelo Google STT</Label><Controller control={control} name="google_stt_model" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value || "default"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Padrão (Rápido)</SelectItem><SelectItem value="video">Vídeo</SelectItem><SelectItem value="phone_call">Ligação Telefônica</SelectItem><SelectItem value="command_and_search">Comandos e Busca</SelectItem></SelectContent></Select>)} /></div><div className="flex items-center space-x-2 pt-6"><Controller control={control} name="google_stt_enhanced" render={({ field }) => (<Switch id="google_stt_enhanced" checked={field.value} onCheckedChange={field.onChange} />)} /><Label htmlFor="google_stt_enhanced">Usar Modelo Otimizado (Enhanced)</Label></div></div>)}
          {sttProvider === "deepgram" && (<div><Label>Modelo Deepgram STT</Label><Controller control={control} name="deepgram_stt_model" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value || "nova-2"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nova-2">Nova-2 (Mais Rápido)</SelectItem><SelectItem value="nova-3">Nova-3 (Mais Preciso)</SelectItem></SelectContent></Select>)} /></div>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Chaves de API</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <div><Label>OpenAI API Key (GPT & TTS)</Label><Input {...register("openai_api_key")} type="password" placeholder="sk-..." autoComplete="new-password" /></div>
          <div><Label>OpenAI STT API Key (Whisper)</Label><Input {...register("openai_stt_api_key")} type="password" placeholder="sk-..." autoComplete="new-password" /></div>
          <div><Label>Gemini API Key</Label><Input {...register("gemini_api_key")} type="password" placeholder="AIza..." autoComplete="new-password" /></div>
          <div><Label>Google TTS API Key</Label><Input {...register("google_tts_api_key")} type="password" placeholder="AIza..." autoComplete="new-password" /></div>
          <div><Label>Google STT API Key</Label><Input {...register("google_stt_api_key")} type="password" placeholder="AIza..." autoComplete="new-password" /></div>
          <div><Label>Deepgram API Key</Label><Input {...register("deepgram_api_key")} type="password" placeholder="Sua chave Deepgram" autoComplete="new-password" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Configurações Avançadas</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <div><Label>Memória da Conversa</Label><Controller control={control} name="conversation_memory_length" render={({ field }) => (<Slider value={[field.value ?? 5]} onValueChange={(v) => field.onChange(v[0])} min={0} max={10} step={1} />)} /><p className="text-sm text-muted-foreground mt-1">Pares de mensagens a serem lembradas: {watch("conversation_memory_length")}</p></div>
          <div><Label>Sensibilidade do Microfone</Label><Controller control={control} name="voice_sensitivity" render={({ field }) => (<Slider value={[field.value ?? 50]} onValueChange={(v) => field.onChange(v[0])} min={0} max={100} step={1} />)} /><p className="text-sm text-muted-foreground mt-1">Valor atual: {watch("voice_sensitivity")}</p></div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar Configurações"}</Button>
    </form>
  );
};

export default SettingsPage;