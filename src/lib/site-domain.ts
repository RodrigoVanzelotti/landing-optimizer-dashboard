export function normalizeSiteDomain(input: string): string {
  const value = input.trim();
  try {
    if (!value || /[\s\\]/.test(value)) throw new Error();
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value.replace(/^\/\//, '')}`);
    const hostname = url.hostname.replace(/\.$/, '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      hostname.length < 3 || hostname.length > 253 ||
      !hostname.split('.').every(label => label.length <= 63 && /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label))) {
      throw new Error();
    }
    const domain = `${hostname}${url.port ? `:${url.port}` : ''}`;
    if (domain.length > 255) throw new Error();
    return domain;
  } catch {
    throw new Error('Informe um domínio ou uma URL válida, como exemplo.com ou https://exemplo.com.');
  }
}
