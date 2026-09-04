# Catálogo Online NOSSO.ELO — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir um catálogo Word/PDF de 75 páginas por um site estático gratuito onde o cliente busca produtos, monta um carrinho e envia o pedido por WhatsApp, e onde o vendedor atualiza tudo por uma planilha Google.

**Architecture:** Duas partes independentes. (1) Um pipeline Python que roda uma única vez e converte `Agosto 2026_Nosso_Elo.docx` em um CSV de produtos mais uma pasta de imagens WebP. (2) Um site estático em HTML/CSS/JavaScript puro, hospedado no Cloudflare Pages, que lê uma planilha Google publicada como CSV e mantém o carrinho no `localStorage` do próprio cliente.

**Tech Stack:** Python 3.11 (stdlib + Pillow 12.3) · JavaScript ES Modules sem framework e sem build · `node --test` e `unittest` para testes · Cloudflare Pages + Pages Functions · Google Sheets como fonte de dados.

**Spec:** `docs/superpowers/specs/2026-09-03-catalogo-online-nosso-elo-design.md`

## Global Constraints

- **Nenhuma dependência de runtime no site.** Sem framework, sem bundler, sem `npm install`. Apenas HTML, CSS e ES Modules nativos.
- **Python usa apenas stdlib + Pillow.** Pillow 12.3.0 já está instalado. Não adicionar outras bibliotecas.
- **Testes JavaScript:** `node --test` (nativo do Node 24). **Testes Python:** `unittest` (stdlib).
- **Número de WhatsApp:** `5573981139437`. O link é `https://wa.me/5573981139437?text=<mensagem>`.
- **Limite da mensagem do WhatsApp:** 1800 caracteres antes de avisar o cliente.
- **Cache dos dados:** 10 minutos (600000 ms).
- **Chave do carrinho no localStorage:** `nossoelo_carrinho_v1`.
- **Imagens:** WebP, máximo 800px no maior lado, qualidade 82.
- **Proibido service worker.** Causaria exibição de preços desatualizados na virada do mês.
- **Todo texto de interface em português do Brasil.**
- **Commits em português**, prefixados com `feat:`, `fix:`, `test:` ou `chore:`.

---

## Estrutura de arquivos

```
SITE CATALOGO ATEMILTON/
├── ferramentas/                    # Pipeline de migração (roda 1x, local)
│   ├── parser_preco.py             # texto de preço → números
│   ├── parser_produto.py           # texto → nome, tamanho, descrição
│   ├── docx_leitor.py              # .docx → tokens ordenados com coordenadas
│   ├── imagens.py                  # extrai e converte para WebP
│   ├── pareador.py                 # associa imagem ao produto
│   ├── extrair.py                  # orquestra tudo, gera CSV e relatório
│   └── testes/
│       ├── test_parser_preco.py
│       ├── test_parser_produto.py
│       ├── test_docx_leitor.py
│       └── test_pareador.py
├── site/                           # Publicado no Cloudflare Pages
│   ├── index.html
│   ├── validar.html
│   ├── manifest.json
│   ├── produtos-backup.json
│   ├── css/estilo.css
│   ├── img/                        # WebP dos produtos
│   ├── js/
│   │   ├── config.js               # URL da planilha, número, constantes
│   │   ├── csv.js                  # parser de CSV
│   │   ├── dados.js                # busca, cache, validação, fallback
│   │   ├── carrinho.js             # estado do carrinho e mensagem
│   │   ├── catalogo.js             # busca, filtros, renderização
│   │   ├── validador.js            # regras da página validar.html
│   │   └── app.js                  # ponto de entrada, liga tudo
│   └── functions/api/upload.js     # Cloudflare Pages Function
└── testes-site/
    ├── test_csv.js
    ├── test_dados.js
    ├── test_carrinho.js
    ├── test_catalogo.js
    └── test_validador.js
```

**Responsabilidades.** `ferramentas/` roda uma vez e morre; nada dele vai para produção. Em `site/js/`, cada módulo tem uma responsabilidade e exporta funções puras sempre que possível, para que `node --test` consiga importá-las sem navegador. `app.js` é o único arquivo que toca no DOM diretamente e conhece os outros módulos.

---

## FASE 1 — Pipeline de migração

### Task 1: Repositório e parser de preço

**Files:**
- Create: `.gitignore`
- Create: `ferramentas/parser_preco.py`
- Test: `ferramentas/testes/test_parser_preco.py`

**Interfaces:**
- Consumes: nada.
- Produces: `parse_preco(texto: str) -> dict | None`. Retorna `{'preco_de': float|None, 'desconto': int|None, 'preco_por': float|None, 'cada': bool}` ou `None` se o texto não contiver preço algum.

- [ ] **Step 1: Inicializar o repositório**

```bash
git init
git branch -M main
printf '__pycache__/\n*.pyc\nferramentas/saida/\nnode_modules/\n' > .gitignore
mkdir -p ferramentas/testes site/js site/css site/img testes-site
touch ferramentas/testes/__init__.py
git add .gitignore docs
git commit -m "chore: estrutura inicial do projeto e spec"
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `ferramentas/testes/test_parser_preco.py`. Os casos vêm de strings reais extraídas do documento.

```python
import unittest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from parser_preco import parse_preco


class TestParsePreco(unittest.TestCase):

    def test_formato_completo(self):
        r = parse_preco('De: R$ 169,90 \u2013 56%Por: R$ 75,00')
        self.assertEqual(r['preco_de'], 169.90)
        self.assertEqual(r['desconto'], 56)
        self.assertEqual(r['preco_por'], 75.00)
        self.assertFalse(r['cada'])

    def test_de_sem_simbolo_real(self):
        r = parse_preco('De: 319,90 \u2013 44%Por: R$ 180,00')
        self.assertEqual(r['preco_de'], 319.90)
        self.assertEqual(r['preco_por'], 180.00)

    def test_sem_espaco_depois_de_por(self):
        r = parse_preco('De: R$ 279,90 \u2013 48%Por:R$ 145,00')
        self.assertEqual(r['preco_por'], 145.00)

    def test_marcador_cada(self):
        r = parse_preco('De: R$ 279,90 \u2013 45%Por: R$ 155,00 Cada')
        self.assertEqual(r['preco_por'], 155.00)
        self.assertTrue(r['cada'])

    def test_apenas_por_sem_dois_pontos(self):
        r = parse_preco('Por 20,00')
        self.assertIsNone(r['preco_de'])
        self.assertIsNone(r['desconto'])
        self.assertEqual(r['preco_por'], 20.00)

    def test_apenas_de(self):
        r = parse_preco('De R$ 73,80')
        self.assertEqual(r['preco_de'], 73.80)
        self.assertIsNone(r['preco_por'])

    def test_milhar_com_ponto(self):
        r = parse_preco('Por: R$ 1.299,90')
        self.assertEqual(r['preco_por'], 1299.90)

    def test_hifen_comum_em_vez_de_travessao(self):
        r = parse_preco('De: R$ 189,90 - 42%Por: R$ 110,00')
        self.assertEqual(r['desconto'], 42)

    def test_texto_sem_preco_retorna_none(self):
        self.assertIsNone(parse_preco('KAIAK AVENTURA 100 ml'))

    def test_texto_vazio_retorna_none(self):
        self.assertIsNone(parse_preco(''))


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Rodar: `python -m unittest ferramentas.testes.test_parser_preco -v`
Esperado: FAIL com `ModuleNotFoundError: No module named 'parser_preco'`

- [ ] **Step 4: Escrever a implementação mínima**

Criar `ferramentas/parser_preco.py`:

```python
"""Converte os blocos de preco do catalogo Word em numeros."""
import re

RE_DE = re.compile(r'De\s*:?\s*(?:R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})', re.I)
RE_POR = re.compile(r'Por\s*:?\s*(?:R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})', re.I)
RE_DESCONTO = re.compile(r'[\u2013\u2014\-]\s*(\d{1,3})\s*%')
RE_CADA = re.compile(r'\bcada\b', re.I)


def _numero(texto):
    """'1.299,90' -> 1299.90"""
    return float(texto.replace('.', '').replace(',', '.'))


def parse_preco(texto):
    """Extrai preco de tabela, desconto e preco final.

    Retorna None se o texto nao contiver nenhum valor monetario.
    """
    if not texto:
        return None

    m_de = RE_DE.search(texto)
    m_por = RE_POR.search(texto)
    if not m_de and not m_por:
        return None

    m_desc = RE_DESCONTO.search(texto)
    return {
        'preco_de': _numero(m_de.group(1)) if m_de else None,
        'desconto': int(m_desc.group(1)) if m_desc else None,
        'preco_por': _numero(m_por.group(1)) if m_por else None,
        'cada': bool(RE_CADA.search(texto)),
    }
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Rodar: `python -m unittest ferramentas.testes.test_parser_preco -v`
Esperado: PASS, 10 testes

- [ ] **Step 6: Commit**

```bash
git add ferramentas/parser_preco.py ferramentas/testes/
git commit -m "feat: parser dos blocos de preco do catalogo Word"
```

---

### Task 2: Parser de nome, tamanho e descrição

**Files:**
- Create: `ferramentas/parser_produto.py`
- Test: `ferramentas/testes/test_parser_produto.py`

**Interfaces:**
- Consumes: nada.
- Produces: `parse_produto(texto: str) -> dict`. Retorna `{'nome': str, 'tamanho': str|None, 'descricao': str|None, 'confianca': 'alta'|'baixa'}`.

As caixas de texto do Word concatenam nome, tamanho e descrição sem separador (`'KAIAK AVENTURA100 mlFloral aquoso.'`). O tamanho é a âncora mais confiável para separar. Quando não há tamanho, a separação usa a transição de um bloco em CAIXA ALTA para texto normal, e o resultado é marcado como `confianca: 'baixa'` para conferência manual.

- [ ] **Step 1: Escrever o teste que falha**

Criar `ferramentas/testes/test_parser_produto.py`:

```python
import unittest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from parser_produto import parse_produto


class TestParseProduto(unittest.TestCase):

    def test_nome_tamanho_descricao_colados(self):
        r = parse_produto('KAIAK AVENTURA100 mlFloral aquoso. Notas aquosas e verdes.')
        self.assertEqual(r['nome'], 'KAIAK AVENTURA')
        self.assertEqual(r['tamanho'], '100 ml')
        self.assertEqual(r['descricao'], 'Floral aquoso. Notas aquosas e verdes.')
        self.assertEqual(r['confianca'], 'alta')

    def test_com_espacos_normais(self):
        r = parse_produto('KRISKA FLORES 100 ml Adocicado frutal')
        self.assertEqual(r['nome'], 'KRISKA FLORES')
        self.assertEqual(r['tamanho'], '100 ml')
        self.assertEqual(r['descricao'], 'Adocicado frutal')

    def test_tamanho_em_gramas_com_virgula(self):
        r = parse_produto('Batom Cremoso Intense 3,8g O Boticario')
        self.assertEqual(r['tamanho'], '3,8 g')
        self.assertEqual(r['nome'], 'Batom Cremoso Intense')

    def test_tamanho_sem_espaco_antes_da_unidade(self):
        r = parse_produto('HUMOR PROPRIO 75mlAdocicado moderado.')
        self.assertEqual(r['tamanho'], '75 ml')
        self.assertEqual(r['nome'], 'HUMOR PROPRIO')

    def test_sem_tamanho_usa_transicao_de_caixa_alta(self):
        r = parse_produto('TRADICIONALChipre Frutal moderado')
        self.assertEqual(r['nome'], 'TRADICIONAL')
        self.assertEqual(r['descricao'], 'Chipre Frutal moderado')
        self.assertEqual(r['confianca'], 'baixa')

    def test_so_nome_sem_descricao(self):
        r = parse_produto('PALO SANTO')
        self.assertEqual(r['nome'], 'PALO SANTO')
        self.assertIsNone(r['tamanho'])
        self.assertIsNone(r['descricao'])

    def test_texto_ambiguo_marca_confianca_baixa(self):
        r = parse_produto('ALRA ALBAO mais puro oleo natural da Rosa Alba')
        self.assertEqual(r['confianca'], 'baixa')
        self.assertTrue(len(r['nome']) > 0)

    def test_espacos_extras_sao_normalizados(self):
        r = parse_produto('  KAIAK   AERO  100 ml   Aromatico  ')
        self.assertEqual(r['nome'], 'KAIAK AERO')
        self.assertEqual(r['descricao'], 'Aromatico')

    def test_texto_vazio(self):
        r = parse_produto('')
        self.assertEqual(r['nome'], '')
        self.assertEqual(r['confianca'], 'baixa')


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rodar: `python -m unittest ferramentas.testes.test_parser_produto -v`
Esperado: FAIL com `ModuleNotFoundError: No module named 'parser_produto'`

