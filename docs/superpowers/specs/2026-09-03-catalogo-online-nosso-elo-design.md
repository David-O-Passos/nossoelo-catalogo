# Catálogo Online NOSSO.ELO — Design

**Data:** 2026-09-03
**Autor:** David
**Status:** Aprovado para planejamento de implementação

---

## 1. Contexto

O cliente revende cosméticos e perfumaria sob encomenda (Natura, O Boticário, Avon, Eudora, perfumes árabes, linha capilar). Hoje o catálogo é um documento Word de **75 páginas** exportado para PDF de 21MB e enviado por WhatsApp.

Análise do arquivo `Agosto 2026_Nosso_Elo.docx` (99MB):

| Métrica | Valor |
|---|---|
| Imagens embutidas | 1.146 (769 PNG, 325 JPEG, 52 WDP descartáveis) |
| Peso da mídia | 72,1 MB |
| Caixas de texto | 2.032 (1.233 únicas após deduplicação) |
| Blocos de preço únicos | 571 |
| Produtos marcados "ESGOTADO" | 41 |
| Imagens com coordenada absoluta | 1.155 |
| Páginas | 75 |

Formato de preço usado, consistente em todo o documento:

```
De: R$ 169,90 – 56%  Por: R$ 75,00
```

Um mesmo bloco de preço frequentemente serve a um **grupo** de produtos (ex.: Kaiak Tradicional, Aventura e Aero compartilham `– 42%`).

### Dores atuais

1. **Refação mensal completa.** O documento é remontado do zero todo mês — layout, fotos e preços.
2. **Fotos regarimpadas.** As imagens são buscadas manualmente no Google a cada ciclo, produto por produto.
3. **Link volátil.** O link do arquivo na bio do Instagram muda a cada atualização.
4. **Consulta ruim para o cliente.** Baixar 21MB e rolar 75 páginas sem busca.
5. **Pedido desorganizado.** O cliente envia prints avulsos; o vendedor consolida à mão.

---

## 2. Objetivos

- Substituir o PDF por um catálogo web com **link permanente** para a bio do Instagram.
- Reduzir a atualização mensal de "refazer o documento" para **editar uma planilha (~20 min)**.
- Permitir que o cliente monte um pedido e envie **uma mensagem única e organizada** por WhatsApp.
- Operar com **custo de manutenção R$ 0,00 permanente**.
- Ser um **produto entregue uma vez**, sem dependência contínua do desenvolvedor.

### Não-objetivos

Pagamento online · controle de estoque real · cadastro/login de cliente · cálculo de frete · múltiplos vendedores · painel de métricas.

---

## 3. Restrições

| Restrição | Origem |
|---|---|
| Custo zero absoluto, incluindo domínio | Decisão do cliente — subdomínio gratuito |
| Nenhum serviço que expire, pause ou exija cartão | Requisito de "entregar e sumir" |
| Operável por pessoa não-técnica, no celular | Perfil do usuário final |
| Sem dependência de servidor ou banco de dados | Consequência do custo zero |

---

## 4. Arquitetura

```
┌─────────────────┐        CSV público        ┌──────────────────────┐
│  Google Sheets  │ ────────────────────────► │   Site estático      │
│  produtos/preços│                           │  Cloudflare Pages    │
└─────────────────┘                           │  (subdomínio grátis) │
        ▲                                     └──────────┬───────────┘
        │ edita                                          │
        │                    ┌───────────────────────────┤
   ┌────┴─────┐              │                           │
   │ Vendedor │              ▼                           ▼
   └────┬─────┘     Imagens WebP (CDN)          Carrinho (localStorage)
        │           pasta /img no repo                   │
        │ sobe foto nova                                 ▼
        └──────────► POST /api/upload ──► GitHub    link wa.me → WhatsApp
                     (Pages Function)      Contents API
```

### Decisões e justificativas

**Site estático em HTML + CSS + JavaScript puro, sem framework e sem build.**
Frameworks envelhecem: em dois anos um `npm install` quebra e o produto morre. Sem dependências, o site funciona indefinidamente e qualquer pessoa consegue mexer. Para ~600–900 produtos com busca e filtro, JavaScript puro é suficiente.

**Google Sheets como fonte de dados, em vez de banco.**
Permite edição em massa (colar uma coluna inteira de descontos), funciona no celular, tem histórico de versões nativo (desfaz erro), não exige login novo e não pode ser descontinuado por falta de pagamento. Um painel com formulários exigiria mil interações para o que a planilha faz com um Ctrl+V.

**Cloudflare Pages como hospedagem.**
Gratuito sem cartão, sem pausa por inatividade, CDN global, e inclui *Functions* para o endpoint de upload de imagem.

**Imagens no repositório, não em serviço de terceiros.**
Elimina dependência de Cloudinary/Imgur/Drive. Servidas pela CDN da Cloudflare junto com o site.

