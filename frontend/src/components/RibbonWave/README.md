# RibbonWave

Fundo decorativo de fitas animadas em WebGL. Preenche um contêiner com
`position: relative`, sem interceptar cliques, a passagem do ponteiro ou arraste.

```jsx
<div style={{ position: 'relative', minHeight: 480 }}>
  <RibbonWave />
</div>
```

Propriedades:

- `className`: classe adicional para ajustar a composição.
- `extendToHeader`: por padrão `false`; quando `true`, estende a onda atrás da
  barra de navegação usando `--navigation-height`.

O renderizador Three.js é carregado sob demanda. A área de desenho é transparente, limitada a
30 quadros/s e densidade de 1,5. A animação libera recursos ao sair da tela,
ocultar a aba ou desmontar o componente. Movimento reduzido, falhas de WebGL e
perda de contexto exibem a versão estática responsiva.

Os arquivos visuais ficam em `public/ribbon-wave/`. A origem dos recursos está
registrada na documentação técnica em `docs/assets-provenance/`, fora da aplicação.
Os créditos dos algoritmos matemáticos permanecem nos programas de sombreamento.

Na abertura, a ordem das camadas é logos (1), onda (2), texto e ações (3).
