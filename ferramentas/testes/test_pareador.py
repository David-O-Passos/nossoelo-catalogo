import unittest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pareador import normalizar, palavras, similaridade, casar


def legenda(arquivo, produto, texto='', tipo='produto', confianca='alta'):
    return {'arquivo': arquivo, 'tipo': tipo, 'produto': produto,
            'texto_visivel': texto or produto, 'marca': '',
            'descricao_visual': '', 'confianca': confianca, 'multiplos': False}


def produto(pid, nome):
    return {'id': pid, 'nome': nome, 'marca': '', 'tamanho': ''}


class TestNormalizar(unittest.TestCase):

    def test_remove_acento_e_caixa(self):
        self.assertEqual(normalizar('Ekos Açaí'), 'ekos acai')

    def test_remove_pontuacao_e_colapsa_espaco(self):
        self.assertEqual(normalizar('KAIAK  -  Aero, 100ml!'), 'kaiak aero 100ml')


class TestPalavras(unittest.TestCase):

    def test_descarta_palavras_vazias(self):
        self.assertEqual(palavras('Deo Parfum de Natura ml'), {'deo', 'parfum'})

    def test_mantem_numero_de_cor(self):
        self.assertIn('260', palavras('Batom Intense cor 260'))


class TestSimilaridade(unittest.TestCase):

    def test_identico_da_um(self):
        self.assertEqual(similaridade('Kaiak Aero', 'Kaiak Aero'), 1.0)

    def test_sem_nada_em_comum_da_zero(self):
        self.assertEqual(similaridade('Kaiak Aero', 'Malbec Gold'), 0.0)

    def test_parcial_fica_entre_zero_e_um(self):
        s = similaridade('Kaiak Aero 100', 'Kaiak Aero')
        self.assertGreater(s, 0.5)
        self.assertLess(s, 1.0)

    def test_e_simetrica(self):
        self.assertEqual(similaridade('a bola', 'bola a'), similaridade('bola a', 'a bola'))


class TestCasar(unittest.TestCase):

    def test_casa_nome_identico(self):
        r = casar([produto('p1', 'Kaiak Aero')], [legenda('a.webp', 'Kaiak Aero')])
        self.assertEqual(r['p1']['arquivo'], 'a.webp')
        self.assertEqual(r['p1']['confianca'], 'alta')

    def test_escolhe_a_legenda_mais_parecida(self):
        r = casar([produto('p1', 'Kaiak Aventura')],
                  [legenda('errada.webp', 'Kaiak Aero'),
                   legenda('certa.webp', 'Kaiak Aventura')])
        self.assertEqual(r['p1']['arquivo'], 'certa.webp')

    def test_uma_imagem_nao_serve_dois_produtos(self):
        r = casar([produto('p1', 'Kaiak Aero'), produto('p2', 'Kaiak Aero 100 ml')],
                  [legenda('a.webp', 'Kaiak Aero')])
        usados = [v['arquivo'] for v in r.values()]
        self.assertEqual(usados.count('a.webp'), 1)

    def test_abaixo_do_minimo_nao_casa(self):
        r = casar([produto('p1', 'Malbec Gold')], [legenda('a.webp', 'Kaiak Aero')])
        self.assertNotIn('p1', r)

    def test_ignora_legenda_decorativa(self):
        r = casar([produto('p1', 'Kaiak Aero')],
                  [legenda('emoji.webp', 'Kaiak Aero', tipo='decorativo')])
        self.assertNotIn('p1', r)

    def test_legenda_de_baixa_confianca_rebaixa_o_par(self):
        r = casar([produto('p1', 'Kaiak Aero')],
                  [legenda('a.webp', 'Kaiak Aero', confianca='baixa')])
        self.assertEqual(r['p1']['confianca'], 'baixa')

    def test_escore_apertado_rebaixa_o_par(self):
        r = casar([produto('p1', 'Deo Parfum Essencial Unico Feminino')],
                  [legenda('a.webp', 'Essencial Unico')])
        self.assertEqual(r['p1']['confianca'], 'baixa')

    def test_o_melhor_par_global_vence_a_ordem_da_lista(self):
        # 'p1' aparece antes, mas 'p2' casa melhor com a unica imagem.
        r = casar([produto('p1', 'Kaiak Aero Masculino'), produto('p2', 'Kaiak Aero')],
                  [legenda('a.webp', 'Kaiak Aero')])
        self.assertEqual(r['p2']['arquivo'], 'a.webp')
        self.assertNotIn('p1', r)

    def test_listas_vazias_nao_quebram(self):
        self.assertEqual(casar([], []), {})
        self.assertEqual(casar([produto('p1', 'X')], []), {})

    def test_usa_texto_visivel_quando_produto_esta_vazio(self):
        l = legenda('a.webp', '', texto='KAIAK AERO')
        r = casar([produto('p1', 'Kaiak Aero')], [l])
        self.assertEqual(r['p1']['arquivo'], 'a.webp')


if __name__ == '__main__':
    unittest.main()
