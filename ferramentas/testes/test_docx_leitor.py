import unittest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from docx_leitor import remover_fallback, extrair_tokens_do_xml


class TestRemoverFallback(unittest.TestCase):

    def test_remove_bloco_fallback(self):
        xml = ('<a><mc:AlternateContent><mc:Choice><w:t>bom</w:t></mc:Choice>'
               '<mc:Fallback><w:t>bom</w:t></mc:Fallback>'
               '</mc:AlternateContent></a>')
        r = remover_fallback(xml)
        self.assertIn('bom', r)
        self.assertEqual(r.count('bom'), 1)

    def test_remove_multiplos_fallbacks(self):
        xml = ('<mc:Fallback>a</mc:Fallback>x<mc:Fallback>b</mc:Fallback>')
        self.assertEqual(remover_fallback(xml), 'x')

    def test_xml_sem_fallback_fica_intacto(self):
        xml = '<w:t>oi</w:t>'
        self.assertEqual(remover_fallback(xml), xml)


class TestExtrairTokens(unittest.TestCase):

    def _xml(self):
        return (
            '<w:document>'
            '<wp:anchor><wp:positionH><wp:posOffset>1000</wp:posOffset></wp:positionH>'
            '<wp:positionV><wp:posOffset>2000</wp:posOffset></wp:positionV>'
            '<wp:extent cx="500000" cy="400000"/>'
            '<a:blip r:embed="rId5"/></wp:anchor>'
            '<w:txbxContent><w:p><w:r><w:t>KAIAK</w:t></w:r>'
            '<w:r><w:t> AERO</w:t></w:r></w:p></w:txbxContent>'
            '<w:lastRenderedPageBreak/>'
            '<w:txbxContent><w:p><w:t>Por: R$ 20,00</w:t></w:p></w:txbxContent>'
            '</w:document>')

    def test_retorna_tokens_em_ordem(self):
        t = extrair_tokens_do_xml(self._xml(), {'rId5': 'media/image1.png'})
        self.assertEqual([x['tipo'] for x in t], ['img', 'txt', 'txt'])

    def test_imagem_traz_caminho_e_coordenadas(self):
        t = extrair_tokens_do_xml(self._xml(), {'rId5': 'media/image1.png'})
        img = t[0]
        self.assertEqual(img['valor'], 'media/image1.png')
        self.assertEqual(img['x'], 1000)
        self.assertEqual(img['y'], 2000)
        self.assertEqual(img['largura'], 500000)
        self.assertEqual(img['altura'], 400000)

    def test_runs_do_mesmo_paragrafo_sao_concatenados(self):
        t = extrair_tokens_do_xml(self._xml(), {'rId5': 'media/image1.png'})
        self.assertEqual(t[1]['valor'], 'KAIAK AERO')

    def test_pagina_incrementa_na_quebra(self):
        t = extrair_tokens_do_xml(self._xml(), {'rId5': 'media/image1.png'})
        self.assertEqual(t[1]['pagina'], 1)
        self.assertEqual(t[2]['pagina'], 2)

    def test_caixa_de_texto_vazia_e_ignorada(self):
        xml = '<w:document><w:txbxContent><w:p><w:t>  </w:t></w:p></w:txbxContent></w:document>'
        self.assertEqual(extrair_tokens_do_xml(xml, {}), [])


if __name__ == '__main__':
    unittest.main()
