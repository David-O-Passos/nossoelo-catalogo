import unittest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from parser_preco import parse_preco


class TestParsePreco(unittest.TestCase):

    def test_formato_completo(self):
        r = parse_preco('De: R$ 169,90 – 56%Por: R$ 75,00')
        self.assertEqual(r['preco_de'], 169.90)
        self.assertEqual(r['desconto'], 56)
        self.assertEqual(r['preco_por'], 75.00)
        self.assertFalse(r['cada'])

    def test_de_sem_simbolo_real(self):
        r = parse_preco('De: 319,90 – 44%Por: R$ 180,00')
        self.assertEqual(r['preco_de'], 319.90)
        self.assertEqual(r['preco_por'], 180.00)

    def test_sem_espaco_depois_de_por(self):
        r = parse_preco('De: R$ 279,90 – 48%Por:R$ 145,00')
        self.assertEqual(r['preco_por'], 145.00)

    def test_marcador_cada(self):
        r = parse_preco('De: R$ 279,90 – 45%Por: R$ 155,00 Cada')
        self.assertEqual(r['preco_por'], 155.00)
        self.assertTrue(r['cada'])

    def test_apenas_por_sem_dois_pontos(self):
        r = parse_preco('Por 20,00')
        self.assertIsNone(r['preco_de'])
        self.assertIsNone(r['desconto'])
        self.assertEqual(r['preco_por'], 20.00)

    def test_apenas_de(self):
        r = parse_preco('De R$ 73,80')
        self.assertEqual(r['preco_de'], 73.80)
        self.assertIsNone(r['preco_por'])

    def test_milhar_com_ponto(self):
        r = parse_preco('Por: R$ 1.299,90')
        self.assertEqual(r['preco_por'], 1299.90)

    def test_hifen_comum_em_vez_de_travessao(self):
        r = parse_preco('De: R$ 189,90 - 42%Por: R$ 110,00')
        self.assertEqual(r['desconto'], 42)

    def test_texto_sem_preco_retorna_none(self):
        self.assertIsNone(parse_preco('KAIAK AVENTURA 100 ml'))

    def test_texto_vazio_retorna_none(self):
        self.assertIsNone(parse_preco(''))

    def test_de_dentro_de_palavra_nao_e_preco(self):
        self.assertIsNone(parse_preco('Sabonete verde 30,00'))

    def test_por_dentro_de_palavra_nao_e_preco(self):
        self.assertIsNone(parse_preco('Vapor 15,00'))

    def test_caixa_alta_dentro_de_palavra_nao_e_preco(self):
        self.assertIsNone(parse_preco('SABONETE GRANDE 12,50'))


if __name__ == '__main__':
    unittest.main()
