export function userErrorMessage(error: unknown): string {
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  if (status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
  if (status === 403) return 'Você não tem permissão para realizar esta ação.';
  if (status === 404) return 'Este registro não está disponível. Atualize a página e tente novamente.';
  if (status === 409) return 'O estado deste registro mudou. Atualize a página antes de tentar novamente.';
  if (status === 400 || status === 422) return 'Não foi possível realizar esta ação. Confira os dados e tente novamente.';
  if (status === 429) return 'Há muitas solicitações no momento. Aguarde um pouco e tente novamente.';
  return 'Não foi possível concluir a ação agora. Tente novamente em alguns instantes.';
}
