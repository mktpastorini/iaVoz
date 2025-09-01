-- Função auxiliar para gerar uma string alfanumérica aleatória de um determinado comprimento
CREATE OR REPLACE FUNCTION generate_random_alphanumeric_string(length INT)
RETURNS TEXT AS $$
DECLARE
  chars TEXT[] := ARRAY['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','0','1','2','3','4','5','6','7','8','9'];
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || chars[floor(random() * array_length(chars, 1)) + 1];
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Função principal para gerar o código do cliente, usando a função auxiliar
CREATE OR REPLACE FUNCTION generate_client_code()
RETURNS TEXT AS $$
BEGIN
  RETURN 'CL' || generate_random_alphanumeric_string(8);
END;
$$ LANGUAGE plpgsql VOLATILE;