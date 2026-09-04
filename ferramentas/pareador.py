"""Casa cada produto com a foto cuja legenda mais se parece com o nome dele.

As coordenadas do .docx nao servem para isso: sao relativas ao paragrafo
ancora, nao a pagina. A ordem documental tambem nao: foi conferida contra
as fotos e troca produtos de lugar. O sinal confiavel e o nome impresso no
frasco, capturado no passo de legendagem.
"""
import re
import unicodedata

# Palavras que aparecem em quase todo item e por isso nao distinguem nada.
VAZIAS = {
    'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'para', 'por', 'a', 'o',
    'ml', 'gr', 'kg', 'un', 'g', 'natura', 'boticario', 'avon', 'eudora',
    'perfume', 'perfumaria', 'linha', 'produto', 'refil', 'cada',
}

# Marcas do catalogo. O rotulo de marca do lado do produto vem de cabecalhos
# do Word e chega sujo ("Natura VEVE", "Eudora H Ready 100ml"), entao
# comparamos so a marca canonica que aparece dentro dele.
MARCAS_CONHECIDAS = ('natura', 'boticario', 'avon', 'eudora', 'lattafa',
                     'amaran', 'manasik')

ESCORE_ALTO = 0.6


def normalizar(texto):
    """Minusculas, sem acento, sem pontuacao, espacos colapsados."""
    t = unicodedata.normalize('NFD', str(texto or '').lower())
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    t = re.sub(r'[^a-z0-9]+', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


def palavras(texto):
    """Conjunto de tokens significativos do texto."""
    return {p for p in normalizar(texto).split()
            if len(p) >= 2 and p not in VAZIAS}


def similaridade(a, b):
    """Indice de Jaccard entre os conjuntos de palavras. 0 quando nao ha uniao."""
    pa, pb = palavras(a), palavras(b)
    if not pa or not pb:
        return 0.0
    return len(pa & pb) / len(pa | pb)


def _rotulo(legenda):
    """O texto da legenda que melhor identifica o item."""
    return legenda.get('produto') or legenda.get('texto_visivel') or ''


def marca_canonica(texto):
    """Reduz um rotulo de marca a uma marca conhecida, ou '' se nao houver."""
    plano = normalizar(texto)
    for marca in MARCAS_CONHECIDAS:
        if marca in plano:
            return marca
    return ''


def marcas_compativeis(produto, legenda):
    """Falso apenas quando as duas marcas sao conhecidas e diferentes.

    Marca desconhecida de um dos lados nunca bloqueia o par: 85 das 747
    legendas nao trazem marca, e barrar esses casos custaria mais acertos
    do que evitaria erros.
    """
    a = marca_canonica(produto.get('marca', ''))
    b = marca_canonica(legenda.get('marca', ''))
    return not (a and b and a != b)


def casar(produtos, legendas, minimo=0.34):
    """Casa produtos com legendas, do par mais forte para o mais fraco.

    Cada imagem serve a um unico produto. Pares abaixo de `minimo` ficam de
    fora — e melhor um produto sem foto do que com a foto errada.
    """
    candidatas = [l for l in legendas if l.get('tipo') == 'produto']

    pontuados = []
    for p in produtos:
        alvo = ' '.join(filter(None, [p.get('nome', ''), p.get('tamanho', '')]))
        for l in candidatas:
            if not marcas_compativeis(p, l):
                continue
            escore = similaridade(alvo, _rotulo(l))
            if escore >= minimo:
                pontuados.append((escore, p['id'], l))

    # Do melhor escore para o pior, para que o par mais forte tenha prioridade
    # sobre a ordem em que os produtos aparecem na lista.
    pontuados.sort(key=lambda t: -t[0])

    resultado = {}
    usadas = set()
    for escore, pid, l in pontuados:
        if pid in resultado or l['arquivo'] in usadas:
            continue
        usadas.add(l['arquivo'])
        resultado[pid] = {
            'arquivo': l['arquivo'],
            'escore': round(escore, 3),
            'confianca': ('alta' if escore >= ESCORE_ALTO
                          and l.get('confianca') == 'alta' else 'baixa'),
        }
    return resultado
