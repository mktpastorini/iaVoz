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
import { X } from "lucide-react";

interface UserDataField {
  id: string;
  name: string;
  description: string | null;
  type: 'string' | 'number' | 'boolean';
}

interface Power {
  id: string;
  name: string;
  description: string | null;
}

const settingsSchema = z.object({
  system_prompt: z.string().min(10, "Prompt do sistema é obrigatório"),
  assistant_prompt: z.string().min(10, "Prompt do assistente é obrigatório"),
  ai_model: z.enum(["gpt-4-turbo", "gpt-3.5-turbo", "gpt-4o-mini", "gemini-2.5-pro-001", "gemini-2.5-flash-001", "gemini-pro"]),
  voice_model: z.enum(["browser", "openai-tts", "deepgram-tts", "elevenlabs-tts", "google-cloud-tts"]),
  streaming_stt_provider: z.enum(["browser", "deepgram"]),
  openai_tts_voice: z.string().optional().nullable(),
  deepgram_stt_model: z.string().optional().nullable(),
  deepgram_tts_model: z.string().optional().nullable(),
  elevenlabs_voice_id: z.string().optional().nullable(),
  google_tts_voice_name: z.string().optional().nullable(),
  google_tts_speaking_rate: z.number().min(0.25).max(4.0).optional().nullable(),
  google_tts_pitch: z.number().min(-20.0).max(20.0).optional().nullable(),
  voice_sensitivity: z.number().min(0).max(100),
  openai_api_key: z.string().optional().nullable(),
  gemini_api_key: z.string().optional().nullable(),
  google_vertex_api_key: z.string().optional().nullable(),
  deepgram_api_key: z.string().optional().nullable(),
  elevenlabs_api_key: z.string().optional().nullable(),
  google_tts_api_key: z.string().optional().nullable(),
  conversation_memory_length: z.number().min(0).max(10),
  activation_phrases: z.array(z.string()).min(1, "É necessária pelo menos uma frase de ativação."),
  deactivation_phrases: z.array(z.string()).min(1, "É necessária pelo menos uma frase de desativação."),
  welcome_message: z.string().optional().nullable(),
  continuation_phrase: z.string().optional().nullable(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const defaultValues: Omit<SettingsFormData, 'gemini_tts_model' | 'gemini_tts_voice_name'> = {
  system_prompt: "Você é Intra, a IA da Intratégica...",
  assistant_prompt: "Você é um assistente amigável e profissional...",
  ai_model: "gpt-4o-mini",
  voice_model: "browser",
  streaming_stt_provider: "browser",
  openai_tts_voice: "alloy",
  deepgram_stt_model: "nova-2",
  deepgram_tts_model: "aura-asteria-en",
  elevenlabs_voice_id: "21m00Tcm4TlvDq8ikWAM",
  google_tts_voice_name: "pt-BR-Wavenet-A",
  google_tts_speaking_rate: 1.0,
  google_tts_pitch: 0.0,
  voice_sensitivity: 50,
  openai_api_key: "",
  gemini_api_key: "",
  google_vertex_api_key: "",
  deepgram_api_key: "",
  elevenlabs_api_key: "",
  google_tts_api_key: "",
  conversation_memory_length: 5,
  activation_phrases: ["ativar"],
  deactivation_phrases: ["fechar", "encerrar"],
  welcome_message: "Bem-vindo ao site! Diga 'ativar' para começar a conversar.",
  continuation_phrase: "Pode falar.",
};

const OPENAI_TTS_VOICES = [
  { value: "nova", label: "Nova" }, { value: "shimmer", label: "Shimmer" },
  { value: "echo", label: "Echo" }, { value: "onyx", label: "Onyx" },
  { value: "fable", label: "Fable" }, { value: "alloy", label: "Alloy" },
];

const DEEPGRAM_TTS_VOICES = [
  { value: "aura-asteria-en", label: "Asteria (Inglês, US)" },
  { value: "aura-luna-en", label: "Luna (Inglês, US)" },
  { value: "aura-stella-en", label: "Stella (Inglês, US)" },
  { value: "aura-hera-en", label: "Hera (Inglês, US)" },
  { value: "aura-asteria-pt", label: "Asteria (Português)" },
  { value: "aura-luna-pt", label: "Luna (Português)" },
  { value: "aura-stella-pt", label: "Stella (Português)" },
];

const DEEPGRAM_STT_MODELS = [
  { value: "nova-3", label: "Nova 3" },
  { value: "nova-2", label: "Nova 2" },
  { value: "whisper-large", label: "Whisper" },
];

const ELEVENLABS_VOICES = [
  { value: "21m00Tcm4TlvDq8ikWAM", label: "Antoni" },
  { value: "AZnzlk1XvdvUeBnXmlld", label: "Rachel" },
  { value: "bVMeCyTHy58xNoL34h3p", label: "Daniel" },
];

const GOOGLE_TTS_VOICES = [
  { value: "pt-BR-Wavenet-A", label: "Português (Brasil, Feminino A)" },
  { value: "pt-BR-Wavenet-B", label: "Português (Brasil, Masculino B)" },
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
    control, register, handleSubmit, setValue, watch, getValues,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormData>({ resolver: zodResolver(settingsSchema), defaultValues: defaultValues as any });

  const voiceModel = watch("voice_model");
  const sttProvider = watch("streaming_stt_provider");
  const activationPhrases = watch("activation_phrases");
  const deactivationPhrases = watch("deactivation_phrases");

  const onSubmit = useCallback(async (formData: SettingsFormData) => {
    if (!workspace) { showError("Workspace não encontrado."); return; }
    const { error } = await supabase.from("settings").upsert({
      workspace_id: workspace.id, ...formData,
    }, { onConflict: "workspace_id" });
    if (error) { showError("Erro ao salvar configurações."); console.error(error); }
    else { showSuccess("Configurações salvas com sucesso!"); }
  }, [workspace]);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!workspace?.id) return;
      setLoadingSettings(true);
      const { data: settingsData, error: settingsError } = await supabase.from("settings").select("*").eq("workspace_id", workspace.id).single();
      if (settingsError && settingsError.code !== "PGRST116") { showError("Erro ao carregar configurações."); }
      else if (settingsData) { Object.keys(settingsData).forEach(key => setValue(key as any, settingsData[key] ?? (defaultValues as any)[key])); }
      const { data: fieldsData } = await supabase.from('user_data_fields').select('id, name, description, type').eq('workspace_id', workspace.id);
      setUserDataFields(fieldsData || []);
      const { data: powersData } = await supabase.from('powers').select('id, name, description').eq('workspace_id', workspace.id);
      setPowers(powersData || []);
      setLoadingSettings(false);
    };
    if (!loading && workspace) { fetchAllData(); }
  }, [workspace, loading, setValue]);

  const handleAddPhrase = (type: 'activation' | 'deactivation') => {
    const input = (type === 'activation' ? activationInput : deactivationInput).trim().toLowerCase();
    if (!input) return;
    const field = type === 'activation' ? 'activation_phrases' : 'deactivation_phrases';
    const current = getValues(field);
    if (!current.includes(input)) setValue(field, [...current, input]);
    if (type === 'activation') setActivationInput(""); else setDeactivationInput("");
  };

  const handleRemovePhrase = (type: 'activation' | 'deactivation', phrase: string) => {
    const field = type === 'activation' ? 'activation_phrases' : 'deactivation_phrases';
    setValue(field, getValues(field).filter(p => p !== phrase));
  };

  const insertAtCursor = useCallback((ref: React.RefObject<HTMLTextAreaElement>, text: string, fieldName: keyof SettingsFormData) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = getValues(fieldName) as string;
    const newValue = value.substring(0, start) + text + value.substring(end);
    setValue(fieldName, newValue, { shouldValidate: true });
    setTimeout(() => { el.focus(); el.setSelectionRange(start + text.length, start + text.length); }, 0);
  }, [getValues, setValue]);

  if (loading || loadingSettings) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h1 className="text-3xl font-bold">Configurações do Assistente IA</h1>
      
      <Card>
        <CardHeader><CardTitle>Prompts da IA</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center mb-2"><Label htmlFor="system_prompt">Prompt do Sistema</Label><FieldInsertPopover fields={userDataFields} onInsert={(name) => insertAtCursor(systemPromptRef, `{${name}}`, "system_prompt")} label="Campo" /><FieldInsertPopover fields={powers} onInsert={(name) => insertAtCursor(systemPromptRef, `{power:${name}}`, "system_prompt")} label="Poder" /></div>
            <Controller control={control} name="system_prompt" render={({ field }) => <Textarea id="system_prompt" {...field} rows={5} ref={(e) => { systemPromptRef.current = e; field.ref(e); }} />} />
          </div>
          <div>
            <div className="flex items-center mb-2"><Label htmlFor="assistant_prompt">Prompt do Assistente</Label><FieldInsertPopover fields={userDataFields} onInsert={(name) => insertAtCursor(assistantPromptRef, `{${name}}`, "assistant_prompt")} label="Campo" /><FieldInsertPopover fields={powers} onInsert={(name) => insertAtCursor(assistantPromptRef, `{power:${name}}`, "assistant_prompt")} label="Poder" /></div>
            <Controller control={control} name="assistant_prompt" render={({ field }) => <Textarea id="assistant_prompt" {...field} rows={3} ref={(e) => { assistantPromptRef.current = e; field.ref(e); }} />} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Chaves de API</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Chave API OpenAI</Label><Input {...register("openai_api_key")} type="password" /></div>
          <div><Label>Chave API Google Vertex AI</Label><Input {...register("google_vertex_api_key")} type="password" /></div>
          <div><Label>Chave API Deepgram</Label><Input {...register("deepgram_api_key")} type="password" /></div>
          <div><Label>Chave API ElevenLabs</Label><Input {...register("elevenlabs_api_key")} type="password" /></div>
          <div><Label>Chave API Google Cloud (TTS)</Label><Input {...register("google_tts_api_key")} type="password" /></div>
          <div><Label>Chave API Gemini (Legado)</Label><Input {...register("gemini_api_key")} type="password" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Modelos e Provedores</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Modelo de IA (Cérebro)</Label><Controller control={control} name="ai_model" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gpt-4o-mini">OpenAI - GPT-4o Mini</SelectItem><SelectItem value="gpt-4-turbo">OpenAI - GPT-4 Turbo</SelectItem><SelectItem value="gpt-3.5-turbo">OpenAI - GPT-3.5 Turbo</SelectItem><SelectItem value="gemini-2.5-pro-001">Vertex AI - Gemini 2.5 Pro</SelectItem><SelectItem value="gemini-2.5-flash-001">Vertex AI - Gemini 2.5 Flash</SelectItem><SelectItem value="gemini-pro">Google Gemini - Pro (Legado)</SelectItem></SelectContent></Select>)} /></div>
          <div><Label>Provedor de Transcrição (STT)</Label><Controller control={control} name="streaming_stt_provider" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="browser">Navegador (Padrão)</SelectItem><SelectItem value="deepgram">Deepgram</SelectItem></SelectContent></Select>)} /></div>
          {sttProvider === 'deepgram' && <div><Label>Modelo STT Deepgram</Label><Controller control={control} name="deepgram_stt_model" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DEEPGRAM_STT_MODELS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>)} /></div>}
          <div><Label>Provedor de Voz (TTS)</Label><Controller control={control} name="voice_model" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="browser">Navegador (Padrão)</SelectItem><SelectItem value="openai-tts">OpenAI TTS</SelectItem><SelectItem value="deepgram-tts">Deepgram TTS</SelectItem><SelectItem value="elevenlabs-tts">ElevenLabs TTS</SelectItem><SelectItem value="google-cloud-tts">Google Cloud TTS</SelectItem></SelectContent></Select>)} /></div>
          {voiceModel === 'openai-tts' && <div><Label>Voz OpenAI TTS</Label><Controller control={control} name="openai_tts_voice" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value || "alloy"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OPENAI_TTS_VOICES.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent></Select>)} /></div>}
          {voiceModel === 'deepgram-tts' && <div><Label>Voz Deepgram TTS</Label><Controller control={control} name="deepgram_tts_model" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DEEPGRAM_TTS_VOICES.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent></Select>)} /></div>}
          {voiceModel === 'elevenlabs-tts' && <div><Label>Voz ElevenLabs</Label><Controller control={control} name="elevenlabs_voice_id" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ELEVENLABS_VOICES.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent></Select>)} /></div>}
          {voiceModel === 'google-cloud-tts' && <><div><Label>Voz Google Cloud</Label><Controller control={control} name="google_tts_voice_name" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{GOOGLE_TTS_VOICES.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent></Select>)} /></div><div><Label>Velocidade da Fala</Label><Controller control={control} name="google_tts_speaking_rate" render={({ field }) => <Slider value={[field.value ?? 1]} onValueChange={v => field.onChange(v[0])} min={0.25} max={4.0} step={0.05} />} /></div><div><Label>Tom da Voz</Label><Controller control={control} name="google_tts_pitch" render={({ field }) => <Slider value={[field.value ?? 0]} onValueChange={v => field.onChange(v[0])} min={-20.0} max={20.0} step={0.1} />} /></div></>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Comportamento e Ativação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Mensagem de Boas-Vindas</Label><Input {...register("welcome_message")} /></div>
          <div><Label>Frase de Continuação</Label><Input {...register("continuation_phrase")} /></div>
          <div><Label>Frases de Ativação</Label><div className="flex gap-2"><Input value={activationInput} onChange={e => setActivationInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPhrase('activation'); } }} /><Button type="button" onClick={() => handleAddPhrase('activation')}>Add</Button></div><div className="flex flex-wrap gap-2 mt-2">{activationPhrases?.map(p => <Badge key={p}>{p}<button type="button" onClick={() => handleRemovePhrase('activation', p)} className="ml-2"><X size={12} /></button></Badge>)}</div></div>
          <div><Label>Frases de Desativação</Label><div className="flex gap-2"><Input value={deactivationInput} onChange={e => setDeactivationInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPhrase('deactivation'); } }} /><Button type="button" onClick={() => handleAddPhrase('deactivation')}>Add</Button></div><div className="flex flex-wrap gap-2 mt-2">{deactivationPhrases?.map(p => <Badge key={p}>{p}<button type="button" onClick={() => handleRemovePhrase('deactivation', p)} className="ml-2"><X size={12} /></button></Badge>)}</div></div>
          <div><Label>Memória da Conversa (mensagens)</Label><Input {...register("conversation_memory_length", { valueAsNumber: true })} type="number" min={0} max={10} /></div>
          <div><Label>Sensibilidade do Microfone</Label><Controller control={control} name="voice_sensitivity" render={({ field }) => <Slider value={[field.value ?? 50]} onValueChange={v => field.onChange(v[0])} min={0} max={100} step={1} />} /></div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSubmitting}>Salvar Configurações</Button>
    </form>
  );
};

export default SettingsPage;