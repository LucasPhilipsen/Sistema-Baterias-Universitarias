# Direção visual da interface

Identidade visual do Flam: superfícies brancas, azul-marinho, índigo, tipografia compartilhada e composição consistente entre as páginas.

## Paleta e superfícies

- Branco `#ffffff`: superfície principal.
- Azul-marinho `#061b31`: títulos e texto principal.
- Índigo `#533afd`: ações, links e estado ativo.
- Névoa `#f8fafd`: mensagens e rodapé.
- Gelo `#e5edf5`: divisórias de 1 px.
- Lavanda `#b9b9f9`: contorno das ações secundárias e campos.

O hover das ações preenchidas usa `#4326df` para preservar o contraste com texto branco. Vermelho fica reservado aos estados de erro. Não há sombras nem desfoque; botões, campos e superfícies usam raio de 4 px.

## Tipografia

Söhne variável (`sohne-var`), aplicada a títulos, textos, navegação e formulários. Source Code Pro Medium é a família monoespaçada usada em código. Os arquivos WOFF2 são servidos localmente em `frontend/public/fonts/`, com `font-display: swap`. As URLs de origem estão em `docs/assets-provenance/fonts.json`; não há requisições a serviços externos de fontes em tempo de execução.

Títulos usam peso 300 e escala de até 56 px. Navegação, campos e botões usam peso 400; apenas a marca usa peso 600. Texto corrido é alinhado à esquerda e usa azul-marinho; a cor secundária fica nos rótulos e textos breves.

## Composição

Barra de navegação de 96 px no desktop e 76 px no celular, com o logo Flam original à esquerda, links logo após a marca e Login à direita. A marca preserva os pixels e a transparência do PNG fornecido; um viewport SVG elimina apenas as margens vazias na apresentação. Na página inicial, a onda passa atrás da navbar. O fundo branco com cantos arredondados aparece suavemente no hover, no foco de teclado e ao abrir o menu; nas páginas internas, fica visível. Abaixo de 1100 px, um botão abre o menu com links e ações de sessão; Escape, clique externo e navegação fecham o menu. Página inicial com título em duas linhas, descrição e ações primária/secundária. Módulos organizados por espaço e divisórias, sem caixas decorativas. Login em duas colunas no desktop e uma no celular.

Layout de até 1320 px, espaçamento em múltiplos de 8 px, foco visível e alvos de toque a partir de 44 px. As informações de módulos ainda em desenvolvimento continuam identificadas; não há números ou dados de negócio simulados na interface.

A faixa de logos fica entre as ações da página inicial e a divisória dos módulos, com emblemas de 80 px em suas cores originais e espaços de 128 px para mostrar menos logos simultaneamente. Usa LogoLoop na variante JavaScript + CSS da referência fornecida, sem dependências extras. A Bandida aparece uma vez na sequência de sete baterias. Os fundos externos foram recortados de forma determinística, incluindo o fundo preto da Meritíssima, sem redesenhar os emblemas. A rolagem é contínua, sem botões; pausa ao passar o mouse sobre um logo e retoma ao sair. Há suporte a arraste e respeito a movimento reduzido.

Ao passar o mouse sobre um emblema, os demais ficam em preto e branco e o emblema apontado mantém suas cores.

A abertura usa o componente `RibbonWave`, com faixas coloridas sobre fundo transparente e branco da página. A onda ocupa a abertura até o fim dos logos e fica acima da faixa, enquanto texto e ações permanecem na camada superior. A camada decorativa ignora eventos de ponteiro, preservando hover e arraste. Three.js é carregado sob demanda; movimento reduzido e indisponibilidade de WebGL usam a imagem estática local. Detalhes e fontes estão em `frontend/src/components/RibbonWave/README.md`.

A estrutura, os títulos, as ações e os cards são componentes compartilhados. A composição e as propriedades disponíveis estão em [Componentes da interface](frontend-components.md).
