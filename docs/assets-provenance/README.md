# Origem dos arquivos visuais

Os manifestos deste diretório registram os endereços de origem dos recursos
visuais usados no projeto. Estes registros são documentação técnica e não são
servidos na aplicação. Os arquivos são locais em `frontend/public/`.

Os créditos de algoritmos de terceiros presentes nos programas de sombreamento foram preservados.

A família Ranade foi fornecida por Pedro, incluindo cinco pesos (100, 300, 400,
500 e 700) em estilos normal e itálico. Os arquivos originais e a licença recebida
ficam em `frontend/public/fonts/ranade/`; a licença informa `Personal Use Only`.
O registro de origem está em `ranade.json`.

As dez variantes são registradas em `frontend/src/fonts/ranade.css`, importado
pelo CSS global. Para usar em um seletor, aplique `font-family: 'Ranade',
sans-serif`, escolha o `font-weight` e, quando necessário, `font-style: italic`.
O navegador baixa somente as variantes usadas na página.
