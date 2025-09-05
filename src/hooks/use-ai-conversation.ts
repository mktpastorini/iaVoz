"use client";

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { replacePlaceholders } from '@/lib/utils';

interface Settings {
  system_prompt: string;
  assistant_prompt: string;
  ai_model: string;
  openai_api_key: string | null;
  conversation_memory_length: number;
}

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

interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
}

export const useAIConversation = (
  settings: Settings | null,
  powers: Power[],
  systemVariables: Record<string, any>,
  speak: (text: string, onEndCallback?: () => void) => void,
  stopListening: () => void
) => {
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const [transcript, setTranscript] = useState("");

  // Refs for stable access within callbacks
  const settingsRef = useRef(settings);
  const powersRef = useRef(powers);
  const systemVariablesRef = useRef(systemVariables);
  const messageHistoryRef = useRef(messageHistory);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { powersRef.current = powers; }, [powers]);
  useEffect(() => { systemVariablesRef.current = systemVariables; }, [systemVariables]);
  useEffect(() => { messageHistoryRef.current = messageHistory; }, [messageHistory]);

  const runConversation = useCallback(async (userMessage: string) => {
    if (!userMessage) {
      console.warn("[useAIConversation] runConversation called with empty message. Ignoring.");
      return;
    }
    setTranscript(userMessage);
    stopListening();

    // Start building the conversation history for this turn
    let currentConversationHistory = [...messageHistoryRef.current, { role: "user", content: userMessage }];
    setMessageHistory(currentConversationHistory); // Update state immediately with user message

    const currentSettings = settingsRef.current;
    if (!currentSettings || !currentSettings.openai_api_key) {
      speak("Desculpe, a chave da API OpenAI não está configurada. Por favor, configure-a nas configurações.");
      showError("Chave da API OpenAI não configurada.");
      return;
    }

    const systemPrompt = replacePlaceholders(currentSettings.system_prompt, systemVariablesRef.current);
    
    const tools = powersRef.current.map(power => {
      let parameters = { type: "object", properties: {} };
      if (power.parameters_schema) {
        try {
          const schema = typeof power.parameters_schema === 'string'
            ? JSON.parse(power.parameters_schema)
            : power.parameters_schema;
          if (typeof schema === 'object' && schema !== null) {
            parameters = schema;
          }
        } catch (e) {
          console.warn(`[useAIConversation] Invalid parameters_schema for power "${power.name}". Using default. Error: ${e.message}`);
        }
      }
      return {
        type: "function",
        function: {
          name: power.name,
          description: power.description,
          parameters: parameters,
        },
      };
    });

    try {
      // First OpenAI call
      const firstResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
        body: JSON.stringify({
          model: currentSettings.ai_model,
          messages: [{ role: "system", content: systemPrompt }, ...currentConversationHistory.slice(-currentSettings.conversation_memory_length)],
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? "auto" : undefined,
        }),
      });
      if (!firstResponse.ok) { 
        const errorData = await firstResponse.json(); 
        console.error("[useAIConversation] OpenAI API Error Response (first call):", errorData);
        throw new Error(`OpenAI API Error: ${errorData.error?.message || JSON.stringify(errorData)}`); 
      }
      const firstData = await firstResponse.json();
      const aiMessage = firstData.choices[0].message;
      
      currentConversationHistory = [...currentConversationHistory, aiMessage]; // Add AI message to local history
      setMessageHistory(currentConversationHistory); // Update state with AI message

      if (aiMessage.tool_calls) {
        const toolCall = aiMessage.tool_calls[0];
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        speak(`Ok, vou usar a função ${functionName}.`, async () => {
          console.log(`[useAIConversation] onEndCallback for 'Ok, vou usar a função ${functionName}.' reached. Invoking Supabase function: ${functionName}`);
          try {
            const { data: functionResult, error: functionError } = await supabase.functions.invoke(functionName, { body: functionArgs });
            if (functionError) {
              console.error(`[useAIConversation] Error invoking Supabase function '${functionName}':`, functionError);
              throw functionError;
            }
            const toolResponseMessage = { tool_call_id: toolCall.id, role: "tool", name: functionName, content: JSON.stringify(functionResult) };
            
            currentConversationHistory = [...currentConversationHistory, toolResponseMessage]; // Add tool message to local history
            setMessageHistory(currentConversationHistory); // Update state with tool message

            // Second OpenAI call
            const secondResponse = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
              body: JSON.stringify({ model: currentSettings.ai_model, messages: [{ role: "system", content: systemPrompt }, ...currentConversationHistory.slice(-currentSettings.conversation_memory_length)] }),
            });
            if (!secondResponse.ok) { 
              const errorData = await secondResponse.json(); 
              console.error("[useAIConversation] OpenAI API Second Call Error Response:", errorData);
              throw new Error(`OpenAI API Error: ${errorData.error?.message || JSON.stringify(errorData)}`); 
            }
            const secondData = await secondResponse.json();
            const finalMessage = secondData.choices[0].message;
            
            currentConversationHistory = [...currentConversationHistory, finalMessage]; // Add final AI message to local history
            setMessageHistory(currentConversationHistory); // Update state with final AI message

            speak(finalMessage.content, () => {
              console.log("[useAIConversation] onEndCallback for final AI content reached.");
            });
          } catch (e: any) {
            console.error("[useAIConversation] Error executing tool or second OpenAI call:", e);
            speak(`Desculpe, houve um erro ao executar a função ${functionName}. Detalhes: ${e.message}`);
          }
        });
      } else {
        speak(aiMessage.content, () => {
          console.log("[useAIConversation] onEndCallback for AI content reached.");
        });
      }
    } catch (e: any) {
      console.error("[useAIConversation] Error in runConversation:", e);
      showError(`Erro na conversa: ${e.message}`);
      speak("Desculpe, não consegui processar sua solicitação.");
    }
  }, [settings, powers, systemVariables, speak, stopListening]);

  return {
    transcript,
    setTranscript,
    messageHistory,
    setMessageHistory,
    runConversation,
  };
};