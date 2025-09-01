-- Remove a versão antiga da função para permitir a mudança do tipo de retorno.
DROP FUNCTION IF EXISTS public.create_workspace_for_user(uuid, text, text);

-- Recria a função, alterando o tipo de retorno de 'workspaces' para 'json'.
-- Isso garante que a resposta seja sempre em um formato aceitável pelo cliente.
CREATE OR REPLACE FUNCTION public.create_workspace_for_user(
  p_user_id uuid, 
  p_name text DEFAULT 'Meu Workspace', 
  p_plan text DEFAULT 'free'
)
RETURNS json -- O tipo de retorno foi alterado aqui
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ws public.workspaces;
  ws_json json;
BEGIN
  -- 1) Verifica se o usuário já criou um workspace.
  SELECT * INTO ws
  FROM public.workspaces
  WHERE created_by = p_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF ws.id IS NOT NULL THEN
    SELECT row_to_json(ws) INTO ws_json;
    RETURN ws_json;
  END IF;

  -- 2) Verifica se o usuário já é membro de algum workspace.
  SELECT w.* INTO ws
  FROM public.workspaces w
  JOIN public.workspace_members wm ON wm.workspace_id = w.id
  WHERE wm.user_id = p_user_id
  ORDER BY w.created_at ASC
  LIMIT 1;

  IF ws.id IS NOT NULL THEN
    SELECT row_to_json(ws) INTO ws_json;
    RETURN ws_json;
  END IF;

  -- 3) Se não, cria um novo workspace.
  INSERT INTO public.workspaces (name, plan, created_by)
  VALUES (COALESCE(p_name, 'Meu Workspace'), COALESCE(p_plan, 'free'), p_user_id)
  RETURNING * INTO ws;

  -- 4) Garante que o usuário seja admin do novo workspace.
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (ws.id, p_user_id, 'admin');

  -- Converte a linha do workspace para JSON antes de retornar.
  SELECT row_to_json(ws) INTO ws_json;
  RETURN ws_json;
END;
$$;