# Componentes compartilhados da interface

A composição geral é definida em `frontend/src/components/AppShell.jsx` e usada
uma vez em `App.jsx`. Todas as rotas recebem a mesma navbar, rodapé, largura,
margens, foco após navegação e link para pular ao conteúdo.

| Componente | Uso | Configuração |
| --- | --- | --- |
| `AppShell` | Estrutura comum das páginas | `title`, `fullWidth`, `children` |
| `Footer` | Rodapé comum com marca Flam grande, centralizada e fundo animado na paleta do RibbonWave | Sem propriedades; animação estática com movimento reduzido |
| `PageIntro` | Título, descrição e rótulo das páginas | `id`, `eyebrow`, `title`, `description`, `variant`, `children` |
| `Button` | Executar uma ação | `variant`, `size`, `type`, atributos nativos |
| `ActionLink` | Navegar com aparência de botão | `to`, `variant`, `size`, `arrow`, atributos do link |
| `FormField` | Campo com rótulo, ajuda e erro acessíveis | `label`, `hint`, `error`, atributos do input |
| `Message`, `Loading` | Avisos e estados de carregamento | Conteúdo e variante |
| `ModuleGrid` | Lista de módulos em cards responsivos | `modules`: itens com `path`, `title`, `description`, `status`, `actionLabel` |
| `BrandLogo` | Logo original Flam, sem duplicar o SVG de apresentação | `className`; largura pela variável `--logo-width` |
| `BateriaLogos` | Faixa de emblemas com pausa e destaque no hover | `logos`, `speed`, `logoHeight`, `gap`, `className` |
| `RibbonWave` | Fundo animado com alternativa estática | `className`, `extendToHeader` |

`Button` e `ActionLink` compartilham as variantes `primary` e `secondary`, os
tamanhos `default` e `large` e o mesmo CSS. A navbar usa o tamanho `large`; os
formulários e chamadas da página usam `default`.

## Como compor uma página

```jsx
import PageIntro from '../components/PageIntro.jsx';
import { ActionLink } from '../components/ui.jsx';

export default function MinhaPagina() {
  return <section aria-labelledby="page-title">
    <PageIntro id="page-title" eyebrow="Sua bateria"
      title="Título da página" description="Descrição do conteúdo.">
      <ActionLink to="/ensaios" variant="secondary">Ver ensaios</ActionLink>
    </PageIntro>
  </section>;
}
```

Registre a rota dentro de `RequireAuth` quando ela exigir sessão. As permissões
continuam centralizadas em `auth/access.js`, com autorização também na API.

## Onde alterar a identidade visual

- `frontend/src/global.css`: fontes, cores, raios, largura, margens responsivas e
  altura padrão dos controles. Evite redefinir a família da fonte por página.
- `frontend/src/components/ui.module.css`: botões, links de ação e campos.
- `frontend/src/components/PageIntro.module.css`: títulos e descrições comuns.
- `frontend/src/components/AppShell.module.css`: estrutura geral das rotas.
- `frontend/src/components/Footer.module.css`: composição do rodapé, tamanho da marca e movimento do gradiente; reutiliza a paleta local do RibbonWave e o `BrandLogo` original.

Os módulos CSS de cada página cuidam apenas da composição específica. Use as
variantes dos componentes para diferenças intencionais, preservando o padrão
nas demais páginas.
