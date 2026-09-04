"""Decide o papel de cada token do catalogo e gera ids estaveis."""
import re
import unicodedata

from parser_preco import parse_preco
from parser_produto import parse_produto

IMAGENS_DESCARTADAS = ('.wdp', '.emf', '.wmf')

MARCAS = ('natura', 'o boticario', 'boticario', 'avon', 'eudora',
          'arabes', 'capilar', 'lattafa')

CATEGORIAS = ('perfumaria', 'feminin', 'masculin', 'corpo e banho', 'rosto',
              'cabelo', 'maquiagem', 'infantil', 'casa', 'kits', 'presente',
              'miniaturas', 'linha ')

RUIDO = ('os melhores precos', 'viva uma vida perfumada', 'qualquer duvida',
         'whatsapp', 'cada', 'lancamento', 'novo', 'promocao', 'frete',
         'entrega', 'pagamento', 'pix', 'obrigado', 'siga')

# Acima disto o texto e longo demais para ser um rotulo de secao.
LIMITE_CABECALHO = 45


def _sem_acento(texto):
    t = unicodedata.normalize('NFD', str(texto or '').lower())
    return ''.join(c for c in t if unicodedata.category(c) != 'Mn')


def classificar(token):
    """Devolve o papel do token: img, nome, sep, ruido, esgotado ou outro."""
    if token['tipo'] == 'img':
        alvo = token['valor'].lower()
        return 'outro' if alvo.endswith(IMAGENS_DESCARTADAS) else 'img'

    bruto = (token['valor'] or '').strip()
    if len(bruto) < 2:
        return 'outro'

    plano = _sem_acento(bruto)

    if plano.upper() == 'ESGOTADO' or plano == 'esgotado':
        return 'esgotado'

    if parse_preco(bruto):
        return 'sep'

    # Um texto com tamanho ("120ml", "30 un") e um produto, nunca um rotulo
    # de secao, mesmo quando cita marca ou categoria de passagem
    # (ex.: 'Dr Botica locao infantil 120ml', 'LANCAMENTOArabian Oasis').
    tem_tamanho = bool(parse_produto(bruto)['tamanho'])

    # Rotulos de secao sao curtos. Um nome de produto pode citar a marca no
    # meio da descricao, entao o limite de tamanho e o que separa os dois.
    if not tem_tamanho and len(bruto) <= LIMITE_CABECALHO:
        if any(m in plano for m in MARCAS):
            return 'sep'
        if any(c in plano for c in CATEGORIAS):
            return 'sep'

    if any(plano == r or plano.startswith(r) for r in RUIDO):
        return 'ruido'

    # Sobras de tabela de preco (ex.: '– 32%', '30,00 (120g) 35,00 (200g)')
    # nao tem "De:"/"Por:" para o parse_preco reconhecer, mas tambem nao sao
    # nome de produto: sao quase so digitos e pontuacao. Um nome de verdade
    # sempre tem mais que umas poucas letras.
    if sum(1 for c in bruto if c.isalpha()) <= 2:
        return 'outro'

    # Um nome de produto nao carrega preco, nao e so um numero, e nao tem o
    # tamanho de um paragrafo. Isto e texto solto da pagina que o Word
    # deixou numa caixa de texto propria.
    if 'R$' in bruto or re.search(r'\bRS\s*\d', bruto):
        return 'outro'
    if bruto.strip().isdigit():
        return 'outro'
    if len(bruto) > 90:
        return 'outro'

    return 'nome' if parse_produto(bruto)['nome'] else 'outro'


def gerar_id(nome, tamanho, usados):
    """Cria um id unico, minusculo e sem acento."""
    base = _sem_acento('{} {}'.format(nome, tamanho or ''))
    base = re.sub(r'[^a-z0-9]+', '-', base).strip('-') or 'produto'
    candidato, n = base, 2
    while candidato in usados:
        candidato = '{}-{}'.format(base, n)
        n += 1
    usados.add(candidato)
    return candidato
