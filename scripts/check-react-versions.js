const { execSync } = require('child_process');

try {
  const output = execSync('pnpm list react react-dom --depth=10', { encoding: 'utf-8' });
  console.log('Versões instaladas de react e react-dom:\n', output);
} catch (error) {
  console.error('Erro ao executar o comando pnpm list:', error);
}