- [ ] **Step 3: Escrever a implementação mínima**

Criar `ferramentas/parser_produto.py`:

```python
"""Separa nome, tamanho e descricao das caixas de texto do catalogo."""
import re

RE_TAMANHO = re.compile(
    r'(\d{1,4}(?:,\d{1,2})?)\s*(ml|g|kg|un|unidades?)\b', re.I)
RE_TRANSICAO = re.compile(r'^([A-Z\u00c0-\u00dc0-9][A-Z\u00c0-\u00dc0-9\s\.\-]{2,}?)(?=[A-Z\u00c0-\u00dc][a-z\u00e0-\u00fc])')


def _limpar(t):
    return re.sub(r'\s+', ' ', t or '').strip()


def parse_produto(texto):
    """Retorna nome, tamanho, descricao e um grau de confianca."""
    texto = _limpar(texto)
    if not texto:
        return {'nome': '', 'tamanho': None, 'descricao': None,
                'confianca': 'baixa'}

    m = RE_TAMANHO.search(texto)
    if m:
        nome = _limpar(texto[:m.start()])
        descricao = _limpar(texto[m.end():]) or None
        tamanho = '{} {}'.format(m.group(1), m.group(2).lower())
        return {'nome': nome, 'tamanho': tamanho, 'descricao': descricao,
                'confianca': 'alta' if nome else 'baixa'}

    m = RE_TRANSICAO.match(texto)
    if m:
        nome = _limpar(m.group(1))
        descricao = _limpar(texto[m.end():]) or None
        return {'nome': nome, 'tamanho': None, 'descricao': descricao,
                'confianca': 'baixa'}

    # Sem tamanho e sem transicao de caixa, so confiamos em rotulos curtos.
    # Texto corrido significa que nome e descricao ficaram grudados.
    curto = len(texto) <= 40 and len(texto.split()) <= 5
    return {'nome': texto, 'tamanho': None, 'descricao': None,
            'confianca': 'alta' if curto else 'baixa'}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Rodar: `python -m unittest ferramentas.testes.test_parser_produto -v`
Esperado: PASS, 9 testes

- [ ] **Step 5: Commit**

```bash
git add ferramentas/parser_produto.py ferramentas/testes/test_parser_produto.py
git commit -m "feat: parser de nome, tamanho e descricao dos produtos"
```

---

### Task 3: Leitor do .docx

**Files:**
- Create: `ferramentas/docx_leitor.py`
- Test: `ferramentas/testes/test_docx_leitor.py`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `remover_fallback(xml: str) -> str` — remove os blocos `<mc:Fallback>`, que são cópias duplicadas do conteúdo.
  - `ler_tokens(caminho_docx: str) -> list[dict]` — cada token é `{'tipo': 'img'|'txt', 'valor': str, 'offset': int, 'pagina': int, 'x': int|None, 'y': int|None, 'largura': int|None, 'altura': int|None}`, em ordem documental. Para `tipo == 'img'`, `valor` é o caminho interno (`media/image29.png`).

O Word grava cada elemento duas vezes, dentro de `<mc:Choice>` e `<mc:Fallback>`. Remover os blocos `Fallback` antes de qualquer análise elimina a duplicação na origem, o que é mais confiável do que deduplicar por comparação de texto.

- [ ] **Step 1: Escrever o teste que falha**

Criar `ferramentas/testes/test_docx_leitor.py`:

```python
import unittest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from docx_leitor import remover_fallback, extrair_tokens_do_xml


class TestRemoverFallback(unittest.TestCase):

    def test_remove_bloco_fallback(self):
        xml = ('<a><mc:AlternateContent><mc:Choice><w:t>bom</w:t></mc:Choice>'
               '<mc:Fallback><w:t>bom</w:t></mc:Fallback>'
               '</mc:AlternateContent></a>')
        r = remover_fallback(xml)
        self.assertIn('bom', r)
        self.assertEqual(r.count('bom'), 1)

    def test_remove_multiplos_fallbacks(self):
        xml = ('<mc:Fallback>a</mc:Fallback>x<mc:Fallback>b</mc:Fallback>')
        self.assertEqual(remover_fallback(xml), 'x')

    def test_xml_sem_fallback_fica_intacto(self):
        xml = '<w:t>oi</w:t>'
        self.assertEqual(remover_fallback(xml), xml)


class TestExtrairTokens(unittest.TestCase):

    def _xml(self):
        return (
            '<w:document>'
            '<wp:anchor><wp:positionH><wp:posOffset>1000</wp:posOffset></wp:positionH>'
            '<wp:positionV><wp:posOffset>2000</wp:posOffset></wp:positionV>'
            '<wp:extent cx="500000" cy="400000"/>'
            '<a:blip r:embed="rId5"/></wp:anchor>'
            '<w:txbxContent><w:p><w:r><w:t>KAIAK</w:t></w:r>'
            '<w:r><w:t> AERO</w:t></w:r></w:p></w:txbxContent>'
            '<w:lastRenderedPageBreak/>'
            '<w:txbxContent><w:p><w:t>Por: R$ 20,00</w:t></w:p></w:txbxContent>'
            '</w:document>')

    def test_retorna_tokens_em_ordem(self):
        t = extrair_tokens_do_xml(self._xml(), {'rId5': 'media/image1.png'})
        self.assertEqual([x['tipo'] for x in t], ['img', 'txt', 'txt'])

    def test_imagem_traz_caminho_e_coordenadas(self):
        t = extrair_tokens_do_xml(self._xml(), {'rId5': 'media/image1.png'})
        img = t[0]
        self.assertEqual(img['valor'], 'media/image1.png')
        self.assertEqual(img['x'], 1000)
        self.assertEqual(img['y'], 2000)
        self.assertEqual(img['largura'], 500000)
        self.assertEqual(img['altura'], 400000)

    def test_runs_do_mesmo_paragrafo_sao_concatenados(self):
        t = extrair_tokens_do_xml(self._xml(), {'rId5': 'media/image1.png'})
        self.assertEqual(t[1]['valor'], 'KAIAK AERO')

    def test_pagina_incrementa_na_quebra(self):
        t = extrair_tokens_do_xml(self._xml(), {'rId5': 'media/image1.png'})
        self.assertEqual(t[1]['pagina'], 1)
        self.assertEqual(t[2]['pagina'], 2)

    def test_caixa_de_texto_vazia_e_ignorada(self):
        xml = '<w:document><w:txbxContent><w:p><w:t>  </w:t></w:p></w:txbxContent></w:document>'
        self.assertEqual(extrair_tokens_do_xml(xml, {}), [])


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rodar: `python -m unittest ferramentas.testes.test_docx_leitor -v`
Esperado: FAIL com `ModuleNotFoundError: No module named 'docx_leitor'`

- [ ] **Step 3: Escrever a implementação mínima**

Criar `ferramentas/docx_leitor.py`:

```python
"""Le um .docx e devolve imagens e caixas de texto em ordem documental."""
import re
import zipfile

RE_FALLBACK = re.compile(r'<mc:Fallback>.*?</mc:Fallback>', re.S)
RE_REL = re.compile(r'Id="([^"]+)"[^>]*Target="(media/[^"]+)"')
RE_EMBED = re.compile(r'r:embed="([^"]+)"')
RE_TXBX = re.compile(r'<w:txbxContent>(.*?)</w:txbxContent>', re.S)
RE_TEXTO = re.compile(r'<w:t[^>]*>([^<]*)</w:t>')
RE_QUEBRA = re.compile(r'lastRenderedPageBreak')
RE_ANCHOR = re.compile(r'<wp:anchor\b', re.S)
RE_POS_H = re.compile(r'<wp:positionH.*?<wp:posOffset>(-?\d+)</wp:posOffset>', re.S)
RE_POS_V = re.compile(r'<wp:positionV.*?<wp:posOffset>(-?\d+)</wp:posOffset>', re.S)
RE_EXTENT = re.compile(r'<wp:extent\s+cx="(\d+)"\s+cy="(\d+)"')


def remover_fallback(xml):
    """Remove os blocos mc:Fallback, que duplicam todo o conteudo."""
    return RE_FALLBACK.sub('', xml)


def _pagina_ate(xml, posicao):
    return 1 + len(RE_QUEBRA.findall(xml, 0, posicao))


def _geometria(xml, posicao_embed):
    """Procura o wp:anchor que envolve a imagem e le suas coordenadas."""
    inicio = xml.rfind('<wp:anchor', 0, posicao_embed)
    if inicio == -1:
        return {'x': None, 'y': None, 'largura': None, 'altura': None}
    trecho = xml[inicio:posicao_embed + 200]
    h = RE_POS_H.search(trecho)
    v = RE_POS_V.search(trecho)
    e = RE_EXTENT.search(trecho)
    return {
        'x': int(h.group(1)) if h else None,
        'y': int(v.group(1)) if v else None,
        'largura': int(e.group(1)) if e else None,
        'altura': int(e.group(2)) if e else None,
    }


def extrair_tokens_do_xml(xml, mapa_rels):
    """Devolve tokens de imagem e texto ordenados pela posicao no XML."""
    tokens = []

    for m in RE_EMBED.finditer(xml):
        geo = _geometria(xml, m.start())
        tokens.append({
            'tipo': 'img',
            'valor': mapa_rels.get(m.group(1), m.group(1)),
            'offset': m.start(),
            'pagina': _pagina_ate(xml, m.start()),
            **geo,
        })

    for m in RE_TXBX.finditer(xml):
        texto = re.sub(r'\s+', ' ', ''.join(RE_TEXTO.findall(m.group(1)))).strip()
        if not texto:
            continue
        geo = _geometria(xml, m.start())
        tokens.append({
            'tipo': 'txt',
            'valor': texto,
            'offset': m.start(),
            'pagina': _pagina_ate(xml, m.start()),
            **geo,
        })

    tokens.sort(key=lambda t: t['offset'])
    return tokens


def ler_tokens(caminho_docx):
    """Abre o .docx e devolve todos os tokens em ordem documental."""
    with zipfile.ZipFile(caminho_docx) as z:
        rels = z.read('word/_rels/document.xml.rels').decode('utf8')
        xml = z.read('word/document.xml').decode('utf8')
    mapa = dict(RE_REL.findall(rels))
    return extrair_tokens_do_xml(remover_fallback(xml), mapa)
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Rodar: `python -m unittest ferramentas.testes.test_docx_leitor -v`
Esperado: PASS, 8 testes

- [ ] **Step 5: Verificar contra o documento real**

Rodar:

```bash
python -c "from ferramentas.docx_leitor import ler_tokens; t=ler_tokens(r'C:\Users\David\Downloads\Agosto 2026_Nosso_Elo.docx'); print('tokens:',len(t)); print('imgs:',sum(1 for x in t if x['tipo']=='img')); print('txts:',sum(1 for x in t if x['tipo']=='txt')); print('paginas:',max(x['pagina'] for x in t))"
```

Esperado: em torno de 1.100 imagens e 900 a 1.300 textos, e cerca de 72 páginas. Após remover os `Fallback`, a contagem de textos deve cair aproximadamente pela metade em relação às 2.032 caixas brutas. Se o número de imagens vier abaixo de 700, a remoção de `Fallback` está descartando conteúdo legítimo — investigar antes de seguir.

- [ ] **Step 6: Commit**

```bash
git add ferramentas/docx_leitor.py ferramentas/testes/test_docx_leitor.py
git commit -m "feat: leitor de docx com ordem documental e coordenadas"
```

---

### Task 4: Extração e conversão de imagens

**Files:**
- Create: `ferramentas/imagens.py`
- Test: `ferramentas/testes/test_imagens.py`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `converter_webp(dados: bytes, destino: str, lado_max: int = 800, qualidade: int = 82) -> bool` — grava o WebP e retorna `True`, ou `False` se a imagem não puder ser lida.
  - `extrair_imagens(caminho_docx: str, pasta_destino: str) -> dict[str, str]` — mapeia `'media/image29.png'` para o nome do arquivo gravado (`'image29.webp'`). Arquivos `.wdp` são ignorados.

- [ ] **Step 1: Escrever o teste que falha**

Criar `ferramentas/testes/test_imagens.py`:

```python
import unittest, tempfile, os, io, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from PIL import Image
from imagens import converter_webp


