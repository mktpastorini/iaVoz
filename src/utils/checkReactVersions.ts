import React from 'react';

export function checkReactVersions() {
  try {
    // @ts-ignore
    const reactVersion = React.version;
    console.log("[checkReactVersions] React version:", reactVersion);

    // Tenta acessar internamente o reconciler para ver se há múltiplas instâncias
    // Isso é apenas um teste simples, pode não detectar tudo
    // Se quiser, pode expandir para verificar módulos duplicados

  } catch (error) {
    console.error("[checkReactVersions] Error checking React versions:", error);
  }
}