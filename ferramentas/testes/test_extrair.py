import unittest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from extrair import montar_produtos


def txt(valor):
    return {'tipo': 'txt', 'valor': valor}


class TestMontarProdutosDesconto(unittest.TestCase):

    def test_desconto_derivado_vence_percentual_contraditorio(self):
        # O bloco de preco cita -45%, mas 279,90 -> 120,00 e um corte de 57%.
        # O selo exibido deve ser o real, derivado dos dois precos.
        tokens = [
            txt('DEO PARFUM ESSENCIAL UNICO 100 ml'),
            txt('De: R$ 279,90 – 45%Por: R$ 120,00'),
        ]
        linhas = montar_produtos(tokens)
        self.assertEqual(len(linhas), 1)
        self.assertEqual(linhas[0]['preco_de'], 279.90)
        self.assertEqual(linhas[0]['preco_por'], 120.00)
        self.assertEqual(linhas[0]['desconto'], 57)

    def test_desconto_scraped_mantido_quando_falta_um_preco(self):
        # Sem os dois precos nao ha como derivar: mantem o percentual lido.
        tokens = [
            txt('KAIAK AVENTURA 100 ml'),
            txt('Por: R$ 120,00'),
        ]
        linhas = montar_produtos(tokens)
        self.assertEqual(len(linhas), 1)
        self.assertEqual(linhas[0]['preco_de'], '')
        self.assertEqual(linhas[0]['desconto'], '')
        self.assertEqual(linhas[0]['preco_por'], 120.00)


if __name__ == '__main__':
    unittest.main()
