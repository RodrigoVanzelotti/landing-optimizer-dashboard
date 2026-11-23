# Cenários fictícios da Aurora

O script `scripts/seed-feature-demo.mjs` complementa o conjunto antigo, sem apagar
ou sobrescrever seus registros. Ele aceita somente o site de produção
`01a1eefa-8765-7e82-9bd1-f101b8d8c976`, domínio `aurora-mock.example.com`, dentro
do workspace do operador autenticado. O nome e o marcador do conjunto antigo
também precisam confirmar que se trata de demonstração.

Todos os novos títulos começam com “Demonstração · ”. Os insights usam o modelo
`curated-demo-v2` e identificam suas evidências como fictícias; não são respostas
geradas por IA. Os eventos e resultados carregam `synthetic: true` e
`dataset: aurora-features-v2`.

## Executar

Compile primeiro a API do diretório irmão: os resultados fictícios reutilizam
as funções de séries temporais e avaliação estatística de seu `dist`.
Forneça `DATABASE_URL`, `MOCK_API_URL` e `MOCK_ACCESS_TOKEN` por um mecanismo
autorizado, sem registrar credenciais em arquivos ou argumentos.

```powershell
node --test scripts/seed-feature-demo.test.mjs
node scripts/seed-feature-demo.mjs
node scripts/seed-feature-demo.mjs --apply
```

A primeira execução mostra somente o plano. `--apply` adiciona os registros numa
transação, com trava do site e auditoria. IDs determinísticos evitam duplicatas.
Reexecutar preserva decisões, dados e datas existentes, incluindo os prazos de
preparação e vencimento. A carga não aprova nem inicia experimentos reais e não
aciona geração de IA. Incrementa apenas a versão da configuração deste site
fictício para invalidar seu cache.

## Compatibilidade de produção em 23/11/2026

A API publicada ainda não possui `experiment.evaluation_plan`,
`experiment.result_snapshot`, o estado `accepted` ou os campos de rejeição de
insights. O endpoint de relatório temporal também retorna 404. Por isso, a carga
verifica o schema e adia os exemplos incompatíveis.

Foram adicionados e conferidos pelas leituras da API:

- 5 insights: dois pendentes com riscos diferentes, preparação no prazo,
  preparação atrasada e um aceito com experimento disponível.
- 7 experimentos: em revisão, aprovado para iniciar, dois em andamento, pausado,
  rejeitado e vencido.
- 9.180 eventos fictícios, incluindo 2.700 exposições e 270 conversões. Um teste
  compara 10% com 12%: +2 pontos percentuais e +20% relativo; outro compara 10%
  com 8%. As amostras em andamento permanecem inconclusivas.

A reexecução foi conferida: nenhum registro duplicado e uma entrada de auditoria.
O conjunto anterior permaneceu intacto.

Após a publicação da API e das migrações pelo fluxo central de infraestrutura,
reexecute o plano e a carga para completar:

- Insight rejeitado.
- Resultados conclusivos de melhora, queda e ausência de diferença relevante.
- Mudança aceita para 100% dos visitantes e mudança revertida.

Esses resultados são snapshots sintéticos com séries diárias, contagens e
intervalos coerentes, validados pelas mesmas regras estatísticas da API.
Não são eventos históricos individuais de visitantes. A publicação do novo
dashboard também é necessária para visualizar os novos filtros e gráficos.
