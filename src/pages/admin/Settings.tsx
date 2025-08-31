"use client";

import React, { useEffect, useState, useRef } from "react";
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
import { FieldInsertPopover } from "@/components/FieldInsertPopover"; // Importar o novo componente

// Interface para o tipo de dado do campo do usuário (repetida para clareza aqui)
interface UserDataField {
  id: string;
  name: string;
  description: string | null;
  type: 'string' | 'number' | 'boolean';
}

const settingsSchema = z.object({
  system_prompt: z.string().min(10, "Prompt do sistema é obrigatório"),
  assistant_prompt: z.string().min(10, "Prompt do assistente é obrigatório"),
  ai_model: z.enum(["openai-gpt4", "openai-gpt3.5", "gemini-pro", "gpt-4o-mini"]),
  voice_model: z.enum(["browser", "openai-tts", "gemini-tts"]),
  openai_tts_voice: z.string().optional().nullable(),
  voice_sensitivity: z.number().min(0).max(100),
  openai_api_key: z.string().optional().nullable(),
  gemini_api_key: z.string().optional().nullable(),
  conversation_memory_length: z.number().min(0).max(10),
  activation_phrase: z.string().min(1, "Frase de ativação é obrigatória"),
  welcome_message: z.string().optional().nullable(),
  continuation_phrase: z.string().optional().nullable(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const defaultValues: SettingsFormData = {
  system_prompt:
    "Você é Intra, a IA da Intratégica. Empresa de automações, desenvolvimento de IAs e sistemas.",
  assistant_prompt:
    "Você é um assistente amigável e profissional que ajuda agências de tecnologia a automatizar processos e criar soluções de IA personalizadas.",
  ai_model: "gpt-4o-mini",
  voice_model: "browser",
  openai_tts_voice: "alloy",
  voice_sensitivity: 50,
  openai_api_key: "",
  gemini_api_key: "",
  conversation_memory_length: 5,
  activation_phrase: "ativar",
  welcome_message: "Bem-vindo ao site! Diga 'ativar' para começar a conversar.",
  continuation_phrase: "Pode falar.",
};

const OPENAI_TTS_VOICES = [
  { value: "nova", label: "Nova" },
  { value: "shimmer", label: "Shimmer" },
  { value: "echo", label: "Echo" },
  { value: "onyx", label: "Onyx" },
  { value: "fable", label: "Fable" },
  { value: "alloy", label: "Alloy (padrão)" },
  { value: "ash", label: "Ash" },
  { value: "sage", label: "Sage" },
  { value: "coral", label: "Coral" },
];

const SettingsPage: React.FC = () => {
  const { workspace, loading } = useSession();
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [userDataFields, setUserDataFields] = useState<UserDataField[]>([]); // Novo estado para campos de dados do usuário

  const systemPromptRef = useRef<HTMLTextAreaElement>(null); // Ref para o textarea do prompt do sistema
  const assistantPromptRef = useRef<HTMLTextAreaElement>(null); // Ref para o textarea do prompt do assistente

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  });

  const voiceModel = watch("voice_model");

  // Efeito para carregar as configurações e os campos de dados do usuário
  useEffect(() => {
    const fetchSettingsAndFields = async () => {
      if (!workspace?.id) return;

      setLoadingSettings(true);

      // Fetch Settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("settings")
        .select("*")
        .eq("workspace_id", workspace.id)
        .single();

      if (settingsError && settingsError.code !== "PGRST116") {
        showError("Erro ao carregar configurações.");
        console.error(settingsError);
      } else if (settingsData) {
        setValue("system_prompt", settingsData.system_prompt || defaultValues.system_prompt);
        setValue("assistant_prompt", settingsData.assistant_prompt || defaultValues.assistant_prompt);
        setValue("ai_model", settingsData.ai_model || defaultValues.ai_model);
        setValue("voice_model", settingsData.voice_model || defaultValues.voice_model);
        setValue("openai_tts_voice", settingsData.openai_tts_voice || defaultValues.openai_tts_voice);
        setValue("voice_sensitivity", settingsData.voice_sensitivity ?? defaultValues.voice_sensitivity);
        setValue("openai_api_key", settingsData.openai_api_key || defaultValues.openai_api_key);
        setValue("gemini_api_key", settingsData.gemini_api_key || defaultValues.gemini_api_key);
        setValue("conversation_memory_length", settingsData.conversation_memory_length ?? defaultValues.conversation_memory_length);
        setValue("activation_phrase", settingsData.activation_phrase || defaultValues.activation_phrase);
        setValue("welcome_message", settingsData.welcome_message || defaultValues.welcome_message);
        setValue("continuation_phrase", settingsData.continuation_phrase || defaultValues.continuation_phrase);
      }

      // Fetch User Data Fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('user_data_fields')
        .select('id, name, description, type')
        .eq('workspace_id', workspace.id)
        .order('name', { ascending: true });

      if (fieldsError) {
        console.error("Erro ao carregar campos de dados do usuário:", fieldsError);
        showError("Erro ao carregar campos de dados do usuário.");
      } else {
        setUserDataFields(fieldsData || []);
      }

      setLoadingSettings(false);
    };

    if (!loading && workspace) {
      fetchSettingsAndFields();
    }
  }, [workspace, loading, setValue]);

  const onSubmit = async (formData: SettingsFormData) => {
    if (!workspace) {
      showError("Workspace não encontrado.");
      return;
    }

    const { error } = await supabase.from("settings").upsert(
      {
        workspace_id: workspace.id,
        system_prompt: formData.system_prompt,
        assistant_prompt: formData.assistant_prompt,
        ai_model: formData.ai_model,
        voice_model: formData.voice_model,
        openai_tts_voice: formData.openai_tts_voice || null,
        voice_sensitivity: formData.voice_sensitivity,
        openai_api_key: formData.openai_api_key || null,
        gemini_api_key: formData.gemini_api_key || null,
        conversation_memory_length: formData.conversation_memory_length,
        activation_phrase: formData.activation_phrase,
        welcome_message: formData.welcome_message || null,
        continuation_phrase: formData.continuation_phrase || null,
      },
      { onConflict: "workspace_id" }
    );

    if (error) {
      showError("Erro ao salvar configurações.");
      console.error(error);
    } else {
      showSuccess("Configurações salvas com sucesso!");
    }
  };

  // Função para inserir texto na posição do cursor
  const insertAtCursor = (textareaRef: React.RefObject<HTMLTextAreaElement>, textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    textarea.value = value.substring(0, start) + textToInsert + value.substring(end);

    // Move o cursor para o final do texto inserido
    textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;

    // Dispara manualmente o evento 'input' para que o React Hook Form detecte a mudança
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const handleInsertSystemPromptField = (fieldName: string) => {
    const placeholder = `{${fieldName}}`;
    insertAtCursor(systemPromptRef, placeholder);
    // Atualiza o valor no React Hook Form
    setValue("system_prompt", systemPromptRef.current?.value || "", { shouldValidate: true });
  };

  const handleInsertAssistantPromptField = (fieldName: string) => {
    const placeholder = `{${fieldName}}`;
    insertAtCursor(assistantPromptRef, placeholder);
    // Atualiza o valor no React Hook Form
    setValue("assistant_prompt", assistantPromptRef.current?.value || "", { shouldValidate: true });
  };

  if (loading || loadingSettings) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h1 className="text-3xl font-bold">Configurações do Assistente IA</h1>

      <Card>
        <CardHeader>
          <CardTitle>Mensagem de Boas-Vindas</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            {...register("welcome_message")}
            rows={2}
            placeholder="Mensagem que o assistente falará ao iniciar"
          />
          {errors.welcome_message && (
            <p className="text-destructive text-sm mt-1">{errors.welcome_message.message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Frase de Continuação</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            {...register("continuation_phrase")}
            placeholder="Ex: Pode falar, Estou ouvindo"
          />
          {errors.continuation_phrase && (
            <p className="text-destructive text-sm mt-1">{errors.continuation_phrase.message}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            Esta frase será dita quando o assistente for reaberto após a primeira ativação.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prompt do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center mb-2">
            <Label htmlFor="system_prompt" className="sr-only">Prompt do Sistema</Label>
            <FieldInsertPopover fields={userDataFields} onInsert={handleInsertSystemPromptField} />
          </div>
          <Textarea
            id="system_prompt"
            {...register("system_prompt")}
            rows={3}
            placeholder="Prompt do sistema para a IA"
            ref={systemPromptRef} // Anexar a ref
          />
          {errors.system_prompt && (
            <p className="text-destructive text-sm mt-1">{errors.system_prompt.message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prompt do Assistente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center mb-2">
            <Label htmlFor="assistant_prompt" className="sr-only">Prompt do Assistente</Label>
            <FieldInsertPopover fields={userDataFields} onInsert={handleInsertAssistantPromptField} />
          </div>
          <Textarea
            id="assistant_prompt"
            {...register("assistant_prompt")}
            rows={3}
            placeholder="Prompt do assistente para a IA"
            ref={assistantPromptRef} // Anexar a ref
          />
          {errors.assistant_prompt && (
            <p className="text-destructive text-sm mt-1">{errors.assistant_prompt.message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modelo de IA</CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            control={control}
            name="ai_model"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o modelo de IA" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai-gpt4">OpenAI GPT-4</SelectItem>
                  <SelectItem value="openai-gpt3.5">OpenAI GPT-3.5</SelectItem>
                  <SelectItem value="gemini-pro">Gemini Pro (não implementado)</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modelo de Voz</CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            control={control}
            name="voice_model"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o modelo de voz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="browser">Navegador (Web Speech API)</SelectItem>
                  <SelectItem value="openai-tts">OpenAI TTS</SelectItem>
                  <SelectItem value="gemini-tts">Gemini TTS (não implementado)</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </CardContent>
      </Card>

      {voiceModel === "openai-tts" && (
        <Card>
          <CardHeader>
            <CardTitle>Voz OpenAI TTS</CardTitle>
          </CardHeader>
          <CardContent>
            <Controller
              control={control}
              name="openai_tts_voice"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value || "alloy"}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a voz OpenAI TTS" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENAI_TTS_VOICES.map((voice) => (
                      <SelectItem key={voice.value} value={voice.value}>
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sensibilidade do Microfone</CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            control={control}
            name="voice_sensitivity"
            render={({ field }) => (
              <Slider
                value={[field.value ?? 50]}
                onValueChange={(value) => field.onChange(value[0])}
                min={0}
                max={100}
                step={1}
              />
            )}
          />
          <p className="text-sm text-muted-foreground mt-1">
            Ajuste a sensibilidade do microfone (0 a 100)
          </p>
          {errors.voice_sensitivity && (
            <p className="text-destructive text-sm mt-1">{errors.voice_sensitivity.message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chave API OpenAI</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            {...register("openai_api_key")}
            type="password"
            placeholder="Sua chave API OpenAI"
            autoComplete="new-password"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chave API Gemini</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            {...register("gemini_api_key")}
            type="password"
            placeholder="Sua chave API Gemini"
            autoComplete="new-password"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Memória da Conversa</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            {...register("conversation_memory_length")}
            type="number"
            min={0}
            max={10}
            placeholder="Número de mensagens para lembrar"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Palavra/Frase de Ativação</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="activation-phrase">Frase para ativar o assistente</Label>
          <Input
            id="activation-phrase"
            placeholder="Ex: ativar, olá assistente"
            {...register("activation_phrase")}
          />
          {errors.activation_phrase && (
            <p className="text-destructive text-sm mt-1">{errors.activation_phrase.message}</p>
          )}
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSubmitting}>
        Salvar Configurações
      </Button>
    </form>
  );
};

export default SettingsPage;