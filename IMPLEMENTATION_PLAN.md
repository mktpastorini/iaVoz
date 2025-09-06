# Plano de Implementação: Interface Futurista do Assistente de Voz

Este documento descreve os passos para construir e integrar a nova interface 3D/2D para o assistente de voz, garantindo um desenvolvimento seguro e modular.

- [x] **Passo 1: Preparação do Ambiente**
  - [x] Instalar as dependências necessárias: `@react-three/fiber`, `three`, `@react-three/drei`, `@react-three/postprocessing`.

- [x] **Passo 2: Criar Ambiente de Desenvolvimento Isolado**
  - [x] Adicionar uma rota de desenvolvimento temporária (`/dev-assistant`) em `src/App.tsx`.
  - [x] Criar o componente principal `src/components/FuturisticVoiceAssistant.tsx`.
  - [x] Criar a estrutura de pastas `src/components/assistant-scene/`.

- [ ] **Passo 3: Implementar o Hook de Áudio**
  - [ ] Criar e implementar o hook `src/hooks/useAssistantAudio.ts`.
  - [ ] Testar o hook na página `/dev-assistant` com um elemento `<audio>` local para simular a voz e validar a reatividade de `audioIntensity` e `isSpeaking`.

- [ ] **Passo 4: Construir a Cena 3D**
  - [ ] Criar o componente `src/components/assistant-scene/CosmicBackground.tsx` (combinando `Starfield`, `NebulaWisps`, `EnergyLines`).
  - [ ] Criar o componente `src/components/assistant-scene/AiOrb.tsx` (combinando `OrbCore` e `ParticleOrb`).
  - [ ] Implementar os shaders GLSL para o `ParticleOrb` com reatividade aos `uniforms` de áudio.
  - [ ] Adicionar o `<EffectComposer>` com `<Bloom>` para o pós-processamento.
  - [ ] Implementar a lógica de `quality` para ajustar a contagem de partículas em dispositivos móveis.

- [ ] **Passo 5: Construir a Interface 2D**
  - [ ] Criar o componente `src/components/AssistantUI.tsx`.
  - [ ] Aplicar os estilos de `glassmorphism` e `holographic-text`.
  - [ ] Integrar um equalizador visual que reage ao `audioIntensity`.

- [ ] **Passo 6: Integrar a Lógica do Assistente**
  - [ ] Transferir cuidadosamente a lógica de estado e funções (escuta, fala, histórico, chamadas de API) de `SophisticatedVoiceAssistant.tsx` para `FuturisticVoiceAssistant.tsx`.
  - [ ] Conectar a fonte de áudio do assistente (seja do navegador ou da API TTS) ao hook `useAssistantAudio`.

- [ ] **Passo 7: Substituição Final**
  - [ ] Em `src/App.tsx`, substituir a renderização de `<SophisticatedVoiceAssistant />` por `<FuturisticVoiceAssistant />`.
  - [ ] Realizar testes completos para garantir que toda a funcionalidade original foi preservada.

- [ ] **Passo 8: Limpeza**
  - [ ] Remover a rota de desenvolvimento `/dev-assistant` de `src/App.tsx`.
  - [ ] Remover quaisquer arquivos de teste ou componentes temporários.