import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Request isn't trying to upgrade to a websocket.", { status: 400 });
  }
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  const { data: workspace, error: wsError } = await supabaseClient
    .from('workspaces')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (wsError || !workspace) {
    console.error("Proxy Error: Não foi possível encontrar o workspace padrão.", wsError);
    clientSocket.close(1011, "Não foi possível encontrar o workspace padrão.");
    return response;
  }

  const { data: settings, error: settingsError } = await supabaseClient
    .from('settings')
    .select('openai_stt_api_key')
    .eq('workspace_id', workspace.id)
    .single();

  if (settingsError || !settings?.openai_stt_api_key) {
    console.error("Proxy Error: Chave da API OpenAI STT não configurada.", settingsError);
    clientSocket.close(1011, "Chave da API OpenAI STT não configurada.");
    return response;
  }

  const openaiApiKey = settings.openai_stt_api_key;
  const openaiSttUrl = 'https://api.openai.com/v1/audio/transcriptions'; // OpenAI STT é uma API REST, não WebSocket para streaming direto

  // OpenAI STT API é baseada em REST, não WebSocket para streaming contínuo como Deepgram.
  // Para simular streaming, teríamos que acumular chunks de áudio e enviar em intervalos,
  // ou usar uma abordagem de "long-polling" ou "chunked HTTP".
  // Para simplificar e manter a compatibilidade com a arquitetura de WebSocket do cliente,
  // esta Edge Function vai acumular o áudio e enviar para a API REST da OpenAI quando o cliente parar de enviar.
  // Isso não é "streaming real" no sentido de tempo real, mas sim "batch processing" de chunks.

  let audioChunks: Blob[] = [];
  let isProcessing = false;

  clientSocket.onopen = () => {
    console.log("WebSocket do cliente conectado para OpenAI STT.");
  };

  clientSocket.onmessage = async (event) => {
    if (event.data instanceof Blob) {
      audioChunks.push(event.data);
    } else {
      // Se receber uma mensagem de texto, pode ser um sinal para processar o áudio acumulado
      const message = JSON.parse(event.data);
      if (message.type === 'process_audio' && !isProcessing && audioChunks.length > 0) {
        isProcessing = true;
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // Assumindo webm do MediaRecorder
        audioChunks = []; // Limpa os chunks

        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'audio.webm');
          formData.append('model', 'whisper-1');
          formData.append('language', 'pt'); // ou 'pt-BR' se suportado

          const response = await fetch(openaiSttUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
            },
            body: formData,
          });

          if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`OpenAI API error: ${errorBody.error?.message || response.statusText}`);
          }

          const result = await response.json();
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({
              channel: {
                alternatives: [{ transcript: result.text }],
              },
              is_final: true,
            }));
          }
        } catch (error: any) {
          console.error("Erro ao transcrever áudio com OpenAI:", error);
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ error: error.message }));
          }
        } finally {
          isProcessing = false;
        }
      }
    }
  };

  clientSocket.onclose = (event) => {
    console.log("WebSocket do cliente fechado para OpenAI STT:", event.code, event.reason);
    // Se houver áudio restante no buffer, processar uma última vez
    if (audioChunks.length > 0 && !isProcessing) {
      // Disparar um processamento final aqui, se necessário,
      // mas como o socket já está fechado, a resposta não chegaria ao cliente.
      // A lógica de "process_audio" deve ser disparada pelo cliente antes de fechar.
    }
  };

  clientSocket.onerror = (error) => {
    console.error("Erro no WebSocket do cliente para OpenAI STT:", error);
  };

  return response;
});