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
