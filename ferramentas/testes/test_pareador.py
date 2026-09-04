import unittest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pareador import (normalizar, palavras, similaridade, casar,
                       marca_canonica, marcas_compativeis)


def legenda(arquivo, produto, texto='', tipo='produto', confianca='alta',
            marca=''):
    return {'arquivo': arquivo, 'tipo': tipo, 'produto': produto,
            'texto_visivel': texto or produto, 'marca': marca,
            'descricao_visual': '', 'confianca': confianca, 'multiplos': False}


def produto(pid, nome, marca=''):
    return {'id': pid, 'nome': nome, 'marca': marca, 'tamanho': ''}


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

    def test_nome_contido_no_outro_pontua_alto(self):
        s = similaridade('DEO PARFUM ESSENCIAL OUD FEMININO', 'Essencial Oud')
        self.assertEqual(s, 0.9)

    def test_contencao_perde_para_casamento_exato(self):
        exato = similaridade('Kaiak Aero', 'Kaiak Aero')
        contido = similaridade('Kaiak Aero Masculino', 'Kaiak Aero')
        self.assertEqual(exato, 1.0)
        self.assertLess(contido, exato)

    def test_contencao_de_uma_palavra_so_nao_conta(self):
        # "Kaiak" dentro de "Kaiak Aero" e outro produto, nao o mesmo.
        self.assertLess(similaridade('Kaiak', 'Kaiak Aero'), 0.9)


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
        # Sobreposicao parcial de verdade: duas variantes distintas da mesma
        # linha compartilham duas palavras mas nenhuma contem a outra.
        r = casar([produto('p1', 'Shampoo Siage Cachos')],
                  [legenda('a.webp', 'Shampoo Siage Lisos')])
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


class TestMarca(unittest.TestCase):

    def test_extrai_marca_de_rotulo_sujo(self):
        self.assertEqual(marca_canonica('Natura VÊVÊ'), 'natura')
        self.assertEqual(marca_canonica('Eudora H Ready 100ml'), 'eudora')
        self.assertEqual(marca_canonica('Batom Ultra AVON – ULTRAMATTE'), 'avon')

    def test_o_boticario_e_boticario_sao_a_mesma_marca(self):
        self.assertEqual(marca_canonica('O Boticário'), marca_canonica('Boticário'))

    def test_rotulo_sem_marca_conhecida_da_vazio(self):
        self.assertEqual(marca_canonica('Perfumaria Feminina'), '')
        self.assertEqual(marca_canonica(''), '')

    def test_marcas_diferentes_nao_casam(self):
        p = {'id': 'p1', 'nome': 'Hidratante Corporal', 'tamanho': '',
             'marca': 'Natura VÊVÊ'}
        l = {'arquivo': 'a.webp', 'tipo': 'produto',
             'produto': 'Hidratante Corporal', 'texto_visivel': '',
             'marca': 'O Boticário', 'confianca': 'alta'}
        self.assertNotIn('p1', casar([p], [l]))

    def test_mesma_marca_com_rotulo_sujo_casa(self):
        p = {'id': 'p1', 'nome': 'Hidratante Corporal', 'tamanho': '',
             'marca': 'Natura VÊVÊ'}
        l = {'arquivo': 'a.webp', 'tipo': 'produto',
             'produto': 'Hidratante Corporal', 'texto_visivel': '',
             'marca': 'Natura', 'confianca': 'alta'}
        self.assertEqual(casar([p], [l])['p1']['arquivo'], 'a.webp')

    def test_marca_desconhecida_de_um_lado_nao_bloqueia(self):
        p = {'id': 'p1', 'nome': 'Kaiak Aero', 'tamanho': '', 'marca': ''}
        l = {'arquivo': 'a.webp', 'tipo': 'produto', 'produto': 'Kaiak Aero',
             'texto_visivel': '', 'marca': 'Natura', 'confianca': 'alta'}
        self.assertEqual(casar([p], [l])['p1']['arquivo'], 'a.webp')


if __name__ == '__main__':
    unittest.main()