def _png(largura, altura):
    buf = io.BytesIO()
    Image.new('RGB', (largura, altura), (200, 100, 50)).save(buf, 'PNG')
    return buf.getvalue()


class TestConverterWebp(unittest.TestCase):

    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def test_gera_arquivo_webp(self):
        destino = os.path.join(self.dir, 'a.webp')
        self.assertTrue(converter_webp(_png(100, 100), destino))
        self.assertTrue(os.path.exists(destino))
        self.assertEqual(Image.open(destino).format, 'WEBP')

    def test_redimensiona_lado_maior_para_800(self):
        destino = os.path.join(self.dir, 'b.webp')
        converter_webp(_png(2000, 1000), destino)
        self.assertEqual(Image.open(destino).size, (800, 400))

    def test_imagem_pequena_nao_e_ampliada(self):
        destino = os.path.join(self.dir, 'c.webp')
        converter_webp(_png(300, 200), destino)
        self.assertEqual(Image.open(destino).size, (300, 200))

    def test_preserva_transparencia(self):
        buf = io.BytesIO()
        Image.new('RGBA', (50, 50), (0, 0, 0, 0)).save(buf, 'PNG')
        destino = os.path.join(self.dir, 'd.webp')
        converter_webp(buf.getvalue(), destino)
        self.assertEqual(Image.open(destino).mode, 'RGBA')

    def test_dados_invalidos_retornam_false(self):
        destino = os.path.join(self.dir, 'e.webp')
        self.assertFalse(converter_webp(b'nao sou imagem', destino))
        self.assertFalse(os.path.exists(destino))


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rodar: `python -m unittest ferramentas.testes.test_imagens -v`
Esperado: FAIL com `ModuleNotFoundError: No module named 'imagens'`

- [ ] **Step 3: Escrever a implementação mínima**

Criar `ferramentas/imagens.py`:

```python
"""Extrai as imagens do .docx e converte para WebP."""
import io
import os
import zipfile
from PIL import Image

EXTENSOES_IGNORADAS = {'.wdp', '.emf', '.wmf'}


def converter_webp(dados, destino, lado_max=800, qualidade=82):
    """Grava os bytes recebidos como WebP redimensionado. False se falhar."""
    try:
        img = Image.open(io.BytesIO(dados))
        img.load()
    except Exception:
        return False

    if img.mode not in ('RGB', 'RGBA'):
        img = img.convert('RGBA' if 'A' in img.getbands() else 'RGB')

    maior = max(img.size)
    if maior > lado_max:
        escala = lado_max / maior
        novo = (round(img.width * escala), round(img.height * escala))
        img = img.resize(novo, Image.LANCZOS)

    os.makedirs(os.path.dirname(destino), exist_ok=True)
    img.save(destino, 'WEBP', quality=qualidade, method=6)
    return True


def extrair_imagens(caminho_docx, pasta_destino):
    """Converte toda a midia do .docx. Retorna mapa origem -> arquivo gerado."""
    mapa = {}
    with zipfile.ZipFile(caminho_docx) as z:
        for nome in z.namelist():
            if not nome.startswith('word/media/'):
                continue
            base = os.path.basename(nome)
            raiz, ext = os.path.splitext(base)
            if ext.lower() in EXTENSOES_IGNORADAS:
                continue
            saida = os.path.join(pasta_destino, raiz + '.webp')
            if converter_webp(z.read(nome), saida):
                mapa['media/' + base] = raiz + '.webp'
    return mapa
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Rodar: `python -m unittest ferramentas.testes.test_imagens -v`
Esperado: PASS, 5 testes

- [ ] **Step 5: Rodar contra o documento real e conferir a redução de peso**

```bash
python -c "from ferramentas.imagens import extrair_imagens; m=extrair_imagens(r'C:\Users\David\Downloads\Agosto 2026_Nosso_Elo.docx','ferramentas/saida/img'); print('convertidas:',len(m))"
du -sh ferramentas/saida/img
```

Esperado: cerca de 1.094 imagens convertidas (1.146 menos os 52 arquivos `.wdp`) e pasta total abaixo de 15MB, contra os 72,1MB originais.

- [ ] **Step 6: Commit**

```bash
git add ferramentas/imagens.py ferramentas/testes/test_imagens.py
git commit -m "feat: extracao e conversao das imagens para WebP"
```

---

### Task 5: Pareador de imagem e produto

**Files:**
- Create: `ferramentas/pareador.py`
- Test: `ferramentas/testes/test_pareador.py`

**Interfaces:**
- Consumes: tokens de `docx_leitor.ler_tokens`.
- Produces: `parear(tokens: list[dict]) -> list[dict]`. Cada resultado é `{'nome_token': dict, 'imagem': str|None, 'distancia': int|None, 'confianca': 'alta'|'baixa'}`.

Regra: para cada token de texto, considera as imagens da mesma página cujo topo esteja acima do texto, escolhendo a de menor distância vertical com sobreposição horizontal. Uma imagem só pode ser usada por um produto. Quando não há imagem elegível na página, ou quando a distância excede 1.500.000 EMU (aproximadamente 4 cm), o resultado sai com `confianca: 'baixa'`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `ferramentas/testes/test_pareador.py`:

```python
import unittest, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pareador import parear


def img(nome, pagina, x, y, largura=500000, altura=500000, offset=0):
    return {'tipo': 'img', 'valor': nome, 'pagina': pagina, 'x': x, 'y': y,
            'largura': largura, 'altura': altura, 'offset': offset}


def txt(valor, pagina, x, y, offset=0):
    return {'tipo': 'txt', 'valor': valor, 'pagina': pagina, 'x': x, 'y': y,
            'largura': 500000, 'altura': 200000, 'offset': offset}


class TestParear(unittest.TestCase):

    def test_associa_imagem_logo_acima(self):
        t = [img('a.webp', 1, 0, 0), txt('KAIAK', 1, 0, 600000)]
        r = parear(t)
        self.assertEqual(r[0]['imagem'], 'a.webp')
        self.assertEqual(r[0]['confianca'], 'alta')

    def test_escolhe_a_imagem_mais_proxima(self):
        t = [img('longe.webp', 1, 0, 0), img('perto.webp', 1, 0, 500000),
             txt('KAIAK', 1, 0, 1100000)]
        self.assertEqual(parear(t)[0]['imagem'], 'perto.webp')

    def test_ignora_imagem_de_outra_pagina(self):
        t = [img('outra.webp', 1, 0, 0), txt('KAIAK', 2, 0, 600000)]
        r = parear(t)
        self.assertIsNone(r[0]['imagem'])
        self.assertEqual(r[0]['confianca'], 'baixa')

    def test_ignora_imagem_abaixo_do_texto(self):
        t = [txt('KAIAK', 1, 0, 0), img('abaixo.webp', 1, 0, 900000)]
        self.assertIsNone(parear(t)[0]['imagem'])

    def test_exige_sobreposicao_horizontal(self):
        t = [img('lado.webp', 1, 5000000, 0), txt('KAIAK', 1, 0, 600000)]
        self.assertIsNone(parear(t)[0]['imagem'])

    def test_uma_imagem_nao_serve_dois_produtos(self):
        t = [img('a.webp', 1, 0, 0), txt('KAIAK', 1, 0, 600000),
             txt('HUMOR', 1, 0, 700000)]
        usados = [x['imagem'] for x in parear(t)]
        self.assertEqual(usados.count('a.webp'), 1)

    def test_distancia_grande_reduz_confianca(self):
        t = [img('a.webp', 1, 0, 0), txt('KAIAK', 1, 0, 9000000)]
        r = parear(t)
        self.assertEqual(r[0]['confianca'], 'baixa')

    def test_texto_sem_coordenada_sai_com_confianca_baixa(self):
        t = [img('a.webp', 1, 0, 0),
             {'tipo': 'txt', 'valor': 'X', 'pagina': 1, 'x': None, 'y': None,
              'largura': None, 'altura': None, 'offset': 0}]
        self.assertEqual(parear(t)[0]['confianca'], 'baixa')


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rodar: `python -m unittest ferramentas.testes.test_pareador -v`
Esperado: FAIL com `ModuleNotFoundError: No module named 'pareador'`

- [ ] **Step 3: Escrever a implementação mínima**

Criar `ferramentas/pareador.py`:

```python
"""Associa cada caixa de texto de produto a imagem que aparece acima dela."""

DISTANCIA_MAXIMA = 1500000  # EMU, cerca de 4 cm


def _sobrepoe_horizontal(a, b):
    a_fim = a['x'] + (a['largura'] or 0)
    b_fim = b['x'] + (b['largura'] or 0)
    return a['x'] < b_fim and b['x'] < a_fim


def parear(tokens):
    """Para cada token de texto, escolhe a imagem elegivel mais proxima."""
    imagens = [t for t in tokens if t['tipo'] == 'img'
               and t['x'] is not None and t['y'] is not None]
    textos = [t for t in tokens if t['tipo'] == 'txt']
    usadas = set()
    resultado = []

    for texto in textos:
        if texto['x'] is None or texto['y'] is None:
            resultado.append({'nome_token': texto, 'imagem': None,
                              'distancia': None, 'confianca': 'baixa'})
            continue

        melhor = None
        melhor_dist = None
        for im in imagens:
            if im['valor'] in usadas:
                continue
            if im['pagina'] != texto['pagina']:
                continue
            base_img = im['y'] + (im['altura'] or 0)
            if base_img > texto['y']:
                continue
            if not _sobrepoe_horizontal(im, texto):
                continue
            dist = texto['y'] - base_img
            if melhor_dist is None or dist < melhor_dist:
                melhor, melhor_dist = im, dist

        if melhor is None:
            resultado.append({'nome_token': texto, 'imagem': None,
                              'distancia': None, 'confianca': 'baixa'})
            continue

        usadas.add(melhor['valor'])
        resultado.append({
            'nome_token': texto,
            'imagem': melhor['valor'],
            'distancia': melhor_dist,
            'confianca': 'alta' if melhor_dist <= DISTANCIA_MAXIMA else 'baixa',
        })

    return resultado
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Rodar: `python -m unittest ferramentas.testes.test_pareador -v`
Esperado: PASS, 8 testes

- [ ] **Step 5: Commit**

```bash
git add ferramentas/pareador.py ferramentas/testes/test_pareador.py
git commit -m "feat: pareamento de imagem e produto por coordenada"
```

---

### Task 6: Orquestrador e geração do CSV

**Files:**
- Create: `ferramentas/extrair.py`

**Interfaces:**
- Consumes: `parse_preco`, `parse_produto`, `ler_tokens`, `extrair_imagens`, `parear`.
- Produces: dois arquivos em `ferramentas/saida/` — `produtos.csv` com as colunas do spec, e `conferir.csv` com as linhas de confiança baixa que precisam de revisão manual.

Um bloco de preço vale para o grupo de produtos que o antecede desde o preço anterior. O orquestrador percorre os tokens em ordem, acumula nomes de produto e, ao encontrar um preço, aplica-o a todos os nomes acumulados.

- [ ] **Step 1: Escrever o orquestrador**

Criar `ferramentas/extrair.py`:

```python
"""Converte o catalogo Word em produtos.csv e conferir.csv."""
import csv
import os
import re
import sys
import unicodedata

from docx_leitor import ler_tokens
from imagens import extrair_imagens
from pareador import parear
from parser_preco import parse_preco
from parser_produto import parse_produto

PASTA_SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'saida')
COLUNAS = ['id', 'ativo', 'marca', 'categoria', 'nome', 'tamanho',
           'descricao', 'preco_de', 'desconto', 'preco_por', 'imagem',
           'destaque']

MARCAS = ['Natura', 'O Boticario', 'Boticario', 'Avon', 'Eudora',
          'Arabes', 'Capilar']