**Carrinho em `localStorage`, não no servidor.**
Nenhum dado do cliente sai do dispositivo dele. O pedido só existe quando o cliente envia a mensagem, exatamente como hoje. Efeito colateral positivo: o carrinho sobrevive ao fechamento do navegador.

---

## 5. Modelo de dados

Planilha Google com uma aba `produtos`:

| Coluna | Tipo | Obrigatória | Observação |
|---|---|---|---|
| `id` | texto | sim | Único, minúsculo, sem acento. Ex.: `kaiak-aventura-100` |
| `ativo` | `sim`/`não` | sim | `não` remove da vitrine sem apagar a linha |
| `marca` | texto | sim | Natura, O Boticário, Avon, Eudora, Árabes, Capilar |
| `categoria` | texto | sim | Ex.: Perfumaria Feminina |
| `nome` | texto | sim | Ex.: Kaiak Aventura |
| `tamanho` | texto | não | Ex.: 100 ml |
| `descricao` | texto | não | Notas olfativas, benefícios |
| `preco_de` | número | não | Preço de tabela |
| `desconto` | número | não | Percentual, sem símbolo |
| `preco_por` | número | sim | **Fórmula na planilha**, editável manualmente |
| `imagem` | texto | não | Nome do arquivo. Ex.: `kaiak-aventura.webp` |
| `destaque` | `sim`/`não` | não | Aparece na seção de promoções da home |

`preco_por` é preenchido por fórmula (`=preco_de*(1-desconto/100)`) e arredondado. O vendedor altera apenas `desconto`; se digitar um valor direto em `preco_por`, esse valor prevalece.

Os 41 produtos hoje marcados "ESGOTADO" entram como `ativo = não`.

---

## 6. Componentes

### 6.1 Carregador de dados (`dados.js`)

Busca o CSV publicado do Sheets, converte em objetos e valida cada linha.

- Guarda o resultado em `localStorage` com validade de 10 minutos; revalida em segundo plano.
- Se o Sheets estiver indisponível, usa o cache; se não houver cache, usa `produtos-backup.json` versionado no repositório.
- Linhas inválidas (sem `id`, sem `nome`, sem `preco_por`, ou `id` duplicado) são descartadas silenciosamente para o cliente e listadas no validador.
- Campos opcionais ausentes ou inválidos **não** descartam o produto; apenas suprimem o elemento correspondente. Sem `preco_de`, o card não exibe o preço riscado. Sem `desconto` válido (0–100), o card não exibe o selo de `% OFF` e o produto vai para o fim da ordenação por desconto. Sem `imagem`, usa o placeholder.

### 6.2 Vitrine (`catalogo.js`)

- Busca instantânea por nome, marca, categoria e descrição, com acentos normalizados.
- Filtros por marca e categoria; ordenação por maior desconto e por preço.
- Card: foto, nome, tamanho, `De:` riscado, `Por:` destacado, selo de `% OFF`, botão adicionar.
- Produto sem imagem recebe um placeholder neutro — nunca quebra o layout.
- Carregamento preguiçoso das imagens (`loading="lazy"`).

### 6.3 Carrinho (`carrinho.js`)

- Chave `nossoelo_carrinho_v1` no `localStorage`.
- Ao carregar, reconcilia com o catálogo atual: item que saiu do ar é removido com aviso; item cujo preço mudou é atualizado com aviso.
- Botão flutuante com contagem e total.
- **Fechar pedido** monta a mensagem e abre `https://wa.me/<numero>?text=<mensagem>`.
- Se a mensagem passar de 1.800 caracteres, avisa e sugere dividir em dois envios.

Formato da mensagem:

```
Olá! Quero fazer um pedido:

1x Kaiak Aventura 100ml — R$ 110,00
2x Hidratante Tododia Macadâmia — R$ 34,80
1x Khamrah 100ml — R$ 189,00

Total: R$ 368,60
```

### 6.4 Link direto por produto

`?p=<id>` abre o catálogo com o produto em destaque, permitindo compartilhar um item específico no WhatsApp ou no Status.

### 6.5 Validador da planilha (`validar.html`)

Página que o vendedor abre para conferir a planilha antes de considerar a atualização pronta. Reporta:

- `id` duplicado ou vazio
- `nome` ou `preco_por` ausente
- imagem referenciada que não existe na pasta
- imagem na pasta que nenhum produto usa
- `desconto` fora de 0–100
- total de produtos ativos e inativos

Esta página é a principal proteção contra o vendedor quebrar o catálogo sem perceber.

### 6.6 Upload de imagem (`/api/upload`)

Cloudflare Pages Function protegida por senha, usada ao cadastrar produto novo.

1. O navegador converte a imagem para WebP via `canvas` antes de enviar (redimensiona para no máximo 800px no maior lado).
2. `POST` com senha e arquivo.
3. A Function grava o arquivo em `/img` via GitHub Contents API, usando um token armazenado como variável de ambiente — nunca exposto ao navegador.
4. O Cloudflare Pages reconstrói o site automaticamente; a imagem fica disponível em cerca de um minuto.

