# Captura e visualização do heatmap

O dashboard combina uma imagem da página com os seletores e retângulos do JSON
gerado pelo snippet. As interações são associadas por seletor; os retângulos usam
percentuais das dimensões originais para permanecer alinhados ao redimensionar.

A captura do snippet reconstrói HTML em SVG `foreignObject`. Ela copia
estilos computados e imagens acessíveis, mas não incorpora todas as fontes,
imagens de fundo e pseudo-elementos. Esses recursos exigem tratamento específico
na reconstrução de DOM, como documentado pelo
[html-to-image](https://github.com/bubkoo/html-to-image#how-it-works).

O fluxo principal exige **somente o JSON**, que já inclui a imagem e o mapa de
elementos. O tutorial e a área de upload deixam isso explícito; screenshot separado
e PDF continuam sendo alternativas opcionais.

A correção do renderizador está preparada em
[`patches/snippet-capture-fidelity.patch`](../patches/snippet-capture-fidelity.patch)
para o repositório `landing-optimizer-snippet`. Nesta sessão esse repositório não
está liberado para escrita; o patch foi desenvolvido e validado numa cópia local.
Ele incorpora fontes, imagens de fundo e pseudo-elementos, aguarda fontes/imagens,
remove recursos privados antes de qualquer fetch e mantém as coordenadas alinhadas.
Páginas acima dos limites são recusadas em vez de serem cortadas silenciosamente.
Recursos externos continuam dependendo de CORS; recursos autenticados não são
buscados com credenciais. Vídeos, canvas e iframes continuam omitidos por privacidade.

Para aplicar, dentro do repositório do snippet, execute `git apply --check` e depois
`git apply` com o caminho absoluto do patch. Isso altera somente `src/capture.ts`
e `test/capture.test.ts`; não há dependências novas. Rode `npm test`,
`npm run typecheck` e `npm run build` no snippet antes de publicar o novo bundle.
Capturas antigas precisam ser refeitas depois da atualização do snippet servido.

Para maior fidelidade, o editor pode enviar um screenshot real de página inteira
junto do JSON. O dashboard substitui somente a imagem, preservando coordenadas,
seletores e dimensões lógicas. Não há serviço de captura novo nem alteração na API.
O fluxo anterior, somente com JSON, continua disponível.

- JSON: até 6 MB. Screenshot: PNG, JPEG ou WebP, até 3 MB.
- A área de upload aceita arrastar e soltar ou seleção pelo teclado/clique, com
  um JSON e uma imagem ou PDF. É possível adicionar os arquivos separadamente,
  conferir seus nomes e remover ou substituir a seleção antes do envio.
- Ambos precisam ter a mesma página, largura e conteúdo. A validação de proporção
  permite até dois pixels lógicos de arredondamento; não identifica conteúdo errado.
- Imagens de alta densidade são reduzidas proporcionalmente aos limites da API:
  dimensões da captura, 24 milhões de pixels e 3 MB após codificação.
- Screenshots manuais não passam pela remoção de dados privados do snippet.
  Capture uma página sem dados pessoais, formulários preenchidos ou conteúdo privado.

PDFs também são aceitos (até 6 MB e 50 páginas, sem senha). O
[PDF.js](https://mozilla.github.io/pdf.js/examples/) é carregado sob demanda e seu
worker é servido pelo dashboard. Todas as páginas são rasterizadas localmente e
unidas em ordem, limitadas a 24 milhões de pixels, 40.000 px de altura e 3 MB na
imagem enviada à API. Não é armazenado nem executado o documento original.
Como o layout de impressão pode diferir do DOM, o PDF vira uma referência visual
sem retângulos de elementos: as camadas e marcações ficam desativadas. As métricas
por caminho continuam disponíveis na tabela e no gráfico de rolagem abaixo.
O JSON continua obrigatório para identificar o site e o caminho. PDFs manuais
também devem estar livres de conteúdo privado.

O tutorial diferencia Imprimir → Salvar como PDF de screenshot. No Chrome/Edge,
o atalho Ctrl+Shift+P abre o
[menu de comandos quando o foco está no DevTools](https://developer.chrome.com/docs/devtools/command-menu).
Ele também pode ser aberto pelo menu de três pontos do DevTools → Run command.

O tutorial permanece disponível após a primeira captura, inclusive se a leitura
falhar. O visualizador oferece rolagem interna em uma área de altura delimitada,
tamanho original ou ajuste à largura e uma opção para ocultar marcações.
O modo cinema usa um [dialog nativo](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal),
com fundo escurecido, margens, fechamento por Esc e retorno do foco. A posição de
rolagem acompanha a escala ao abrir e fechar.

As métricas existentes cobrem os últimos 30 dias por caminho e seletor; não são
versionadas por captura nem segmentadas pela largura de cada visitante. Uma imagem
fiel não elimina esse limite de associação. Gere um novo par quando o layout mudar.
Seletores sem correspondência continuam disponíveis na tabela, sem posição inventada
na imagem. Vídeos e animações aparecem como um único instante no screenshot.
