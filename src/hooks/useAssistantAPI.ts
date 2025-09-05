"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { replacePlaceholders } from '@/lib/utils';
import { useSession } from '@/contexts/SessionContext';
import { useSystem } from '@/contexts/SystemContext';

export const useAssistantAPI = (speak) => {
  const { session } = useSession();
  const { systemVariables } = useSystem();
  const [settings, setSettings] = useState(null);
  const [powers, setPowers] = useState([]);
  const [clientActions, setClientActions] = useState([]);
  const [messageHistory, setMessageHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const fetchAllAssistantData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: settingsData } = await supabase.from("settings").select("*").limit(1).single();
      setSettings(settingsData);
      const { data: powersData } = await supabase.from("powers").select("*");
      setPowers(powersData || []);
      const { data: actionsData } = await supabase.from("client_actions").select("*");
      setClientActions(actionsData || []);
      return { settingsData, powersData, actionsData };
    } catch (error) {
      showError("Error loading assistant data.");
      return {};
    } finally {
      setIsLoading(false);
    }
  }, []);

  const runConversation = useCallback(async (userMessage) => {
    if (!userMessage || !settings) return;

    const currentHistory = [...messageHistory, { role: "user", content: userMessage }];
    setMessageHistory(currentHistory);

    if (!settings.openai_api_key) {
      speak("OpenAI API key is not configured.");
      return;
    }

    const systemPrompt = replacePlaceholders(settings.system_prompt, systemVariables);
    const tools = powers.map(p => ({
      type: "function",
      function: { name: p.name, description: p.description, parameters: p.parameters_schema || { type: "object", properties: {} } },
    }));

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.openai_api_key}` },
        body: JSON.stringify({
          model: settings.ai_model,
          messages: [{ role: "system", content: systemPrompt }, ...currentHistory.slice(-settings.conversation_memory_length)],
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: "auto",
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      
      const data = await response.json();
      const aiMessage = data.choices[0].message;
      setMessageHistory(prev => [...prev, aiMessage]);

      if (aiMessage.tool_calls) {
        speak("Ok, one moment while I access my tools.", async () => {
          const toolPromises = aiMessage.tool_calls.map(async (call) => {
            const { data, error } = await supabase.functions.invoke(call.function.name, { body: JSON.parse(call.function.arguments) });
            if (error) throw new Error(error.message);
            return { tool_call_id: call.id, role: "tool", name: call.function.name, content: JSON.stringify(data) };
          });
          const toolResponses = await Promise.all(toolPromises);
          setMessageHistory(prev => [...prev, ...toolResponses]);

          const secondResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.openai_api_key}` },
            body: JSON.stringify({ model: settings.ai_model, messages: [...messageHistory, aiMessage, ...toolResponses] }),
          });
          if (!secondResponse.ok) throw new Error(await secondResponse.text());

          const secondData = await secondResponse.json();
          const finalMessage = secondData.choices[0].message;
          setMessageHistory(prev => [...prev, finalMessage]);
          speak(finalMessage.content);
        });
      } else {
        speak(aiMessage.content);
      }
    } catch (error) {
      console.error("Conversation error:", error);
      speak("Sorry, I encountered an error.");
    }
  }, [settings, powers, systemVariables, messageHistory, speak]);

  return {
    settings,
    clientActions,
    isLoading,
    fetchAllAssistantData,
    runConversation,
  };
};