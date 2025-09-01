-- Altera a função para gerar um código alfanumérico aleatório de 8 caracteres, prefixado com 'CL'.
CREATE OR REPLACE FUNCTION generate_client_code()
RETURNS TEXT AS $$
BEGIN
  RETURN 'CL' || (
    SELECT string_agg(
      (
        SELECT SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' FROM (RANDOM() * 36)::INTEGER + 1 FOR 1)
      ), ''
    )
    FROM generate_series(1, 8)
  );
END;
$$ LANGUAGE plpgsql;