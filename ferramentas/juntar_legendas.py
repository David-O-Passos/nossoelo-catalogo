"""Concatena os lotes de legendagem num unico legendas.json."""
import glob
import json
import os
import sys

PADRAO = os.path.join('.superpowers', 'sdd', '2026-09-03-catalogo-online-nosso-elo',
                      'lotes', 'lote-*-resultado.json')
DESTINO = os.path.join('ferramentas', 'saida', 'legendas.json')


def juntar(padrao=PADRAO, destino=DESTINO):
    """Junta os lotes, descartando repeticoes de arquivo. Devolve a lista."""
    vistos, saida = set(), []
    for caminho in sorted(glob.glob(padrao)):
        with open(caminho, encoding='utf8') as f:
            for item in json.load(f):
                if item['arquivo'] in vistos:
                    continue
                vistos.add(item['arquivo'])
                saida.append(item)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, 'w', encoding='utf8') as f:
        json.dump(saida, f, ensure_ascii=False, indent=1)
    return saida


if __name__ == '__main__':
    itens = juntar()
    print('{} legendas em {}'.format(len(itens), DESTINO))
