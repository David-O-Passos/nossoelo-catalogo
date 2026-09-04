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
