"""Separa nome, tamanho e descricao das caixas de texto do catalogo."""
import re

RE_TAMANHO = re.compile(
    r'(\d{1,4}(?:,\d{1,2})?)\s*(ml|g|kg|un|unidades?)', re.I)
RE_TRANSICAO = re.compile(r'^([A-ZÀ-Ü0-9][A-ZÀ-Ü0-9\s\.\-]{2,}?)(?=[A-ZÀ-Ü][a-zà-ü])')


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
