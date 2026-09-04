"""Le um .docx e devolve imagens e caixas de texto em ordem documental."""
import html
import re
import zipfile

# [^>]* tolera a forma <mc:Fallback attr="...">, que o Word tambem emite.
RE_FALLBACK = re.compile(r'<mc:Fallback\b[^>]*>.*?</mc:Fallback>', re.S)
RE_REL = re.compile(r'Id="([^"]+)"[^>]*Target="(media/[^"]+)"')
RE_EMBED = re.compile(r'r:embed="([^"]+)"')
RE_TXBX = re.compile(r'<w:txbxContent>(.*?)</w:txbxContent>', re.S)
RE_TEXTO = re.compile(r'<w:t[^>]*>([^<]*)</w:t>')
RE_QUEBRA = re.compile(r'lastRenderedPageBreak')
RE_POS_H = re.compile(r'<wp:positionH.*?<wp:posOffset>(-?\d+)</wp:posOffset>', re.S)
RE_POS_V = re.compile(r'<wp:positionV.*?<wp:posOffset>(-?\d+)</wp:posOffset>', re.S)
RE_EXTENT = re.compile(r'<wp:extent\s+cx="(\d+)"\s+cy="(\d+)"')


def remover_fallback(xml):
    """Remove os blocos mc:Fallback, que duplicam todo o conteudo."""
    return RE_FALLBACK.sub('', xml)


def _pagina_ate(xml, posicao):
    return 1 + len(RE_QUEBRA.findall(xml, 0, posicao))


SEM_GEOMETRIA = {'x': None, 'y': None, 'largura': None, 'altura': None}


def _geometria(xml, posicao_embed):
    """Le as coordenadas do wp:anchor que realmente envolve o elemento."""
    inicio = xml.rfind('<wp:anchor', 0, posicao_embed)
    if inicio == -1:
        return dict(SEM_GEOMETRIA)

    # A ancora mais proxima pode ja ter fechado antes deste elemento — e o
    # caso de uma imagem wp:inline. Sem esta checagem ela herdaria as
    # coordenadas de OUTRO produto e o pareamento da Task 5 sairia errado,
    # sem excecao e sem valor nulo que denuncie o problema.
    fim = xml.find('</wp:anchor>', inicio)
    if fim != -1 and fim < posicao_embed:
        return dict(SEM_GEOMETRIA)

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
        # html.unescape converte &amp; &lt; &gt; &quot; de volta ao caractere
        # original. Sem isso, um nome como "M&M" chegaria ao cliente escrito
        # "M&amp;M" no catalogo.
        bruto = html.unescape(''.join(RE_TEXTO.findall(m.group(1))))
        texto = re.sub(r'\s+', ' ', bruto).strip()
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
