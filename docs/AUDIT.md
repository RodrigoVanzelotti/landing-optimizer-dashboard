# Registro de atividades

## Consulta

O registro não carrega eventos ao abrir a aba. Clique em **Filtrar atividades**,
escolha os filtros e depois em **Consultar atividades**. A API retorna até 25
registros por página e um cursor para a próxima; não transfere o histórico inteiro.

- Períodos: **Última semana**, **Últimos 30 dias**, **Últimos 6 meses** e **Último
  ano**. São intervalos móveis até o instante da consulta, incluindo hoje. Meses
  usam o calendário com ajuste para o último dia válido do mês. Horários da tela
  usam o fuso do navegador. Esses períodos não excluem hoje como as comparações
  de dias completos da visão geral.
- Ação e autor podem ser combinados com o período.
- Ordenação: mais recentes ou mais antigas primeiro. Data e ID desempatarão
  registros criados no mesmo instante, preservando a paginação.
- Alterar os campos não consulta automaticamente nem modifica a busca aplicada.
  Uma nova consulta reinicia a paginação. Erros preservam os filtros.

`GET /audit/options` lista autores e ações disponíveis no workspace, usando
agregações no banco. `GET /audit/search` aceita `timeframe=7d|30d|6m|1y`, `action`,
`actorUserId`, `order=asc|desc` e `cursor`. `actorUserId=system` consulta ações
sem autor de conta registrado. Valores são validados; todos os registros e
cursores são restritos ao tenant autenticado.

`GET /audit?action=...` mantém a resposta legada em array, limitada aos 100
registros mais recentes, sem identidades, metadados ou hashes de IP. Clientes
anteriores continuam funcionando enquanto há páginas antigas abertas. Publique
a API com `/audit/search` e `/audit/options` antes do novo dashboard.

## Autores atuais e antigos

Administradores podem consultar autores encontrados no histórico do workspace,
mesmo que seus vínculos de equipe tenham sido removidos. Nome e e-mail são
resolvidos pela conta preservada; “Fora da equipe atual” também pode representar
um operador da plataforma que agiu no cliente sem ser membro dele.

Editores/visualizadores recebem apenas autores atuais nas opções. A API rejeita
um filtro direto pelo ID de um autor fora da equipe e não envia sua identidade
nas linhas de resultados. Nomes de contas afetadas também respeitam essa regra.
Esses perfis mantêm a leitura de atividades permitida anteriormente.

A remoção de membro exclui o vínculo de acesso, preservando conta e auditoria.
Uma conta legada sem convite aceito pode ser reativada quando há um registro de
`team.member_removed` para seu ID neste workspace. Sem convite aceito nem prova
de remoção, a API continua recusando anexar uma conta existente: não se inventa
um vínculo anterior nem se usa o histórico de outro workspace.
Se uma conta for apagada fisicamente por uma operação externa ao produto, seu ID
de autor ainda fica no registro, mas seu nome/e-mail pode não estar disponível.
Eventos antigos sem `actorUserId` aparecem como **Sistema / autor não registrado**;
não se inventa uma atribuição retroativa.

## Cobertura das ações

| Área | Ações registradas |
| --- | --- |
| Equipe | Convite criado, aceito e revogado; pessoa adicionada, removida ou reativada; perfil alterado |
| Sites | Cadastro e atualização; origem adicionada/removida; publicação administrativa de configuração |
| Metas | Criação, atualização e exclusão |
| Experimentos | Criação, edição, revisão, aprovação/rejeição, agendamento, início, pausa, conclusão, reversão e interrupção |
| IA | Análise e conversão de sugestão em experimento |
| Marca | Atualização das diretrizes |
| Capturas | Captura recebida, exclusão manual e remoção automática por retenção |
| Workspace | Provisionamento, arquivamento e reativação |
| Conta | Login/logout, emissão de link de redefinição e alteração de senha |

Na entrada por convite, a adição fica atribuída ao administrador que convidou;
um registro separado identifica quem aceitou. Revogações automáticas de convites
ao remover um membro também são registradas. Alteração de senha afeta a conta
global e fica registrada em todos os seus workspaces.

CLI e tarefas automáticas podem não ter uma conta autora. Uma captura recebida
pela chave pública de ingestão registra a origem `ingest_key`, sem fingir conhecer
a pessoa que abriu `?lo_capture=1`. Leituras, consultas analíticas, eventos de
visitantes, renovação de token e reconstruções técnicas do cache público não são
ações administrativas nesta trilha. Falhas de requisição continuam nos logs
operacionais existentes; esta página mostra ações efetivamente persistidas.

## Integridade e privacidade

Alterações persistentes e seus registros são escritos na mesma transação SQL.
Se a auditoria falhar, cadastro/remoção/edição não é confirmada no banco. Efeitos
externos como publicação no cache ocorrem depois: uma falha posterior não apaga
o registro da alteração que já foi persistida. Logout sempre limpa o cookie,
inclusive se a auditoria estiver indisponível, sem esconder o erro do servidor.
O dashboard também limpa o token local em caso de falha e encaminha ao login,
avisando quando não foi possível confirmar a saída no servidor.

Não se registram senhas, hashes de senha, tokens, links secretos de convite/reset
ou corpos completos de requisição. A consulta pública de auditoria não retorna
metadados brutos nem hashes de IP. Autores e alvos são identificados por IDs;
metadados internos usam campos selecionados por cada operação.

Não há backfill de ações que versões anteriores nunca gravaram. Os registros
anteriores existentes são preservados e passam a ser consultáveis pelos filtros.
Não há endpoints para editar ou apagar registros de auditoria.

## Verificação

Testes cobrem validação dos filtros, datas, privacidade de ex-membros, tentativas
de contornar a restrição por ID, isolamento de tenant/cursor, limite e ordenação.
O teste opcional com `AUDIT_TEST_DATABASE_URL` exige PostgreSQL local e cria um
schema próprio, descartado ao final; valida transações reais, identificação após
remoção de membro e paginação com datas iguais. Uma trigger que rejeita a gravação
de auditoria demonstra que o cadastro de site e a remoção de membro são desfeitos.
