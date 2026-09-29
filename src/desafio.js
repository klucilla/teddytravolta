// Desafio-relâmpago: o primeiro comentário que for o gatilho vence.

export const DESAFIOS = [
  { trigger: '🌹', anuncio: 'Desafio-relâmpago! O primeiro que mandar só o emoji de rosa no chat ganha um salve especial do Teddy!' },
  { trigger: 'TRAVOLTA', anuncio: 'Desafio-relâmpago! O primeiro que escrever só a palavra TRAVOLTA no chat ganha um salve especial!' },
  { trigger: '🕺', anuncio: 'Desafio! Manda só o emoji do dançarino no chat. O primeiro leva um salve do Teddy!' },
  { trigger: 'TEDDY', anuncio: 'Desafio! O primeiro que mandar só a palavra TEDDY no chat ganha um salve especial!' },
];

/**
 * O comentário vence se for SÓ o gatilho — maiúsculas, pontuação e repetição à parte
 * ("teddy!!!", "🌹🌹🌹"). Antes bastava conter: "boa noite Teddy!" vencia o desafio TEDDY
 * sem ninguém ter pedido, e o nome do urso é a palavra mais comum do chat.
 */
export function venceuDesafio(texto, gatilho) {
  const t = String(texto || '').normalize('NFKC');
  const g = String(gatilho || '').normalize('NFKC');
  if (!g) return false;

  if (/\p{L}/u.test(g)) {
    // Gatilho de palavra: compara só as letras (ignora espaço, pontuação e emoji)
    const letras = (s) => s.toLowerCase().replace(/[^\p{L}]/gu, '');
    return letras(t) === letras(g);
  }

  // Gatilho de emoji: o comentário precisa ser só esse emoji, uma ou mais vezes
  // (seletor de variação, ZWJ e tom de pele não contam)
  const ruido = /[\s︎️‍\u{1F3FB}-\u{1F3FF}]/gu;
  const semRuido = t.replace(ruido, '');
  const alvo = g.replace(ruido, '');
  return semRuido.length > 0 && semRuido.split(alvo).every((parte) => parte === '');
}
