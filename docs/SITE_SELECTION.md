# Seleção de site e favorito pessoal

O seletor **Site ativo**, na sidebar abaixo da marca e do perfil, é compartilhado pelas
páginas Visão geral, Insights de IA, Experimentos, Resultados e Diretrizes da marca.
Não há mais seletores independentes nem escolha implícita do primeiro site em
cada página. A seleção permanece ao navegar pela sidebar e pelas abas.
A lista de Sites não mostra o seletor; os detalhes de instalação mantêm esse contexto.
Clientes e Configurações continuam sendo áreas do workspace, sem filtro por site.
Em telas pequenas, o seletor fica na região de navegação acima do conteúdo.

Em Sites, a estrela escolhe o único favorito pessoal daquele workspace. Marcar
outro substitui o anterior; clicar na estrela marcada remove o favorito.
Uma nova sessão do dashboard abre o favorito, inclusive em outro dispositivo.
Trocar o site na sidebar não altera o favorito. Sem favorito acessível, abre o primeiro
site disponível. Essa preferência também está disponível para visualizadores,
sem conceder permissão de editar o site.

Conteúdo e requisições de páginas dependentes do site são reiniciados na troca.
Resultados e experimentos usam `siteId`; a fila de revisão também filtra no servidor.
Detalhes de um experimento de outro site não mostram ações sob um contexto incorreto:
o usuário recebe a orientação para selecionar o site correspondente.
Links de instalação selecionam explicitamente seu site. Novos sites entram no
seletor imediatamente, sem recarregar a página.

## Contrato da API

- `GET /v1/auth/preferences` → `{ "favoriteSiteId": "UUID ou null" }`.
- `PUT /v1/auth/preferences`, corpo `{ "favoriteSiteId": "UUID ou null" }`, retorna
  a preferência salva. Campos adicionais e IDs inválidos são rejeitados.
- A identidade e o workspace vêm exclusivamente do JWT. Um site de outro workspace
  ou inexistente é rejeitado sem alterar a preferência anterior.
- O único ponteiro fica em `user_membership.favorite_site_id`, com FK para Site e
  `ON DELETE SET NULL`. A atualização e seu registro de auditoria são transacionais.
  Duas gravações concorrentes continuam resultando em apenas um favorito.
- `GET /v1/approvals?status=pending&siteId=UUID` filtra antes do limite de paginação,
  preservando a restrição por tenant e a compatibilidade de chamadas sem `siteId`.

O frontend nunca substitui uma preferência sincronizada por localStorage.
Falhas na leitura/salvamento são mostradas com recuperação; falhas ao salvar mantêm
o favorito anterior.

## Integração concluída nos repositórios

As alterações foram integradas ao repositório original `landing-optimizer-api`.
Os helpers locais agora iniciam essa API, sem depender da cópia de preparação.
A migração foi aplicada e conferida somente no banco local, na porta 55433.
O fluxo completo pode ser revisado em `http://localhost:3000`, com a API na porta 3001.

Para validar a API a partir de seu próprio repositório:

```powershell
npm.cmd run prisma:generate
npm.cmd run typecheck
npm.cmd test
```

Em cada ambiente, aplique `npm.cmd run prisma:deploy` antes de iniciar a nova API.
Publique a API antes do dashboard que consome o novo contrato. Nenhuma alteração
desse recurso foi publicada em produção; não foram feitos commits ou push.

## Validação local

- Dashboard: 66 testes, typecheck e build de produção passaram.
- API original: 238 testes passaram, 4 testes existentes foram ignorados;
  typecheck, compilação e validação do schema Prisma passaram.
- O lint da API está indisponível na instalação atual: a configuração legada
  exige `@typescript-eslint/eslint-plugin`, que não está instalado. Nenhuma
  dependência foi adicionada para alterar essa configuração fora do escopo.
- Navegador real: seleção compartilhada em quatro páginas, revisão filtrada,
  troca/remoção do único favorito, abertura em sessão independente e retorno ao
  favorito após recarregar. Links de instalação também mantêm o contexto correto.
- Capturas em 390px e 1920px sem transbordamento horizontal da página e sem erros
  JavaScript. Evidências em `.local-mock/selection-result.json` e capturas
  `selection-*.png`, fora do versionamento.
