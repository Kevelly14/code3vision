# Code3Vision

Landing page responsiva em roxo e preto, com partículas 3D que se transformam nos números 1, 2 e 3 em sequência, navegação, apresentação do estúdio, manifesto e criação de briefing para download.

## Executar

Com Node.js 18 ou superior:

```sh
npm run dev
```

Abra http://localhost:4173. Não é necessário instalar dependências. Também é possível abrir `index.html` diretamente.

## Arquivos

- `index.html`: conteúdo, navegação e diálogos acessíveis.
- `styles.css`: identidade visual e layouts responsivos.
- `digits.js`: geometrias tridimensionais dos números 1, 2 e 3, sem depender de fontes.
- `vision.js`: partículas em Canvas com transições entre os números e controle de movimento.
- `app.js`: menu móvel, diálogos e briefing local.
- `server.cjs`: servidor estático local.

As fontes DM Sans e Instrument Serif são carregadas do Google Fonts, com alternativas locais quando não houver conexão. A arte é gerada no próprio navegador, sem imagens ou bibliotecas externas.

O formulário gera um arquivo de briefing para download; não envia dados. Para receber contatos, conecte um serviço de formulários ou backend e defina o destino das mensagens.
