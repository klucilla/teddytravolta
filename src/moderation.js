// Moderação determinística (não depende da IA): barra links, spam e palavrões.
// Vale para tudo que o Teddy pode falar em voz alta: o comentário que entra, a resposta
// que a IA gera e o apelido de quem interage — o apelido do TikTok é texto livre, e sem
// filtro virava "Valeu por seguir, <palavrão>!" na voz e no card do overlay.

const URL_RE = /(https?:\/\/|www\.|\b[\w-]+\.(com|net|org|io|br|xyz|shop|link|me|tv|app|gg|site|online|store)\b)/i;

// Rodam sobre o texto normalizado (minúsculo, sem acento, sem leetspeak), então os padrões
// são escritos sem acento. Cada termo casa as formas derivadas de propósito: o filtro antigo
// terminava em \b e deixava passar "seguidores", "inscreva-se", "whatsapp", "promoção".
const SPAM_RE = new RegExp(
  [
    '\\binscrev\\w*',
    '\\bpromo(cao|coes)?\\b',
    '\\bdescontos?\\b',
    '\\bcupo(m|ns)\\b',
    '\\bfrete\\s*gratis',
    '\\btelegram',
    '\\bwhats\\s*app',
    '\\bwhats\\b',
    '\\bzap\\s*zap',
    '\\bpix\\b',
    '\\blink\\s+na\\s+bio',
    '\\bganh[ae]\\w*\\s+seguidor',
    '\\bcompr[ae]\\w*\\s+(seguidor|curtida|like|view|visualizac)',
    '\\bseguidor\\w*\\s+(gratis|barat|reais)',
    '\\b(sig[ao]\\w*|segue)\\s+@',
  ].join('|'),
  'i'
);

// "viad[oa]s?\b" em vez de "viad": o prefixo solto barrava "passei pelo viaduto".
const PROFANIDADE_RE = new RegExp(
  [
    '\\bmerd\\w*',
    '\\bporra\\w*',
    '\\bcaralh\\w*',
    '\\bput[ao]\\w*',
    '\\bfdp\\b',
    '\\bpqp\\b',
    '\\bvsf\\b',
    '\\bviad[oa]s?\\b',
    '\\bviadinh\\w*',
    '\\bcuzao\\b',
    '\\bbuceta\\w*',
    '\\bpiroca\\w*',
    '\\bvai\\s+se\\s+f[ou]d\\w*',
    '\\bfoder\\b',
    '\\bfoda\\s*-?\\s*se\\b',
    '\\barrombad\\w*',
    '\\bcorn[oa]s?\\b',
    '\\btraveco\\w*',
    '\\bretardad\\w*',
  ].join('|'),
  'i'
);

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };

const semAcento = (texto) =>
  String(texto || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Versão "desmascarada": sem leetspeak ("p0rra", "put@") e sem pontuação entre letras
 * ("p.o.r.r.a"). Só serve para os filtros — nunca é exibida.
 */
const desmascarar = (texto) =>
  semAcento(texto)
    .replace(/[013457@$]/g, (c) => LEET[c])
    .replace(/(\p{L})[._*-]+(?=\p{L})/gu, '$1');

/** true se o texto tem link, spam ou palavrão e não deve ir para a voz nem para o overlay. */
export function textoBloqueado(texto) {
  const bruto = String(texto || '');
  if (!bruto.trim()) return false;
  if (URL_RE.test(bruto)) return true; // no texto original: as outras formas apagam os pontos
  // As duas formas: a desmascarada pega "p0rra", mas troca o "@" de "segue @loja" por "a"
  const formas = [semAcento(bruto), desmascarar(bruto)];
  return formas.some((f) => SPAM_RE.test(f) || PROFANIDADE_RE.test(f));
}