def gerar_id(nome, tamanho, usados):
    """Cria um id unico, minusculo e sem acento."""
    base = '{} {}'.format(nome, tamanho or '')
    base = unicodedata.normalize('NFD', base)
    base = ''.join(c for c in base if unicodedata.category(c) != 'Mn')
    base = re.sub(r'[^a-zA-Z0-9]+', '-', base).strip('-').lower() or 'produto'
    candidato, n = base, 2
    while candidato in usados:
        candidato = '{}-{}'.format(base, n)
        n += 1
    usados.add(candidato)
    return candidato


def e_cabecalho(texto):
    """Cabecalhos de secao sao curtos e batem com uma marca conhecida."""
    if len(texto) > 40:
        return False
    return any(m.lower() in texto.lower() for m in MARCAS)


def main(caminho_docx):
    os.makedirs(PASTA_SAIDA, exist_ok=True)

    print('Extraindo imagens...')
    mapa_img = extrair_imagens(caminho_docx, os.path.join(PASTA_SAIDA, 'img'))
    print('  {} imagens convertidas'.format(len(mapa_img)))

    print('Lendo o documento...')
    tokens = ler_tokens(caminho_docx)
    pares = {id(p['nome_token']): p for p in parear(tokens)}

    linhas, conferir, usados = [], [], set()
    marca_atual, categoria_atual = '', ''
    pendentes = []

    for token in tokens:
        if token['tipo'] != 'txt':
            continue
        texto = token['valor']

        if texto.strip().upper() == 'ESGOTADO':
            for p in pendentes:
                p['ativo'] = 'nao'
            continue

        preco = parse_preco(texto)
        if preco:
            for p in pendentes:
                p['preco_de'] = preco['preco_de'] or ''
                p['desconto'] = preco['desconto'] or ''
                p['preco_por'] = preco['preco_por'] or ''
            pendentes = []
            continue

        if e_cabecalho(texto):
            if any(m.lower() in texto.lower() for m in MARCAS):
                marca_atual = texto.strip()
            else:
                categoria_atual = texto.strip()
            continue

        produto = parse_produto(texto)
        if not produto['nome']:
            continue

        par = pares.get(id(token), {})
        arquivo = mapa_img.get(par.get('imagem') or '', '')

        linha = {
            'id': gerar_id(produto['nome'], produto['tamanho'], usados),
            'ativo': 'sim',
            'marca': marca_atual,
            'categoria': categoria_atual,
            'nome': produto['nome'],
            'tamanho': produto['tamanho'] or '',
            'descricao': produto['descricao'] or '',
            'preco_de': '', 'desconto': '', 'preco_por': '',
            'imagem': arquivo,
            'destaque': 'nao',
        }
        linhas.append(linha)
        pendentes.append(linha)

        if (produto['confianca'] == 'baixa'
                or par.get('confianca') == 'baixa' or not arquivo):
            conferir.append({**linha, 'motivo': 'texto={} imagem={}'.format(
                produto['confianca'], par.get('confianca', 'sem par'))})

    sem_preco = [l for l in linhas if not l['preco_por']]
    for l in sem_preco:
        if l not in conferir:
            conferir.append({**l, 'motivo': 'sem preco'})

    with open(os.path.join(PASTA_SAIDA, 'produtos.csv'), 'w',
              newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=COLUNAS)
        w.writeheader()
        w.writerows(linhas)

    with open(os.path.join(PASTA_SAIDA, 'conferir.csv'), 'w',
              newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=COLUNAS + ['motivo'])
        w.writeheader()
        w.writerows(conferir)

    print('\nprodutos.csv: {} linhas'.format(len(linhas)))
    print('conferir.csv: {} linhas ({:.0f}% do total)'.format(
        len(conferir), 100 * len(conferir) / max(len(linhas), 1)))
    print('sem preco: {}'.format(len(sem_preco)))
    print('sem imagem: {}'.format(sum(1 for l in linhas if not l['imagem'])))


if __name__ == '__main__':
    main(sys.argv[1])
```

- [ ] **Step 2: Rodar contra o documento real**

```bash
python ferramentas/extrair.py "C:/Users/David/Downloads/Agosto 2026_Nosso_Elo.docx"
```

Esperado: `produtos.csv` com algo entre 400 e 900 linhas. É normal `conferir.csv` conter 30% a 50% das linhas — esse arquivo é justamente a fila de revisão manual, não um defeito.

- [ ] **Step 3: Conferir a saída manualmente**

Abrir `ferramentas/saida/produtos.csv` no Excel e verificar dez linhas contra o PDF original. Confirmar que nome, preço e imagem batem. Se mais de três das dez estiverem erradas, ajustar `DISTANCIA_MAXIMA` em `pareador.py` ou as regras de `e_cabecalho` antes de prosseguir.

- [ ] **Step 4: Commit**

```bash
git add ferramentas/extrair.py
git commit -m "feat: orquestrador da migracao gerando produtos.csv e conferir.csv"
```

---

## FASE 2 — Site

### Task 7: Configuração e parser de CSV

**Files:**
- Create: `site/js/config.js`
- Create: `site/js/csv.js`
- Test: `testes-site/test_csv.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `config.js` exporta `URL_PLANILHA`, `WHATSAPP`, `CACHE_MS`, `CHAVE_CARRINHO`, `LIMITE_MENSAGEM`.
  - `csv.js` exporta `parseCSV(texto: string) -> Array<Object>`, usando a primeira linha como cabeçalho.

- [ ] **Step 1: Escrever o teste que falha**

