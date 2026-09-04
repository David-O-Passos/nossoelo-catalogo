import unittest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from parser_produto import parse_produto


class TestParseProduto(unittest.TestCase):

    def test_nome_tamanho_descricao_colados(self):
        r = parse_produto('KAIAK AVENTURA100 mlFloral aquoso. Notas aquosas e verdes.')
        self.assertEqual(r['nome'], 'KAIAK AVENTURA')
        self.assertEqual(r['tamanho'], '100 ml')
        self.assertEqual(r['descricao'], 'Floral aquoso. Notas aquosas e verdes.')
        self.assertEqual(r['confianca'], 'alta')

    def test_com_espacos_normais(self):
        r = parse_produto('KRISKA FLORES 100 ml Adocicado frutal')
        self.assertEqual(r['nome'], 'KRISKA FLORES')
        self.assertEqual(r['tamanho'], '100 ml')
        self.assertEqual(r['descricao'], 'Adocicado frutal')

    def test_tamanho_em_gramas_com_virgula(self):
        r = parse_produto('Batom Cremoso Intense 3,8g O Boticario')
        self.assertEqual(r['tamanho'], '3,8 g')
        self.assertEqual(r['nome'], 'Batom Cremoso Intense')

    def test_tamanho_sem_espaco_antes_da_unidade(self):
        r = parse_produto('HUMOR PROPRIO 75mlAdocicado moderado.')
        self.assertEqual(r['tamanho'], '75 ml')
        self.assertEqual(r['nome'], 'HUMOR PROPRIO')

    def test_sem_tamanho_usa_transicao_de_caixa_alta(self):
        r = parse_produto('TRADICIONALChipre Frutal moderado')
        self.assertEqual(r['nome'], 'TRADICIONAL')
        self.assertEqual(r['descricao'], 'Chipre Frutal moderado')
        self.assertEqual(r['confianca'], 'baixa')

    def test_so_nome_sem_descricao(self):
        r = parse_produto('PALO SANTO')
        self.assertEqual(r['nome'], 'PALO SANTO')
        self.assertIsNone(r['tamanho'])
        self.assertIsNone(r['descricao'])

    def test_texto_ambiguo_marca_confianca_baixa(self):
        r = parse_produto('ALRA ALBAO mais puro oleo natural da Rosa Alba')
        self.assertEqual(r['confianca'], 'baixa')
        self.assertTrue(len(r['nome']) > 0)

    def test_espacos_extras_sao_normalizados(self):
        r = parse_produto('  KAIAK   AERO  100 ml   Aromatico  ')
        self.assertEqual(r['nome'], 'KAIAK AERO')
        self.assertEqual(r['descricao'], 'Aromatico')

    def test_texto_vazio(self):
        r = parse_produto('')
        self.assertEqual(r['nome'], '')
        self.assertEqual(r['confianca'], 'baixa')


if __name__ == '__main__':
    unittest.main()
