"""Converte os blocos de preco do catalogo Word em numeros."""
import re

RE_DE = re.compile(r'De\s*:?\s*(?:R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})', re.I)
RE_POR = re.compile(r'Por\s*:?\s*(?:R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})', re.I)
RE_DESCONTO = re.compile(r'[–—\-]\s*(\d{1,3})\s*%')
RE_CADA = re.compile(r'\bcada\b', re.I)


def _numero(texto):
    """'1.299,90' -> 1299.90"""
    return float(texto.replace('.', '').replace(',', '.'))


def parse_preco(texto):
    """Extrai preco de tabela, desconto e preco final.

    Retorna None se o texto nao contiver nenhum valor monetario.
    """
    if not texto:
        return None

    m_de = RE_DE.search(texto)
    m_por = RE_POR.search(texto)
    if not m_de and not m_por:
        return None

    m_desc = RE_DESCONTO.search(texto)
    return {
        'preco_de': _numero(m_de.group(1)) if m_de else None,
        'desconto': int(m_desc.group(1)) if m_desc else None,
        'preco_por': _numero(m_por.group(1)) if m_por else None,
        'cada': bool(RE_CADA.search(texto)),
    }