Isso mantém o vendedor autônomo sem que ele precise conhecer GitHub.

### 6.7 PWA

`manifest.json` e ícones, permitindo "adicionar à tela inicial".

**Sem service worker.** Um service worker cacheando o catálogo faria o cliente ver preços desatualizados após a virada do mês — o pior defeito possível neste produto. A conveniência não compensa o risco.

---

## 7. Migração do catálogo atual

Trabalho único, feito uma vez.

**Fase 1 — Extração automática.**
Descompactar o `.docx`, extrair as 1.146 imagens, converter para WebP (72MB → ~8MB estimado), descartar os 52 arquivos WDP. Extrair as caixas de texto com deduplicação do fallback do Word, separar nome, descrição, `preco_de`, `desconto` e `preco_por` pelo padrão identificado, e capturar os cabeçalhos de marca e categoria.

**Fase 2 — Pareamento imagem ↔ produto.**
Usar as coordenadas `wp:posOffset` e `wp:extent` para associar cada imagem ao texto mais próximo. As coordenadas são relativas ao parágrafo-âncora, não à página, então a precisão esperada é de 70–85%.

**Fase 3 — Conferência visual.**
Revisar página por página contra o PDF original, corrigindo os pareamentos errados e os grupos em que um preço serve a vários produtos.

**Fase 4 — Carga.**
Popular a planilha e publicar.

O catálogo é substituído mensalmente, portanto parte do conteúdo de agosto já estará obsoleta. A migração precisa ser boa o suficiente para o vendedor assumir dali em diante, não arqueologicamente perfeita.

---

## 8. Tratamento de erros

| Situação | Comportamento |
|---|---|
| Sheets indisponível | Usa cache local; sem cache, usa `produtos-backup.json` |
| Linha inválida na planilha | Produto omitido da vitrine, reportado no validador |
| Imagem ausente | Placeholder neutro |
| Carrinho com produto removido | Item retirado com aviso ao cliente |
| Carrinho com preço desatualizado | Preço corrigido com aviso |
| Mensagem do WhatsApp longa demais | Aviso sugerindo dividir o pedido |
| Senha errada no upload | Erro claro, sem detalhar o motivo |

---

## 9. Testes

- **Dados:** parser de CSV com campos contendo vírgula, aspas e quebra de linha; linhas incompletas; `id` duplicado; `desconto` inválido.
- **Preço:** cálculo e arredondamento; `preco_por` manual sobrepondo a fórmula.
- **Busca:** normalização de acentos e maiúsculas.
- **Carrinho:** somar, remover, alterar quantidade, persistir após recarregar, reconciliar com catálogo alterado, estourar o limite de caracteres.
- **Manual:** catálogo real aberto em Android e iPhone, em 4G, verificando tempo de carregamento e legibilidade dos preços.

---

## 10. Entrega

1. Site publicado no subdomínio gratuito, com o link definitivo para a bio do Instagram.
2. Planilha compartilhada com o vendedor como editor, já populada.
3. Vídeo de aproximadamente 5 minutos cobrindo: alterar descontos em massa, marcar esgotado, reativar produto e cadastrar produto novo com foto.
4. Guia impresso de uma página com os mesmos quatro procedimentos.
5. Credenciais entregues: acesso à planilha e senha do upload.

Os itens 3 e 4 são parte do produto, não cortesia: sem eles o vendedor liga a cada dúvida e a venda única vira prestação de serviço contínua.

---

## 11. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Vendedor quebra a estrutura da planilha | Média | Validador + histórico de versões do Sheets + colunas protegidas |
| Pareamento de imagem incorreto na migração | Alta | Conferência visual página a página na Fase 3 |
| Google descontinua a publicação em CSV | Baixa | Backup JSON versionado; procedimento de troca documentado |
| Vendedor abandona e volta ao Word | Média | Vídeo curto e a atualização precisa mesmo levar ~20 min |
| Cliente vê preço antigo | Baixa | Cache de 10 minutos e ausência deliberada de service worker |

---

## 12. Definições e pendências

**Número de WhatsApp de destino.** O catálogo traz `73 9 98113 9437` (12 dígitos). O primeiro `9` é um erro de digitação e deve ser ignorado. O número correto é **(73) 98113-9437**, e o link do carrinho usa `https://wa.me/5573981139437`.

**Pendente:** nome do subdomínio. Sugestão `nossoelo.pages.dev`, sujeito a disponibilidade no momento do registro.

---

## 13. Estimativa

| Etapa | Estimativa |
|---|---|
| Extração automática e conversão de imagens | 1–2 dias |
| Pareamento e conferência visual | 2–4 dias |
| Construção do site | 2–3 dias |
| Testes, vídeo e guia | 1 dia |
| **Total** | **1 a 2 semanas** |
