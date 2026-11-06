# LogoLoop — React Bits, JavaScript + CSS

O código-fonte e o CSS foram copiados da referência anexada pelo usuário. O componente importa apenas o React e seu próprio CSS. O pacote `react-icons`, apresentado no exemplo de uso, não é necessário porque esta integração utiliza arquivos de imagem.

O componente que integra a faixa à página inicial é `../BateriaLogos.jsx`. Ele exibe sete logos distintos de 80 px, com espaçamento de 128 px, cores originais e rolagem horizontal contínua. A opção local `hoverTarget="item"` pausa a rolagem imediatamente apenas quando o ponteiro está sobre um logo e a retoma ao sair. O valor padrão, `hoverTarget="loop"`, preserva o comportamento original do componente. Não há botões para reproduzir ou pausar. O suporte a deslizar com o dedo, arrastar, movimento reduzido e listas duplicadas ocultas continua disponível. Os logos fornecidos não implicam parcerias, vínculos ou links para essas instituições.

Em dispositivos com mouse, passar o ponteiro sobre um logo mantém suas cores originais e deixa os demais em tons de cinza. Ao retirar o ponteiro, todas as cores são restauradas. Esse estilo se aplica apenas à integração da página inicial; os arquivos de imagem originais permanecem inalterados.
