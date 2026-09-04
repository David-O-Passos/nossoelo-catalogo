"""Converte o catalogo Word em produtos.csv e conferir.csv."""
import csv
import json
import os
import sys

from classificador import classificar, gerar_id
from docx_leitor import ler_tokens
from imagens import extrair_imagens
from pareador import casar
from parser_preco import parse_preco
from parser_produto import parse_produto

PASTA_SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'saida')
COLUNAS = ['id', 'ativo', 'marca', 'categoria', 'nome', 'tamanho',
           'descricao', 'preco_de', 'desconto', 'preco_por', 'imagem',
           'destaque']


def _secao(texto):
    """Um rotulo de secao vira marca se citar uma marca, senao categoria."""
    from classificador import MARCAS, _sem_acento
    plano = _sem_acento(texto)
    return 'marca' if any(m in plano for m in MARCAS) else 'categoria'


def montar_produtos(tokens):
    """Percorre os tokens e devolve as linhas de produto, sem imagem ainda."""
    linhas, usados = [], set()
    marca_atual = categoria_atual = ''
    pendentes = []

    for token in tokens:
        papel = classificar(token)

        if papel == 'esgotado':
            for p in pendentes:
                p['ativo'] = 'nao'
            continue

        if papel == 'sep':
            preco = parse_preco(token['valor'])
            if preco:
                for p in pendentes:
                    p['preco_de'] = preco['preco_de'] or ''
                    p['desconto'] = preco['desconto'] or ''
                    p['preco_por'] = preco['preco_por'] or ''
                    # Um bloco de preco pode listar varios percentuais e o
                    # parser pega o primeiro. Quando os dois precos existem,
                    # eles sao a verdade: o selo passa a ser derivado deles,
                    # nunca do texto.
                    if p['preco_de'] and p['preco_por']:
                        p['desconto'] = round(
                            100 * (1 - p['preco_por'] / p['preco_de']))
                pendentes = []
            else:
                if _secao(token['valor']) == 'marca':
                    marca_atual = token['valor'].strip()
                else:
                    categoria_atual = token['valor'].strip()
            continue

        if papel != 'nome':
            continue

        dados = parse_produto(token['valor'])
        linha = {
            'id': gerar_id(dados['nome'], dados['tamanho'], usados),
            'ativo': 'sim',
            'marca': marca_atual,
            'categoria': categoria_atual,
            'nome': dados['nome'],
            'tamanho': dados['tamanho'] or '',
            'descricao': dados['descricao'] or '',
            'preco_de': '', 'desconto': '', 'preco_por': '',
            'imagem': '',
            'destaque': 'nao',
            '_confianca_nome': dados['confianca'],
        }
        linhas.append(linha)
        pendentes.append(linha)

    return linhas


def main(caminho_docx, caminho_legendas):
    os.makedirs(PASTA_SAIDA, exist_ok=True)

    print('Extraindo imagens...')
    extrair_imagens(caminho_docx, os.path.join(PASTA_SAIDA, 'img'))

    print('Lendo o documento...')
    linhas = montar_produtos(ler_tokens(caminho_docx))
    print('  {} produtos'.format(len(linhas)))

    print('Casando fotos pelas legendas...')
    with open(caminho_legendas, encoding='utf8') as f:
        legendas = json.load(f)
    pares = casar(linhas, legendas)
    for linha in linhas:
        par = pares.get(linha['id'])
        linha['imagem'] = par['arquivo'] if par else ''
        linha['_confianca_img'] = par['confianca'] if par else 'sem par'
        linha['_escore'] = par['escore'] if par else ''

    conferir = []
    for linha in linhas:
        motivos = []
        if linha['_confianca_nome'] == 'baixa':
            motivos.append('nome incerto')
        if not linha['preco_por']:
            motivos.append('sem preco')
        if not linha['imagem']:
            motivos.append('sem imagem')
        elif linha['_confianca_img'] == 'baixa':
            motivos.append('imagem incerta (escore {})'.format(linha['_escore']))
        if motivos:
            conferir.append({**{c: linha[c] for c in COLUNAS},
                             'motivo': '; '.join(motivos)})

    limpas = [{c: l[c] for c in COLUNAS} for l in linhas]

    with open(os.path.join(PASTA_SAIDA, 'produtos.csv'), 'w',
              newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=COLUNAS)
        w.writeheader()
        w.writerows(limpas)

    with open(os.path.join(PASTA_SAIDA, 'conferir.csv'), 'w',
              newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=COLUNAS + ['motivo'])
        w.writeheader()
        w.writerows(conferir)

    com_img = sum(1 for l in limpas if l['imagem'])
    com_preco = sum(1 for l in limpas if l['preco_por'])
    print('\nprodutos.csv : {} linhas'.format(len(limpas)))
    print('com imagem   : {} ({:.0f}%)'.format(
        com_img, 100 * com_img / max(len(limpas), 1)))
    print('com preco    : {} ({:.0f}%)'.format(
        com_preco, 100 * com_preco / max(len(limpas), 1)))
    print('conferir.csv : {} linhas'.format(len(conferir)))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