Criar `testes-site/test_csv.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from '../site/js/csv.js';

test('converte linhas em objetos usando o cabecalho', () => {
  const r = parseCSV('nome,preco\nKaiak,110\nHumor,75');
  assert.deepEqual(r, [
    { nome: 'Kaiak', preco: '110' },
    { nome: 'Humor', preco: '75' },
  ]);
});

test('respeita virgula dentro de aspas', () => {
  const r = parseCSV('nome,descricao\nKaiak,"Citrico, floral"');
  assert.equal(r[0].descricao, 'Citrico, floral');
});

test('respeita quebra de linha dentro de aspas', () => {
  const r = parseCSV('nome,descricao\nKaiak,"linha1\nlinha2"');
  assert.equal(r[0].descricao, 'linha1\nlinha2');
});

test('aspas duplas escapadas viram uma aspa', () => {
  const r = parseCSV('nome\n"Diz ""oi"""');
  assert.equal(r[0].nome, 'Diz "oi"');
});

test('ignora o BOM do Excel', () => {
  const r = parseCSV('\uFEFFnome\nKaiak');
  assert.equal(r[0].nome, 'Kaiak');
});

test('aceita quebra de linha estilo Windows', () => {
  const r = parseCSV('nome\r\nKaiak\r\n');
  assert.equal(r.length, 1);
  assert.equal(r[0].nome, 'Kaiak');
});

test('linha com menos colunas preenche com string vazia', () => {
  const r = parseCSV('a,b,c\n1,2');
  assert.equal(r[0].c, '');
});

test('texto vazio retorna lista vazia', () => {
  assert.deepEqual(parseCSV(''), []);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rodar: `node --test testes-site/test_csv.js`
Esperado: FAIL com `Cannot find module` apontando para `site/js/csv.js`

- [ ] **Step 3: Escrever a implementação mínima**

Criar `site/js/config.js`:

```javascript
// Trocar URL_PLANILHA pelo link "Publicar na web" da planilha, formato CSV.
export const URL_PLANILHA = 'SUBSTITUIR_NA_TASK_14';
export const WHATSAPP = '5573981139437';
export const CACHE_MS = 10 * 60 * 1000;
export const CHAVE_CARRINHO = 'nossoelo_carrinho_v1';
export const CHAVE_CACHE = 'nossoelo_cache_v1';
export const LIMITE_MENSAGEM = 1800;
```

Criar `site/js/csv.js`:

```javascript
/** Converte texto CSV em lista de objetos, usando a primeira linha como cabecalho. */
export function parseCSV(texto) {
  if (!texto) return [];
  const limpo = texto.replace(/^\uFEFF/, '');
  const linhas = [];
  let campo = '';
  let linha = [];
  let dentroDeAspas = false;

  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') { campo += '"'; i++; }
        else dentroDeAspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { dentroDeAspas = true; continue; }
    if (c === ',') { linha.push(campo); campo = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { linha.push(campo); linhas.push(linha); campo = ''; linha = []; continue; }
    campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }

  if (!linhas.length) return [];
  const cabecalho = linhas[0].map((h) => h.trim());
  return linhas.slice(1)
    .filter((l) => l.some((v) => v.trim() !== ''))
    .map((l) => Object.fromEntries(
      cabecalho.map((h, i) => [h, (l[i] ?? '').trim()])));
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Rodar: `node --test testes-site/test_csv.js`
Esperado: PASS, 8 testes

- [ ] **Step 5: Commit**

```bash
git add site/js/config.js site/js/csv.js testes-site/test_csv.js
git commit -m "feat: parser de CSV e configuracao do site"
```

---

### Task 8: Carregador de dados

**Files:**
- Create: `site/js/dados.js`
- Test: `testes-site/test_dados.js`

**Interfaces:**
- Consumes: `parseCSV` de `csv.js`, constantes de `config.js`.
- Produces:
  - `normalizarProduto(linha: Object) -> Object|null` — devolve `{id, ativo, marca, categoria, nome, tamanho, descricao, precoDe, desconto, precoPor, imagem, destaque}` com números já convertidos, ou `null` se a linha for inválida.
  - `validarLista(linhas: Array) -> {produtos: Array, erros: Array}` — `erros` são `{linha: number, motivo: string}`.
  - `carregarProdutos(deps: Object) -> Promise<Array>` — `deps` é `{fetch, storage, agora, urlPlanilha, backup}`, permitindo teste sem navegador.

- [ ] **Step 1: Escrever o teste que falha**

Criar `testes-site/test_dados.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarProduto, validarLista, carregarProdutos } from '../site/js/dados.js';

const linhaOk = {
  id: 'kaiak-aventura-100-ml', ativo: 'sim', marca: 'Natura',
  categoria: 'Perfumaria', nome: 'Kaiak Aventura', tamanho: '100 ml',
  descricao: 'Floral', preco_de: '189,90', desconto: '42',
  preco_por: '110,00', imagem: 'kaiak.webp', destaque: 'nao',
};

function memoria(inicial = {}) {
  const dados = { ...inicial };
  return {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; },
  };
}

test('normaliza precos no formato brasileiro', () => {
  const p = normalizarProduto(linhaOk);
  assert.equal(p.precoDe, 189.9);
  assert.equal(p.precoPor, 110);
  assert.equal(p.desconto, 42);
});

test('linha sem preco_por e invalida', () => {
  assert.equal(normalizarProduto({ ...linhaOk, preco_por: '' }), null);
});

test('linha sem nome e invalida', () => {
  assert.equal(normalizarProduto({ ...linhaOk, nome: '' }), null);
});

test('desconto fora de 0 a 100 vira null sem invalidar o produto', () => {
  const p = normalizarProduto({ ...linhaOk, desconto: '150' });
  assert.equal(p.desconto, null);
  assert.equal(p.nome, 'Kaiak Aventura');
});

test('preco_de ausente vira null sem invalidar o produto', () => {
  const p = normalizarProduto({ ...linhaOk, preco_de: '' });
  assert.equal(p.precoDe, null);
  assert.equal(p.precoPor, 110);
});

test('ativo aceita variacoes de escrita', () => {
  assert.equal(normalizarProduto({ ...linhaOk, ativo: 'SIM' }).ativo, true);
  assert.equal(normalizarProduto({ ...linhaOk, ativo: 'nao' }).ativo, false);
  assert.equal(normalizarProduto({ ...linhaOk, ativo: 'não' }).ativo, false);
});

test('validarLista descarta inativos e reporta duplicados', () => {
  const r = validarLista([
    linhaOk,
    { ...linhaOk, nome: 'Outro' },
    { ...linhaOk, id: 'humor', ativo: 'nao' },
  ]);
  assert.equal(r.produtos.length, 1);
  assert.equal(r.erros.length, 1);
  assert.match(r.erros[0].motivo, /duplicad/i);
});

test('carregarProdutos busca da rede e grava no cache', async () => {
  const storage = memoria();
  const produtos = await carregarProdutos({
    fetch: async () => ({ ok: true, text: async () => 'id,ativo,nome,preco_por\nx,sim,Kaiak,"110,00"' }),
    storage, agora: () => 1000, urlPlanilha: 'http://p', backup: [],
  });
  assert.equal(produtos.length, 1);
  assert.ok(storage.getItem('nossoelo_cache_v1'));
});

test('usa o cache quando ainda esta dentro da validade', async () => {
  const storage = memoria({
    nossoelo_cache_v1: JSON.stringify({
      quando: 1000,
      produtos: [{ id: 'c', nome: 'DoCache', ativo: true, precoPor: 5 }],
    }),
  });
  let chamou = false;
  const produtos = await carregarProdutos({
    fetch: async () => { chamou = true; throw new Error('nao deveria'); },
    storage, agora: () => 2000, urlPlanilha: 'http://p', backup: [],
  });
  assert.equal(chamou, false);
  assert.equal(produtos[0].nome, 'DoCache');
});

test('cai para o cache vencido quando a rede falha', async () => {
  const storage = memoria({
    nossoelo_cache_v1: JSON.stringify({
      quando: 0,
      produtos: [{ id: 'c', nome: 'Antigo', ativo: true, precoPor: 5 }],
    }),
  });
  const produtos = await carregarProdutos({
    fetch: async () => { throw new Error('offline'); },
    storage, agora: () => 999999999, urlPlanilha: 'http://p', backup: [],
  });
  assert.equal(produtos[0].nome, 'Antigo');
});

test('cai para o backup quando nao ha rede nem cache', async () => {
  const produtos = await carregarProdutos({
    fetch: async () => { throw new Error('offline'); },
    storage: memoria(), agora: () => 1, urlPlanilha: 'http://p',
    backup: [{ id: 'b', nome: 'Backup', ativo: true, precoPor: 9 }],
  });
  assert.equal(produtos[0].nome, 'Backup');
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rodar: `node --test testes-site/test_dados.js`
Esperado: FAIL com `Cannot find module` apontando para `site/js/dados.js`

- [ ] **Step 3: Escrever a implementação mínima**

Criar `site/js/dados.js`:

```javascript
import { parseCSV } from './csv.js';
import { CACHE_MS, CHAVE_CACHE, URL_PLANILHA } from './config.js';

/** '189,90' -> 189.9; vazio ou invalido -> null. */
function numero(texto) {
  if (!texto) return null;
  const n = parseFloat(String(texto).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function verdadeiro(texto) {
  return ['sim', 's', 'true', '1'].includes(String(texto || '').trim().toLowerCase());
}

/** Converte uma linha crua da planilha. Retorna null se for invalida. */
export function normalizarProduto(linha) {
  const id = (linha.id || '').trim();
  const nome = (linha.nome || '').trim();
  const precoPor = numero(linha.preco_por);
  if (!id || !nome || precoPor === null) return null;

  let desconto = numero(linha.desconto);
  if (desconto === null || desconto < 0 || desconto > 100) desconto = null;

  return {
    id, nome, precoPor, desconto,
    ativo: verdadeiro(linha.ativo),
    marca: (linha.marca || '').trim(),
    categoria: (linha.categoria || '').trim(),
    tamanho: (linha.tamanho || '').trim(),
    descricao: (linha.descricao || '').trim(),
    precoDe: numero(linha.preco_de),
    imagem: (linha.imagem || '').trim(),
    destaque: verdadeiro(linha.destaque),
  };
}

/** Valida a planilha inteira. Devolve produtos ativos e a lista de erros. */
export function validarLista(linhas) {
  const produtos = [];
  const erros = [];
  const vistos = new Set();

  linhas.forEach((linha, i) => {
    const numeroLinha = i + 2; // +1 do cabecalho, +1 porque planilha comeca em 1
    const p = normalizarProduto(linha);
    if (!p) {
      erros.push({ linha: numeroLinha, motivo: 'faltando id, nome ou preco_por' });
      return;
    }
    if (vistos.has(p.id)) {
      erros.push({ linha: numeroLinha, motivo: `id duplicado: ${p.id}` });
      return;
    }
    vistos.add(p.id);
    if (p.ativo) produtos.push(p);
  });

  return { produtos, erros };
}

/** Busca os produtos com cache, cache vencido e backup como quedas sucessivas. */
export async function carregarProdutos(deps = {}) {
  const {
    fetch: buscar = globalThis.fetch,
    storage = globalThis.localStorage,
    agora = () => Date.now(),
    urlPlanilha = URL_PLANILHA,
    backup = [],
  } = deps;

  let cache = null;
  try {
    const bruto = storage.getItem(CHAVE_CACHE);
    if (bruto) cache = JSON.parse(bruto);
  } catch { cache = null; }

  if (cache && agora() - cache.quando < CACHE_MS) return cache.produtos;

  try {
    const resposta = await buscar(urlPlanilha);
    if (!resposta.ok) throw new Error('resposta ' + resposta.status);
    const { produtos } = validarLista(parseCSV(await resposta.text()));
    if (!produtos.length) throw new Error('planilha vazia');
    try {
      storage.setItem(CHAVE_CACHE, JSON.stringify({ quando: agora(), produtos }));
    } catch { /* cota cheia: seguir sem cache */ }
    return produtos;
  } catch {
    if (cache && cache.produtos.length) return cache.produtos;
    return backup;
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Rodar: `node --test testes-site/test_dados.js`
Esperado: PASS, 11 testes

- [ ] **Step 5: Commit**

```bash
git add site/js/dados.js testes-site/test_dados.js
git commit -m "feat: carregador de dados com cache e quedas sucessivas"
```

---

### Task 9: Carrinho

**Files:**
- Create: `site/js/carrinho.js`
- Test: `testes-site/test_carrinho.js`

**Interfaces:**
- Consumes: `WHATSAPP`, `CHAVE_CARRINHO`, `LIMITE_MENSAGEM` de `config.js`.
- Produces: classe `Carrinho`, construída como `new Carrinho(storage)`. Métodos: `adicionar(produto)`, `remover(id)`, `definirQuantidade(id, n)`, `itens()`, `total()`, `quantidadeTotal()`, `limpar()`, `reconciliar(produtos) -> Array<string>` (devolve avisos), `montarMensagem() -> string`, `linkWhatsApp() -> string`, `mensagemLonga() -> boolean`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `testes-site/test_carrinho.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Carrinho } from '../site/js/carrinho.js';

function memoria() {
  const d = {};
  return {
    getItem: (k) => (k in d ? d[k] : null),
    setItem: (k, v) => { d[k] = String(v); },
    removeItem: (k) => { delete d[k]; },
  };
}

const kaiak = { id: 'kaiak', nome: 'Kaiak Aventura', tamanho: '100 ml', precoPor: 110 };
const humor = { id: 'humor', nome: 'Humor Proprio', tamanho: '75 ml', precoPor: 75 };

test('adiciona item e calcula o total', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  assert.equal(c.total(), 110);
});

test('adicionar duas vezes aumenta a quantidade', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  c.adicionar(kaiak);
  assert.equal(c.itens().length, 1);
  assert.equal(c.itens()[0].quantidade, 2);
  assert.equal(c.total(), 220);
});

test('definirQuantidade zero remove o item', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  c.definirQuantidade('kaiak', 0);
  assert.equal(c.itens().length, 0);
});

test('quantidadeTotal soma todas as unidades', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  c.adicionar(kaiak);
  c.adicionar(humor);
  assert.equal(c.quantidadeTotal(), 3);
});

test('o carrinho sobrevive a recriacao usando o mesmo storage', () => {
  const s = memoria();
  new Carrinho(s).adicionar(kaiak);
  assert.equal(new Carrinho(s).total(), 110);
});

test('reconciliar remove produto que saiu do catalogo', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  c.adicionar(humor);
  const avisos = c.reconciliar([humor]);
  assert.equal(c.itens().length, 1);
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /Kaiak Aventura/);
});

test('reconciliar atualiza preco alterado e avisa', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  const avisos = c.reconciliar([{ ...kaiak, precoPor: 130 }]);
  assert.equal(c.total(), 130);
  assert.match(avisos[0], /pre/i);
});

test('reconciliar sem mudancas nao gera aviso', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  assert.deepEqual(c.reconciliar([kaiak]), []);
});

test('a mensagem lista itens e total', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  c.adicionar(kaiak);
  c.adicionar(humor);
  const m = c.montarMensagem();
  assert.match(m, /2x Kaiak Aventura 100 ml/);
  assert.match(m, /1x Humor Proprio 75 ml/);
  assert.match(m, /Total: R\$ 295,00/);
});

test('o link aponta para o numero configurado e vem codificado', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  const link = c.linkWhatsApp();
  assert.ok(link.startsWith('https://wa.me/5573981139437?text='));
  assert.ok(!link.includes('\n'));
});

test('mensagemLonga acusa quando passa do limite', () => {
  const c = new Carrinho(memoria());
  for (let i = 0; i < 200; i++) {
    c.adicionar({ id: 'p' + i, nome: 'Produto de nome bem comprido ' + i, tamanho: '100 ml', precoPor: 50 });
  }
  assert.equal(c.mensagemLonga(), true);
});

test('carrinho vazio tem total zero e nao quebra a mensagem', () => {
  const c = new Carrinho(memoria());
  assert.equal(c.total(), 0);
  assert.equal(typeof c.montarMensagem(), 'string');
});

test('storage com conteudo corrompido nao derruba o carrinho', () => {
  const s = memoria();
  s.setItem('nossoelo_carrinho_v1', 'isso nao e json');
  assert.equal(new Carrinho(s).itens().length, 0);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rodar: `node --test testes-site/test_carrinho.js`
Esperado: FAIL com `Cannot find module` apontando para `site/js/carrinho.js`

- [ ] **Step 3: Escrever a implementação mínima**

Criar `site/js/carrinho.js`:

```javascript
import { CHAVE_CARRINHO, LIMITE_MENSAGEM, WHATSAPP } from './config.js';

/** Formata 1234.5 como '1.234,50'. */
export function reais(valor) {
  return valor.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export class Carrinho {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this._itens = this._ler();
  }

  _ler() {
    try {
      const bruto = this.storage.getItem(CHAVE_CARRINHO);
      const dados = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(dados) ? dados : [];
    } catch {
      return [];
    }
  }

  _gravar() {
    try {
      this.storage.setItem(CHAVE_CARRINHO, JSON.stringify(this._itens));
    } catch { /* cota cheia: manter apenas em memoria */ }
  }

  itens() { return this._itens; }

  adicionar(produto, quantidade = 1) {
    const existente = this._itens.find((i) => i.id === produto.id);
    if (existente) existente.quantidade += quantidade;
    else this._itens.push({
      id: produto.id, nome: produto.nome,
      tamanho: produto.tamanho || '', precoPor: produto.precoPor,
      quantidade,
    });
    this._gravar();
  }

  remover(id) {
    this._itens = this._itens.filter((i) => i.id !== id);
    this._gravar();
  }

  definirQuantidade(id, n) {
    if (n <= 0) return this.remover(id);
    const item = this._itens.find((i) => i.id === id);
    if (item) { item.quantidade = n; this._gravar(); }
  }

  limpar() { this._itens = []; this._gravar(); }

  total() {
    return this._itens.reduce((s, i) => s + i.precoPor * i.quantidade, 0);
  }

  quantidadeTotal() {
    return this._itens.reduce((s, i) => s + i.quantidade, 0);
  }

  /** Compara com o catalogo atual. Remove sumidos, corrige precos, devolve avisos. */
  reconciliar(produtos) {
    const porId = new Map(produtos.map((p) => [p.id, p]));
    const avisos = [];
    const mantidos = [];

    for (const item of this._itens) {
      const atual = porId.get(item.id);
      if (!atual) {
        avisos.push(`${item.nome} saiu do catalogo e foi retirado do seu pedido.`);
        continue;
      }
      if (atual.precoPor !== item.precoPor) {
        avisos.push(`O preco de ${item.nome} mudou para R$ ${reais(atual.precoPor)}.`);
        item.precoPor = atual.precoPor;
      }
      mantidos.push(item);
    }

    this._itens = mantidos;
    this._gravar();
    return avisos;
  }

  montarMensagem() {
    if (!this._itens.length) return 'Ola! Gostaria de fazer um pedido.';
    const linhas = this._itens.map((i) => {
      const nome = [i.nome, i.tamanho].filter(Boolean).join(' ');
      return `${i.quantidade}x ${nome} — R$ ${reais(i.precoPor * i.quantidade)}`;
    });
    return `Ola! Quero fazer um pedido:\n\n${linhas.join('\n')}\n\nTotal: R$ ${reais(this.total())}`;
  }

  mensagemLonga() {
    return encodeURIComponent(this.montarMensagem()).length > LIMITE_MENSAGEM;
  }

  linkWhatsApp() {
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(this.montarMensagem())}`;
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Rodar: `node --test testes-site/test_carrinho.js`
Esperado: PASS, 13 testes

- [ ] **Step 5: Commit**

```bash
git add site/js/carrinho.js testes-site/test_carrinho.js
git commit -m "feat: carrinho em localStorage com mensagem para WhatsApp"
```

---

### Task 10: Busca e filtros

**Files:**
- Create: `site/js/catalogo.js`
- Test: `testes-site/test_catalogo.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `normalizar(texto: string) -> string` — minúsculas sem acento.
  - `buscar(produtos, termo) -> Array` — casa em nome, marca, categoria, tamanho e descrição.
  - `filtrar(produtos, {marca, categoria}) -> Array`.
  - `ordenar(produtos, criterio) -> Array` — critérios `'desconto'`, `'preco-asc'`, `'preco-desc'`, `'nome'`.
  - `agrupar(produtos) -> Map<string, Map<string, Array>>` — marca, depois categoria.

- [ ] **Step 1: Escrever o teste que falha**

Criar `testes-site/test_catalogo.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, buscar, filtrar, ordenar, agrupar } from '../site/js/catalogo.js';

const produtos = [
  { id: '1', nome: 'Kaiak Aventura', marca: 'Natura', categoria: 'Masculino', tamanho: '100 ml', descricao: 'Floral aquoso', precoPor: 110, desconto: 42 },
  { id: '2', nome: 'Humor Próprio', marca: 'Natura', categoria: 'Feminino', tamanho: '75 ml', descricao: 'Adocicado', precoPor: 75, desconto: 56 },
  { id: '3', nome: 'Egeo Bomb', marca: 'O Boticário', categoria: 'Feminino', tamanho: '90 ml', descricao: 'Doce', precoPor: 130, desconto: null },
];

test('normalizar remove acento e caixa', () => {
  assert.equal(normalizar('Humor PRÓPRIO'), 'humor proprio');
});

test('busca encontra ignorando acento', () => {
  assert.equal(buscar(produtos, 'proprio')[0].id, '2');
});

test('busca encontra pela marca', () => {
  assert.equal(buscar(produtos, 'boticario').length, 1);
});

test('busca encontra pela descricao', () => {
  assert.equal(buscar(produtos, 'aquoso')[0].id, '1');
});

test('busca com varias palavras exige todas', () => {
  assert.equal(buscar(produtos, 'kaiak floral').length, 1);
  assert.equal(buscar(produtos, 'kaiak doce').length, 0);
});

test('termo vazio devolve tudo', () => {
  assert.equal(buscar(produtos, '').length, 3);
});

test('filtra por marca', () => {
  assert.equal(filtrar(produtos, { marca: 'Natura' }).length, 2);
});

test('filtra por marca e categoria juntas', () => {
  assert.equal(filtrar(produtos, { marca: 'Natura', categoria: 'Feminino' }).length, 1);
});

test('ordena por maior desconto, sem desconto por ultimo', () => {
  const r = ordenar(produtos, 'desconto');
  assert.deepEqual(r.map((p) => p.id), ['2', '1', '3']);
});

test('ordena por preco crescente', () => {
  assert.deepEqual(ordenar(produtos, 'preco-asc').map((p) => p.id), ['2', '1', '3']);
});

test('ordenar nao altera a lista original', () => {
  const copia = [...produtos];
  ordenar(produtos, 'preco-desc');
  assert.deepEqual(produtos, copia);
});

test('agrupa por marca e depois categoria', () => {
  const g = agrupar(produtos);
  assert.deepEqual([...g.keys()], ['Natura', 'O Boticário']);
  assert.equal(g.get('Natura').get('Feminino').length, 1);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rodar: `node --test testes-site/test_catalogo.js`
Esperado: FAIL com `Cannot find module` apontando para `site/js/catalogo.js`

- [ ] **Step 3: Escrever a implementação mínima**

Criar `site/js/catalogo.js`:

```javascript
/** Minusculas e sem acento, para busca tolerante. */
export function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function textoBuscavel(p) {
  return normalizar([p.nome, p.marca, p.categoria, p.tamanho, p.descricao].join(' '));
}

/** Todas as palavras do termo precisam aparecer no produto. */
export function buscar(produtos, termo) {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return produtos;
  return produtos.filter((p) => {
    const alvo = textoBuscavel(p);
    return palavras.every((w) => alvo.includes(w));
  });
}

export function filtrar(produtos, { marca = '', categoria = '' } = {}) {
  return produtos.filter((p) => (
    (!marca || p.marca === marca) && (!categoria || p.categoria === categoria)
  ));
}

export function ordenar(produtos, criterio) {
  const copia = [...produtos];
  if (criterio === 'desconto') {
    return copia.sort((a, b) => (b.desconto ?? -1) - (a.desconto ?? -1));
  }
  if (criterio === 'preco-asc') return copia.sort((a, b) => a.precoPor - b.precoPor);
  if (criterio === 'preco-desc') return copia.sort((a, b) => b.precoPor - a.precoPor);
  if (criterio === 'nome') {
    return copia.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  return copia;
}

/** Map<marca, Map<categoria, produtos[]>>, preservando ordem de aparicao. */
export function agrupar(produtos) {
  const grupos = new Map();
  for (const p of produtos) {
    const marca = p.marca || 'Outros';
    const categoria = p.categoria || 'Diversos';
    if (!grupos.has(marca)) grupos.set(marca, new Map());
    const porCategoria = grupos.get(marca);
    if (!porCategoria.has(categoria)) porCategoria.set(categoria, []);
    porCategoria.get(categoria).push(p);
  }
  return grupos;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Rodar: `node --test testes-site/test_catalogo.js`
Esperado: PASS, 12 testes

- [ ] **Step 5: Commit**

```bash
git add site/js/catalogo.js testes-site/test_catalogo.js
git commit -m "feat: busca, filtros, ordenacao e agrupamento do catalogo"
```

---

### Task 11: Interface da vitrine

**Files:**
- Create: `site/index.html`
- Create: `site/css/estilo.css`
- Create: `site/js/app.js`
- Create: `site/produtos-backup.json`
- Create: `site/manifest.json`

**Interfaces:**
- Consumes: `carregarProdutos` de `dados.js`, `Carrinho` e `reais` de `carrinho.js`, `buscar`/`filtrar`/`ordenar` de `catalogo.js`.
- Produces: a página do cliente. Nenhuma exportação para outras tasks.

Esta task não tem testes automatizados: é a camada de DOM, verificada manualmente no navegador. Toda a lógica testável já vive nos módulos das tasks 7 a 10.

- [ ] **Step 1: Criar o HTML**

Criar `site/index.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NOSSO.ELO — Catálogo</title>
<meta name="description" content="Catálogo de perfumaria e cosméticos. Monte seu pedido e envie pelo WhatsApp.">
<link rel="manifest" href="manifest.json">
<link rel="stylesheet" href="css/estilo.css">
</head>
<body>
<header class="topo">
  <h1>NOSSO.ELO</h1>
  <p class="lema">Viva uma vida perfumada</p>
  <input id="busca" type="search" placeholder="Buscar produto, marca ou fragrância..." autocomplete="off">
  <div class="filtros">
    <select id="filtro-marca"><option value="">Todas as marcas</option></select>
    <select id="filtro-categoria"><option value="">Todas as categorias</option></select>
    <select id="ordem">
      <option value="desconto">Maior desconto</option>
      <option value="preco-asc">Menor preço</option>
      <option value="preco-desc">Maior preço</option>
      <option value="nome">Nome</option>
    </select>
  </div>
</header>

<div id="avisos" class="avisos" hidden></div>
<p id="contador" class="contador"></p>
<main id="grade" class="grade" aria-live="polite"></main>
<p id="vazio" class="vazio" hidden>Nenhum produto encontrado.</p>

<button id="abrir-carrinho" class="botao-carrinho" hidden>
  <span id="carrinho-qtd">0</span> itens · R$ <span id="carrinho-total">0,00</span>
</button>

<dialog id="painel-carrinho">
  <h2>Seu pedido</h2>
  <ul id="lista-carrinho"></ul>
  <p class="total-final">Total: R$ <span id="total-final">0,00</span></p>
  <p id="aviso-longo" class="aviso-longo" hidden>
    Seu pedido está grande demais para uma mensagem só. Envie em duas partes.
  </p>
  <a id="enviar-whatsapp" class="botao-enviar" href="#" target="_blank" rel="noopener">
    Enviar pedido pelo WhatsApp
  </a>
  <button id="fechar-painel" class="botao-secundario">Continuar comprando</button>
</dialog>

<script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Criar o CSS**

Criar `site/css/estilo.css`:

```css
:root {
  --fundo: #faf7f5;
  --carta: #ffffff;
  --tinta: #2b2320;
  --suave: #7d6f68;
  --marca: #8c5a3c;
  --destaque: #c0392b;
  --borda: #e8e0da;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--fundo); color: var(--tinta);
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  padding-bottom: 90px;
}
.topo { padding: 16px; background: var(--carta); border-bottom: 1px solid var(--borda); position: sticky; top: 0; z-index: 10; }
.topo h1 { margin: 0; font-size: 20px; letter-spacing: 2px; color: var(--marca); }
.lema { margin: 2px 0 12px; font-size: 13px; color: var(--suave); }
#busca { width: 100%; padding: 12px 14px; font-size: 16px; border: 1px solid var(--borda); border-radius: 10px; background: var(--fundo); }
.filtros { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.filtros select { flex: 1 1 30%; padding: 9px; font-size: 14px; border: 1px solid var(--borda); border-radius: 8px; background: var(--carta); }
.contador { margin: 12px 16px 0; font-size: 13px; color: var(--suave); }
.grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; padding: 12px 16px; }
.produto { background: var(--carta); border: 1px solid var(--borda); border-radius: 12px; padding: 10px; display: flex; flex-direction: column; }
.produto img { width: 100%; aspect-ratio: 1; object-fit: contain; background: var(--fundo); border-radius: 8px; }
.produto h3 { margin: 8px 0 2px; font-size: 14px; line-height: 1.3; }
.tamanho, .descricao { font-size: 12px; color: var(--suave); margin: 0 0 4px; }
.descricao { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.preco-de { font-size: 12px; color: var(--suave); text-decoration: line-through; }
.preco-por { font-size: 18px; font-weight: 700; color: var(--marca); }
.selo { display: inline-block; background: var(--destaque); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-left: 6px; }
.produto button { margin-top: auto; padding: 9px; border: 0; border-radius: 8px; background: var(--marca); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
.botao-carrinho { position: fixed; left: 16px; right: 16px; bottom: 16px; padding: 15px; border: 0; border-radius: 12px; background: #128c7e; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,.2); }
#painel-carrinho { width: min(520px, 92vw); border: 0; border-radius: 14px; padding: 20px; }
#painel-carrinho::backdrop { background: rgba(0,0,0,.45); }
#lista-carrinho { list-style: none; padding: 0; margin: 0 0 12px; }
#lista-carrinho li { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--borda); font-size: 14px; }
#lista-carrinho .nome { flex: 1; }
#lista-carrinho input { width: 54px; padding: 5px; border: 1px solid var(--borda); border-radius: 6px; }
.total-final { font-size: 18px; font-weight: 700; text-align: right; }
.botao-enviar { display: block; text-align: center; padding: 15px; border-radius: 10px; background: #25d366; color: #fff; font-weight: 700; text-decoration: none; }
.botao-secundario { display: block; width: 100%; margin-top: 8px; padding: 12px; border: 1px solid var(--borda); border-radius: 10px; background: var(--carta); cursor: pointer; }
.avisos { margin: 12px 16px; padding: 12px; background: #fff4e5; border: 1px solid #f0d9b5; border-radius: 8px; font-size: 14px; }
.aviso-longo { background: #fff4e5; padding: 10px; border-radius: 8px; font-size: 13px; }
.vazio { text-align: center; color: var(--suave); padding: 40px 16px; }
```

- [ ] **Step 3: Criar o backup e o manifesto**

Criar `site/produtos-backup.json` com `[]` (será preenchido na Task 14).

Criar `site/manifest.json`:

```json
{
  "name": "NOSSO.ELO Catálogo",
  "short_name": "NOSSO.ELO",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#faf7f5",
  "theme_color": "#8c5a3c",
  "icons": []
}
```

- [ ] **Step 4: Criar o app**

Criar `site/js/app.js`:

```javascript
import { carregarProdutos } from './dados.js';
import { Carrinho, reais } from './carrinho.js';
import { buscar, filtrar, ordenar } from './catalogo.js';

const $ = (s) => document.querySelector(s);
const carrinho = new Carrinho();
let todos = [];

function preencherSelect(sel, valores) {
  for (const v of [...new Set(valores)].filter(Boolean).sort()) {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    sel.appendChild(o);
  }
}

function cartao(p) {
  const el = document.createElement('article');
  el.className = 'produto';
  const selo = p.desconto ? `<span class="selo">${p.desconto}% OFF</span>` : '';
  const de = p.precoDe ? `<div class="preco-de">De R$ ${reais(p.precoDe)}</div>` : '';
  const src = p.imagem ? `img/${p.imagem}` : 'img/placeholder.webp';
  el.innerHTML = `
    <img src="${src}" alt="${p.nome}" loading="lazy"
         onerror="this.src='img/placeholder.webp'">
    <h3>${p.nome}</h3>
    ${p.tamanho ? `<p class="tamanho">${p.tamanho}</p>` : ''}
    ${p.descricao ? `<p class="descricao">${p.descricao}</p>` : ''}
    ${de}
    <div class="preco-por">R$ ${reais(p.precoPor)}${selo}</div>
    <button type="button">Adicionar</button>`;
  el.querySelector('button').addEventListener('click', () => {
    carrinho.adicionar(p);
    atualizarBotaoCarrinho();
  });
  return el;
}

function render() {
  const lista = ordenar(
    filtrar(buscar(todos, $('#busca').value), {
      marca: $('#filtro-marca').value,
      categoria: $('#filtro-categoria').value,
    }),
    $('#ordem').value);

  const grade = $('#grade');
  grade.replaceChildren(...lista.map(cartao));
  $('#vazio').hidden = lista.length > 0;
  $('#contador').textContent = `${lista.length} produto(s)`;
}

function atualizarBotaoCarrinho() {
  const n = carrinho.quantidadeTotal();
  $('#abrir-carrinho').hidden = n === 0;
  $('#carrinho-qtd').textContent = n;
  $('#carrinho-total').textContent = reais(carrinho.total());
}

function renderCarrinho() {
  const ul = $('#lista-carrinho');
  ul.replaceChildren();
  for (const item of carrinho.itens()) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="nome">${item.nome} ${item.tamanho}</span>
      <input type="number" min="0" value="${item.quantidade}">
      <span>R$ ${reais(item.precoPor * item.quantidade)}</span>
      <button type="button" aria-label="Remover">&times;</button>`;
    li.querySelector('input').addEventListener('change', (e) => {
      carrinho.definirQuantidade(item.id, parseInt(e.target.value, 10) || 0);
      renderCarrinho(); atualizarBotaoCarrinho();
    });
    li.querySelector('button').addEventListener('click', () => {
      carrinho.remover(item.id);
      renderCarrinho(); atualizarBotaoCarrinho();
    });
    ul.appendChild(li);
  }
  $('#total-final').textContent = reais(carrinho.total());
  $('#aviso-longo').hidden = !carrinho.mensagemLonga();
  $('#enviar-whatsapp').href = carrinho.linkWhatsApp();
}

async function iniciar() {
  let backup = [];
  try {
    backup = await (await fetch('produtos-backup.json')).json();
  } catch { backup = []; }

  todos = await carregarProdutos({ backup });

  const avisos = carrinho.reconciliar(todos);
  if (avisos.length) {
    $('#avisos').hidden = false;
    $('#avisos').textContent = avisos.join(' ');
  }

  preencherSelect($('#filtro-marca'), todos.map((p) => p.marca));
  preencherSelect($('#filtro-categoria'), todos.map((p) => p.categoria));

  for (const s of ['#busca', '#filtro-marca', '#filtro-categoria', '#ordem']) {
    $(s).addEventListener('input', render);
  }
  $('#abrir-carrinho').addEventListener('click', () => {
    renderCarrinho(); $('#painel-carrinho').showModal();
  });
  $('#fechar-painel').addEventListener('click', () => $('#painel-carrinho').close());

  const alvo = new URLSearchParams(location.search).get('p');
  if (alvo) {
    const p = todos.find((x) => x.id === alvo);
    if (p) $('#busca').value = p.nome;
  }

  render();
  atualizarBotaoCarrinho();
}

iniciar();
```

- [ ] **Step 5: Criar o placeholder e testar no navegador**

```bash
python -c "from PIL import Image, ImageDraw; im=Image.new('RGB',(400,400),(240,236,232)); d=ImageDraw.Draw(im); d.text((150,190),'sem foto',fill=(150,140,132)); im.save('site/img/placeholder.webp','WEBP',quality=82)"
python -m http.server 8000 --directory site
```

Abrir `http://localhost:8000`. Como a planilha ainda não existe, a página deve carregar vazia sem erro no console. Verificar no DevTools que `carregarProdutos` caiu no backup e não lançou exceção.

- [ ] **Step 6: Commit**

```bash
git add site/index.html site/css/estilo.css site/js/app.js site/manifest.json site/produtos-backup.json site/img/placeholder.webp
git commit -m "feat: interface da vitrine com busca, filtros e carrinho"
```

---

### Task 12: Página de validação da planilha

**Files:**
- Create: `site/js/validador.js`
- Create: `site/validar.html`
- Test: `testes-site/test_validador.js`

**Interfaces:**
- Consumes: `normalizarProduto` de `dados.js`, `parseCSV` de `csv.js`, `URL_PLANILHA` de `config.js`.
- Produces: `analisar(linhas: Array, arquivosExistentes: Array<string>) -> {erros: Array, avisos: Array, resumo: Object}`. `resumo` é `{total, ativos, inativos, semImagem}`.

A lista de arquivos existentes vem de `img/lista.json`, gerado na Task 14. O navegador não consegue listar uma pasta, então sem esse arquivo as checagens de imagem ficam inertes.

- [ ] **Step 1: Escrever o teste que falha**

Criar `testes-site/test_validador.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisar } from '../site/js/validador.js';

const base = {
  id: 'kaiak', ativo: 'sim', marca: 'Natura', categoria: 'Masculino',
  nome: 'Kaiak', tamanho: '100 ml', descricao: '', preco_de: '189,90',
  desconto: '42', preco_por: '110,00', imagem: 'kaiak.webp', destaque: 'nao',
};

test('planilha correta nao gera erro', () => {
  const r = analisar([base], ['kaiak.webp']);
  assert.equal(r.erros.length, 0);
  assert.equal(r.resumo.ativos, 1);
});

test('acusa id duplicado', () => {
  const r = analisar([base, { ...base, nome: 'Outro' }], ['kaiak.webp']);
  assert.match(r.erros[0].motivo, /duplicad/i);
});

test('acusa preco_por ausente', () => {
  const r = analisar([{ ...base, preco_por: '' }], ['kaiak.webp']);
  assert.equal(r.erros.length, 1);
});

test('acusa imagem referenciada que nao existe', () => {
  const r = analisar([base], []);
  assert.ok(r.erros.some((e) => /kaiak\.webp/.test(e.motivo)));
});

test('avisa sobre imagem na pasta que ninguem usa', () => {
  const r = analisar([base], ['kaiak.webp', 'orfa.webp']);
  assert.ok(r.avisos.some((a) => /orfa\.webp/.test(a)));
});

test('avisa sobre desconto invalido sem invalidar a linha', () => {
  const r = analisar([{ ...base, desconto: '150' }], ['kaiak.webp']);
  assert.equal(r.erros.length, 0);
  assert.ok(r.avisos.some((a) => /desconto/i.test(a)));
});

test('conta ativos, inativos e sem imagem', () => {
  const r = analisar([
    base,
    { ...base, id: 'b', ativo: 'nao' },
    { ...base, id: 'c', imagem: '' },
  ], ['kaiak.webp']);
  assert.equal(r.resumo.total, 3);
  assert.equal(r.resumo.ativos, 2);
  assert.equal(r.resumo.inativos, 1);
  assert.equal(r.resumo.semImagem, 1);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rodar: `node --test testes-site/test_validador.js`
Esperado: FAIL com `Cannot find module` apontando para `site/js/validador.js`

- [ ] **Step 3: Escrever a implementação mínima**

Criar `site/js/validador.js`:

```javascript
import { normalizarProduto } from './dados.js';

/** Confere a planilha inteira contra as regras e contra a pasta de imagens. */
export function analisar(linhas, arquivosExistentes = []) {
  const existentes = new Set(arquivosExistentes);
  const usadas = new Set();
  const vistos = new Set();
  const erros = [];
  const avisos = [];
  let ativos = 0, inativos = 0, semImagem = 0;

  linhas.forEach((linha, i) => {
    const numeroLinha = i + 2;
    const p = normalizarProduto(linha);

    if (!p) {
      erros.push({ linha: numeroLinha, motivo: 'faltando id, nome ou preco_por' });
      return;
    }
    if (vistos.has(p.id)) {
      erros.push({ linha: numeroLinha, motivo: `id duplicado: ${p.id}` });
      return;
    }
    vistos.add(p.id);

    if (p.ativo) ativos++; else inativos++;

    if (!p.imagem) {
      semImagem++;
      avisos.push(`Linha ${numeroLinha}: ${p.nome} está sem imagem.`);
    } else {
      usadas.add(p.imagem);
      if (!existentes.has(p.imagem)) {
        erros.push({ linha: numeroLinha, motivo: `imagem não encontrada: ${p.imagem}` });
      }
    }

    const descontoBruto = String(linha.desconto || '').trim();
    if (descontoBruto && p.desconto === null) {
      avisos.push(`Linha ${numeroLinha}: desconto inválido (${descontoBruto}).`);
    }
  });

  for (const arquivo of existentes) {
    if (!usadas.has(arquivo)) {
      avisos.push(`Imagem sem produto: ${arquivo}`);
    }
  }

  return {
    erros, avisos,
    resumo: { total: linhas.length, ativos, inativos, semImagem },
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Rodar: `node --test testes-site/test_validador.js`
Esperado: PASS, 7 testes

- [ ] **Step 5: Criar a página**

Criar `site/validar.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conferir planilha — NOSSO.ELO</title>
<link rel="stylesheet" href="css/estilo.css">
</head>
<body>
<header class="topo"><h1>Conferir planilha</h1></header>
<main style="padding:16px">
  <p>Abra esta página depois de atualizar a planilha para ver se ficou tudo certo.</p>
  <button id="conferir" class="botao-enviar" style="border:0;cursor:pointer">Conferir agora</button>
  <div id="saida" style="margin-top:20px"></div>
</main>
<script type="module">
import { parseCSV } from './js/csv.js';
import { analisar } from './js/validador.js';
import { URL_PLANILHA } from './js/config.js';

document.querySelector('#conferir').addEventListener('click', async () => {
  const saida = document.querySelector('#saida');
  saida.textContent = 'Conferindo...';
  try {
    const texto = await (await fetch(URL_PLANILHA + '&t=' + Date.now())).text();
    const linhas = parseCSV(texto);

    // O navegador nao lista pastas. Duas fontes se complementam:
    // lista.json (gerada na migracao) permite achar imagens orfas;
    // o teste HEAD confirma, imagem a imagem, o que realmente existe hoje.
    let doManifesto = [];
    try {
      doManifesto = await (await fetch('img/lista.json?t=' + Date.now())).json();
    } catch { doManifesto = []; }

    const referenciadas = [...new Set(linhas.map((l) => (l.imagem || '').trim()).filter(Boolean))];
    const existentes = [];
    for (let i = 0; i < referenciadas.length; i += 20) {
      const lote = referenciadas.slice(i, i + 20);
      const respostas = await Promise.all(lote.map((nome) =>
        fetch('img/' + nome, { method: 'HEAD' })
          .then((r) => (r.ok ? nome : null))
          .catch(() => null)));
      existentes.push(...respostas.filter(Boolean));
    }

    const r = analisar(linhas, [...new Set([...existentes, ...doManifesto])]);
    const erros = r.erros.map((e) => `<li>Linha ${e.linha}: ${e.motivo}</li>`).join('');
    const avisos = r.avisos.slice(0, 50).map((a) => `<li>${a}</li>`).join('');
    saida.innerHTML = `
      <p><strong>${r.resumo.total}</strong> linhas ·
         <strong>${r.resumo.ativos}</strong> à venda ·
         <strong>${r.resumo.inativos}</strong> fora do ar ·
         <strong>${r.resumo.semImagem}</strong> sem foto</p>
      <h2>Erros (${r.erros.length}) — precisam ser corrigidos</h2>
      <ul>${erros || '<li>Nenhum. Está tudo certo.</li>'}</ul>
      <h2>Avisos (${r.avisos.length}) — dá pra publicar assim</h2>
      <ul>${avisos || '<li>Nenhum.</li>'}</ul>`;
  } catch (e) {
    saida.textContent = 'Não consegui ler a planilha: ' + e.message;
  }
});
</script>
</body>
</html>
```

- [ ] **Step 6: Commit**

```bash
git add site/js/validador.js site/validar.html testes-site/test_validador.js
git commit -m "feat: pagina de conferencia da planilha"
```

---

## FASE 3 — Publicação

### Task 13: Endpoint de upload de imagem

**Files:**
- Create: `site/functions/api/upload.js`

**Interfaces:**
- Consumes: variáveis de ambiente `SENHA_UPLOAD`, `GITHUB_TOKEN`, `GITHUB_REPO` (formato `usuario/repositorio`), `GITHUB_BRANCH`.
- Produces: `POST /api/upload` recebendo JSON `{senha, nome, conteudoBase64}` e devolvendo `{ok: true, arquivo}` ou `{ok: false, erro}`.

A conversão para WebP acontece no navegador antes do envio, então a Function só grava bytes. O token do GitHub vive apenas como variável de ambiente da Cloudflare e nunca chega ao navegador.

- [ ] **Step 1: Escrever a Function**

Criar `site/functions/api/upload.js`:

```javascript
export async function onRequestPost({ request, env }) {
  const responder = (status, corpo) => new Response(JSON.stringify(corpo), {
    status, headers: { 'content-type': 'application/json' },
  });

  let dados;
  try {
    dados = await request.json();
  } catch {
    return responder(400, { ok: false, erro: 'Envio inválido.' });
  }

  const { senha, nome, conteudoBase64 } = dados;

  if (!env.SENHA_UPLOAD || senha !== env.SENHA_UPLOAD) {
    return responder(401, { ok: false, erro: 'Senha incorreta.' });
  }
  if (!nome || !/^[a-z0-9][a-z0-9\-]{0,60}\.webp$/.test(nome)) {
    return responder(400, {
      ok: false,
      erro: 'Nome inválido. Use apenas letras minúsculas, números e hífen, terminando em .webp',
    });
  }
  if (!conteudoBase64 || conteudoBase64.length > 4_000_000) {
    return responder(400, { ok: false, erro: 'Arquivo ausente ou grande demais.' });
  }

  const caminho = `site/img/${nome}`;
  const base = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${caminho}`;
  const cabecalhos = {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: 'application/vnd.github+json',
    'user-agent': 'nossoelo-upload',
    'content-type': 'application/json',
  };
  const branch = env.GITHUB_BRANCH || 'main';

  // Se o arquivo ja existe, o GitHub exige o sha da versao atual para substituir.
  let sha;
  const atual = await fetch(`${base}?ref=${branch}`, { headers: cabecalhos });
  if (atual.ok) sha = (await atual.json()).sha;

  const gravou = await fetch(base, {
    method: 'PUT',
    headers: cabecalhos,
    body: JSON.stringify({
      message: `feat: imagem ${nome}`,
      content: conteudoBase64,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!gravou.ok) {
    return responder(502, {
      ok: false,
      erro: 'Não consegui salvar a imagem. Tente de novo em um minuto.',
    });
  }

  return responder(200, { ok: true, arquivo: nome });
}
```

- [ ] **Step 2: Criar a página de envio**

Criar `site/enviar-foto.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Enviar foto — NOSSO.ELO</title>
<link rel="stylesheet" href="css/estilo.css">
</head>
<body>
<header class="topo"><h1>Enviar foto de produto</h1></header>
<main style="padding:16px;max-width:480px">
  <p>1. Escolha a foto. 2. Dê um nome curto. 3. Envie.<br>
     Depois copie o nome do arquivo para a coluna <strong>imagem</strong> da planilha.</p>
  <p><input type="password" id="senha" placeholder="Senha" style="width:100%;padding:12px"></p>
  <p><input type="text" id="nome" placeholder="nome-do-produto" style="width:100%;padding:12px"></p>
  <p><input type="file" id="arquivo" accept="image/*"></p>
  <button id="enviar" class="botao-enviar" style="border:0;cursor:pointer">Enviar</button>
  <p id="status" style="margin-top:16px"></p>
</main>
<script type="module">
const $ = (s) => document.querySelector(s);

/** Reduz para 800px no maior lado e converte para WebP dentro do navegador. */
async function paraWebp(file) {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.82));
  const buffer = await blob.arrayBuffer();
  let binario = '';
  for (const b of new Uint8Array(buffer)) binario += String.fromCharCode(b);
  return btoa(binario);
}

$('#enviar').addEventListener('click', async () => {
  const file = $('#arquivo').files[0];
  const nomeBase = $('#nome').value.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  if (!file || !nomeBase) {
    $('#status').textContent = 'Escolha a foto e digite um nome.';
    return;
  }

  $('#status').textContent = 'Enviando...';
  try {
    const resposta = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        senha: $('#senha').value,
        nome: nomeBase + '.webp',
        conteudoBase64: await paraWebp(file),
      }),
    });
    const r = await resposta.json();
    $('#status').textContent = r.ok
      ? `Pronto! Escreva "${r.arquivo}" na coluna imagem da planilha. A foto aparece no site em cerca de 1 minuto.`
      : 'Erro: ' + r.erro;
  } catch (e) {
    $('#status').textContent = 'Falhou: ' + e.message;
  }
});
</script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add site/functions/api/upload.js site/enviar-foto.html
git commit -m "feat: envio de foto pelo navegador com gravacao no repositorio"
```

---

### Task 14: Publicação e entrega

**Files:**
- Modify: `site/js/config.js` (linha 2, `URL_PLANILHA`)
- Modify: `site/produtos-backup.json`
- Create: `GUIA.md`

**Interfaces:**
- Consumes: `ferramentas/saida/produtos.csv` e `ferramentas/saida/img/` da Task 6.
- Produces: o site publicado e a documentação de entrega.

- [ ] **Step 1: Revisar os dados migrados**

Abrir `ferramentas/saida/conferir.csv` e corrigir as linhas listadas, comparando com o PDF original página por página. Priorizar as linhas com `motivo` contendo `sem preco`, porque produto sem preço não aparece no site.

- [ ] **Step 2: Publicar a planilha**

Criar a planilha Google, colar o conteúdo de `produtos.csv`, e na coluna `preco_por` aplicar a fórmula `=SE(E(H2<>"";I2<>"");ARRED(H2*(1-I2/100);2);J2)` a partir da linha 2, onde `H` é `preco_de`, `I` é `desconto` e `J` é o valor já digitado.

Em Arquivo → Compartilhar → Publicar na web, escolher a aba `produtos` no formato CSV e copiar o link gerado.

- [ ] **Step 3: Apontar o site para a planilha**

Substituir em `site/js/config.js`:

```javascript
export const URL_PLANILHA = 'COLAR_AQUI_O_LINK_CSV_PUBLICADO';
```

- [ ] **Step 4: Copiar as imagens e gerar o backup**

```bash
cp ferramentas/saida/img/*.webp site/img/
node -e "const fs=require('node:fs');fs.writeFileSync('site/img/lista.json',JSON.stringify(fs.readdirSync('site/img').filter(n=>n.endsWith('.webp'))));console.log('lista.json com',JSON.parse(fs.readFileSync('site/img/lista.json')).length,'imagens')"
curl -s "COLAR_AQUI_O_LINK_CSV_PUBLICADO" -o /tmp/p.csv
node -e "import('./site/js/csv.js').then(async(m)=>{const fs=await import('node:fs');const d=await import('./site/js/dados.js');const {produtos}=d.validarLista(m.parseCSV(fs.readFileSync('/tmp/p.csv','utf8')));fs.writeFileSync('site/produtos-backup.json',JSON.stringify(produtos));console.log('backup com',produtos.length,'produtos')})"
```

- [ ] **Step 5: Rodar toda a suíte e conferir o site**

```bash
node --test testes-site/
python -m unittest discover -s ferramentas/testes -t . -v
python -m http.server 8000 --directory site
```

Esperado: todos os testes passando. No navegador, verificar em `http://localhost:8000` que os produtos aparecem com foto e preço, que a busca por "kaiak" retorna resultados, que adicionar ao carrinho atualiza o botão inferior, e que o link do WhatsApp abre com a mensagem preenchida.

- [ ] **Step 6: Publicar no Cloudflare Pages**

```bash
gh repo create nossoelo-catalogo --public --source=. --push
```

No painel da Cloudflare: Workers & Pages → Create → Pages → Connect to Git → selecionar o repositório. Build command vazio, output directory `site`. Em Settings → Environment variables, cadastrar `SENHA_UPLOAD`, `GITHUB_TOKEN` (fine-grained, com permissão de Contents read/write apenas neste repositório), `GITHUB_REPO` e `GITHUB_BRANCH`.

- [ ] **Step 7: Escrever o guia do vendedor**

Criar `GUIA.md`:

```markdown
# Como atualizar o catálogo

O link do site nunca muda. Não precisa trocar nada no Instagram.

## Mudar preços e descontos
1. Abra a planilha.
2. Altere a coluna **desconto**. O preço final se ajusta sozinho.
3. Pronto. O site atualiza em até 10 minutos.

## Produto acabou
Escreva **nao** na coluna **ativo**. Ele some do site na hora.

## Produto voltou
Escreva **sim** na mesma coluna.

## Produto novo
1. Abra a página de enviar foto e envie a imagem.
2. Copie o nome do arquivo que aparecer.
3. Na planilha, crie uma linha nova e preencha: id, ativo, marca, categoria,
   nome, tamanho, preço de tabela, desconto e o nome do arquivo em **imagem**.

## Conferir se ficou tudo certo
Abra a página de conferência e clique em "Conferir agora".
Se aparecer algum **erro**, corrija antes de divulgar. **Avisos** podem ficar.

## Se errar algo na planilha
Arquivo → Histórico de versões → restaure a versão anterior.
```

- [ ] **Step 8: Gravar o vídeo de entrega**

Gravar cinco minutos de tela mostrando, nesta ordem: alterar uma coluna de descontos, marcar um produto como esgotado, reativar esse produto, cadastrar um produto novo com foto, e rodar a página de conferência.

- [ ] **Step 9: Commit final**

```bash
git add site/js/config.js site/produtos-backup.json site/img/ site/img/lista.json GUIA.md
git commit -m "feat: catalogo publicado com dados migrados e guia do vendedor"
git push
```

---

## Verificação final

- [ ] `node --test testes-site/` — 51 testes passando
- [ ] `python -m unittest discover -s ferramentas/testes -t .` — 40 testes passando
- [ ] Site abre em menos de 3 segundos no 4G de um celular real
- [ ] Busca por "kaiak" devolve os produtos Kaiak
- [ ] Carrinho sobrevive ao fechar e reabrir o navegador
- [ ] Link do WhatsApp abre a conversa com o pedido preenchido
- [ ] `validar.html` acusa zero erros na planilha de produção
- [ ] Envio de foto grava a imagem e ela aparece no site
- [ ] Nenhum service worker registrado (conferir em DevTools → Application)
