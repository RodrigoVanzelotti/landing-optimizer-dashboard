# Captura e visualização do heatmap

O dashboard combina uma imagem da página com os seletores e retângulos do JSON
gerado pelo snippet. As interações são associadas por seletor; os retângulos usam
percentuais das dimensões originais para permanecer alinhados ao redimensionar.

A captura atual do snippet reconstrói HTML em SVG `foreignObject`. Ela copia
estilos computados e imagens acessíveis, mas não incorpora todas as fontes,
imagens de fundo e pseudo-elementos. Esses recursos exigem tratamento específico
na reconstrução de DOM, como documentado pelo
[html-to-image](https://github.com/bubkoo/html-to-image#how-it-works).

Para maior fidelidade, o editor pode enviar um screenshot real de página inteira
junto do JSON. O dashboard substitui somente a imagem, preservando coordenadas,
seletores e dimensões lógicas. Não há serviço de captura novo nem alteração na API.
O fluxo anterior, somente com JSON, continua disponível.

- JSON: até 6 MB. Screenshot: PNG, JPEG ou WebP, até 3 MB.
- Ambos precisam ter a mesma página, largura e conteúdo. A validação de proporção
  permite até dois pixels lógicos de arredondamento; não identifica conteúdo errado.
- Imagens de alta densidade são reduzidas proporcionalmente aos limites da API:
  dimensões da captura, 24 milhões de pixels e 3 MB após codificação.
- Screenshots manuais não passam pela remoção de dados privados do snippet.
  Capture uma página sem dados pessoais, formulários preenchidos ou conteúdo privado.

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
