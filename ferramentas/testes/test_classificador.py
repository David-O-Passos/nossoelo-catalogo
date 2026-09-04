import unittest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from classificador import classificar, gerar_id


def txt(valor):
    return {'tipo': 'txt', 'valor': valor}


def img(nome):
    return {'tipo': 'img', 'valor': nome}


class TestClassificar(unittest.TestCase):

    def test_imagem_normal(self):
        self.assertEqual(classificar(img('media/image31.jpeg')), 'img')

    def test_imagem_wdp_e_descartada(self):
        self.assertEqual(classificar(img('media/hdphoto3.wdp')), 'outro')

    def test_bloco_de_preco_e_separador(self):
        self.assertEqual(classificar(txt('De: R$ 189,90 – 42%Por: R$ 110,00')), 'sep')

    def test_cabecalho_de_marca_e_separador(self):
        self.assertEqual(classificar(txt('Natura')), 'sep')

    def test_cabecalho_de_categoria_e_separador(self):
        self.assertEqual(classificar(txt('Perfumaria Feminina')), 'sep')

    def test_tagline_e_separador(self):
        self.assertEqual(classificar(txt('Os melhores preços você encontra aqui...')), 'sep')

    def test_cada_e_separador(self):
        self.assertEqual(classificar(txt('Cada')), 'sep')

    def test_esgotado_tem_classe_propria(self):
        self.assertEqual(classificar(txt('ESGOTADO')), 'esgotado')

    def test_nome_de_produto(self):
        self.assertEqual(classificar(txt('KAIAK AVENTURA100 mlFloral aquoso.')), 'nome')

    def test_texto_curto_demais_e_descartado(self):
        self.assertEqual(classificar(txt('.')), 'outro')

    def test_texto_vazio_e_descartado(self):
        self.assertEqual(classificar(txt('   ')), 'outro')

    def test_nome_longo_com_marca_dentro_nao_vira_separador(self):
        # 'Natura' aparece, mas o texto e claramente um produto descrito.
        t = txt('DEO PARFUM ESSENCIAL OUD FEMININO 100 ml Amadeirado intenso da Natura')
        self.assertEqual(classificar(t), 'nome')

    def test_sobra_de_desconto_sem_de_por_e_descartada(self):
        # Fragmento de tabela de preco sem "De:"/"Por:" nao vira produto.
        self.assertEqual(classificar(txt('– 32%')), 'outro')

    def test_lista_de_precos_por_tamanho_e_descartada(self):
        self.assertEqual(
            classificar(txt('30,00 (120g) 35,00 (200g)')), 'outro')


class TestGerarId(unittest.TestCase):

    def test_gera_slug_sem_acento(self):
        self.assertEqual(gerar_id('Ekos Açaí', '100 ml', set()), 'ekos-acai-100-ml')

    def test_sem_tamanho(self):
        self.assertEqual(gerar_id('Kaiak Aero', None, set()), 'kaiak-aero')

    def test_desambigua_repetido(self):
        usados = set()
        a = gerar_id('Kaiak Aero', None, usados)
        b = gerar_id('Kaiak Aero', None, usados)
        self.assertEqual(a, 'kaiak-aero')
        self.assertEqual(b, 'kaiak-aero-2')

    def test_nome_sem_letras_vira_produto(self):
        self.assertEqual(gerar_id('!!!', None, set()), 'produto')


if __name__ == '__main__':
    unittest.main()
