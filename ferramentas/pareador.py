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

# Contencao exige ao menos este numero de palavras no conjunto menor. Com 1,
# "Kaiak" casaria com "Kaiak Aero", que e outro produto.
MINIMO_CONTENCAO = 2

# Contencao vale menos que um casamento exato de proposito: assim um par
# exato sempre vence um par contido na hora de disputar a mesma foto.
ESCORE_CONTENCAO = 0.9


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
    """Quanto dois nomes se parecem, de 0 a 1.

    Usa Jaccard, mas trata a parte tambem o caso em que um nome esta
    inteiramente contido no outro: o catalogo escreve "DEO PARFUM ESSENCIAL
    OUD FEMININO" onde a legenda da foto diz apenas "Essencial Oud", e
    Jaccard sozinho descartaria esse par por diferenca de tamanho.
    """
    pa, pb = palavras(a), palavras(b)
    if not pa or not pb:
        return 0.0

    comuns = len(pa & pb)
    jaccard = comuns / len(pa | pb)

    menor = min(len(pa), len(pb))
    if comuns == menor and menor >= MINIMO_CONTENCAO:
        return max(jaccard, ESCORE_CONTENCAO)
    return jaccard


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
