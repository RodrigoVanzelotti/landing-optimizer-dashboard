# Dados de demonstração

O site **Aurora · Demonstração (dados fictícios)** (`aurora-mock.example.com`)
pertence ao workspace principal de `rodrigovanzelotti@gmail.com`. O domínio é
reservado para exemplos; não é um site público nem precisa receber o snippet.
Selecione esse site na **Visão geral**, tanto em **Dados e indicadores** quanto
em **Experiência do usuário**.

O cenário contém 735 dias completos, com crescimento, sazonalidade semanal,
campanhas trimestrais, horários de visita, dispositivos, navegadores e origens.
Há sessões, visualizações, seções, rolagem, atenção, cliques, frustração, abandono,
início/envio de formulário e conversões. O formulário usa o mesmo seletor e sessão
do início ao envio. Existem metas, mapa estrutural, captura PNG com geometria,
guardrails, sugestões explicitamente fictícias e quatro experimentos: concluído,
em execução, aguardando revisão e rascunho. As exposições/conversões alimentam
os resultados A/B. Nenhum dado pessoal de visitante é gerado.

Histórico preparado em 18/11/2026: **13/11/2024 a 17/11/2026**, UTC. A data de
criação do site simulado acompanha o início para respeitar o contrato de cobertura
dos relatórios. A seleção compartilhada entre páginas e o favorito pessoal são
descritos em [SITE_SELECTION.md](SITE_SELECTION.md); essa integração depende da
publicação conjunta da nova API e do dashboard. Já pode ser revisada localmente.

| Ambiente | Site ID | Eventos |
| --- | --- | ---: |
| Produção | `01a1eefa-8765-7e82-9bd1-f101b8d8c976` | 229.830 |
| Local | `01a1eefd-ba77-7e6b-af3b-183ec3a99f79` | 224.876 |

As amostras diferem porque o gerador usa o ID de cada site como semente; ambos
seguem o mesmo cenário. Relatórios de 7d/30d/6m/1y e heatmap foram verificados
pela API nos dois ambientes. A repetição em produção preservou os 229.830 eventos.
Resultados A/B de produção têm exposições e conversões em ambas as variantes.
A conferência real no navegador passou em ambos: login, seleção do mock,
troca de períodos, captura desktop/mobile e heatmap, sem erros JavaScript.
Capturas e resultado ficam em `.local-mock/`, fora do versionamento.

## Repetir em um ambiente

Requer a API e PostgreSQL acessíveis, as dependências do dashboard e do repositório
irmão `landing-optimizer-api` instaladas e uma conta já provisionada. Use o banco
e o backend de analytics da **mesma API**. O script verifica essa identidade antes
de criar dados. Não exponha PostgreSQL na internet; em produção use conexão
administrativa autorizada, como Cloud SQL Auth Proxy.

Defina `DATABASE_URL`, `MOCK_PASSWORD` e, se necessário, `MOCK_API_URL`
(padrão `http://localhost:3001/v1`) e `MOCK_EMAIL`
(padrão `rodrigovanzelotti@gmail.com`) no ambiente do processo. Não coloque senhas
em argumentos, arquivos versionados ou logs.

```powershell
npm.cmd run mock:seed
npm.cmd run test:mock
```

`ANALYTICS_BACKEND` tem padrão `postgres`. Para a stack ClickHouse, configure
`ANALYTICS_BACKEND=clickhouse` e suas variáveis `CLICKHOUSE_*` existentes.
Esse caminho tem retenção de 180 dias no produto: comparações antigas permanecem
limitadas e a saída de cobertura dos relatórios registra essa limitação.

O gerador usa a API para autenticar/criar o site com suas chaves normais e grava
o histórico no armazenamento de analytics. A ingestão pública reposiciona eventos
nas últimas 24 horas e não aceita importação histórica. Não foi alterada.
As escritas são limitadas ao domínio reservado, ao tenant autenticado e a IDs
próprios do cenário. Eventos existentes sem marcador do mock impedem a carga.
PostgreSQL grava cada dia e seu progresso na mesma transação: uma interrupção
permite retomar sem duplicar. Não execute duas cargas simultâneas. Em ClickHouse,
uma escrita interrompida exige inspeção antes de repetir, pois o marcador fica
em outro banco. Não há remoção automática nem alteração de outros sites.

O cenário é uma fotografia fixa: repetir retoma/verifica o mesmo histórico,
sem gerar tráfego futuro. Nenhum job recorrente foi instalado.

## Ambiente local preparado nesta máquina

O banco preparado fica em `.local-mock/pgdata`, na porta **55433**, a partir de
uma cópia da base de desenvolvimento anterior. `.local-mock/` é ignorado pelo Git
e contém dados privados. Os serviços usam as credenciais locais existentes em
`../artifacts/local-stack/credentials.json`, separadas das de produção.

Para reiniciar, execute em terminais separados, na raiz deste dashboard:

```powershell
& 'C:/Program Files/PostgreSQL/18/bin/postgres.exe' -D (Resolve-Path .local-mock/pgdata).Path -p 55433 -h 127.0.0.1
```

```powershell
node .local-mock/run-local.cjs
```

O helper local inicia a API em **3001** e o dashboard em **3000**, lendo a
configuração existente da API e substituindo a conexão somente no processo.
Use `--seed` para retomar/verificar a carga. Preserve `pgdata` para manter os dados.
Pare os serviços com Ctrl+C nos terminais correspondentes.
