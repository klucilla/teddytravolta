# Changelog

**🇺🇸 English** · [🇧🇷 Português](#-português)

## v1.1.0 — 2026-09-29

A reliability release. The headline fix: **on a real live, v1.0.0 misread most TikTok
events** after `tiktok-live-connector` moved to a new event format (2.4). The simulator
emits already-normalized events, so it could not catch it.

### Fixed — real live
- **Event format of `tiktok-live-connector` 2.4** (TikTok protobuf v3):
  - Gifts come in `data.gift`. Combos were thanked on every repeat (~11 thank-yous for
    10 roses), and every gift was worth 1 coin: no jingle and no gold card for big gifts.
  - Chat text comes in `data.content`. Every comment arrived empty, so Teddy never
    answered the chat and flash challenges never had a winner.
  - The viewer count comes in `data.total`, so audience milestones never fired.
  - The like count comes in `data.count`, and every like batch counted as 1.
  - Both the new and the old formats are now read, and the library version is pinned.
- **Reconnection** kept only one try: if the live was still offline 10s after a drop,
  the bot stayed deaf for the rest of the night. It now retries with backoff (up to
  60s) until it reconnects. Messages replayed on reconnection are discarded, so gifts
  are not thanked twice.

### Fixed — robustness
- The queue could freeze forever. There was no timeout on Edge TTS, ffplay or the
  PowerShell player, and a corrupt MP3 made the PowerShell fallback wait forever. Every
  step now has a deadline.
- When Edge TTS was down, the whole announcement was dropped (card, scene and even the
  local jingle). Now only the spoken line is skipped.
- "0 disables" in `.env` didn't work: `Number(x) || default` turned 0 into the
  default. A negative `META_STEP` froze the process.
- The overlay WebSocket had no error handler (a malformed frame could crash the
  process) and accepted any website. It now only accepts its own page.
- A player left running after Ctrl+C is stopped. Unhandled promise rejections are
  logged.
- When the connection to OBS dropped in the middle of a celebration, OBS could stay
  stuck on the temporary scene. There was also a race that made Teddy talk on the
  dance scene.
- TTS cache:
  - a cache hit now refreshes the file date, so the most-used lines are not deleted
    every 14 days;
  - the chant is written to a temp file first, so an interrupted run no longer caches
    a truncated MP3;
  - leftover temp files are cleaned up.

### Fixed — moderation and chat
- Usernames were spoken with no filter. An offensive or spammy name now becomes
  "amigo".
- The LLM's reply now goes through the same filter before it is spoken. Comments are
  quoted safely in the prompt, and refusals are not spoken.
- The spam and profanity filter:
  - missed derived words ("seguidores", "inscreva-se", "whatsapp") and disguised ones
    ("p0rra", "p.o.r.r.a");
  - blocked innocent words ("viaduto").
- The username filter deleted digits ("DiscoFan42" → "DiscoFan"). Stylized letters are
  now normalized (𝓛𝓾𝓷𝓪 → Luna). Long digit runs (default `user8472910384` handles) become
  "amigo".
- `<think>` blocks from reasoning models were read aloud.
- Flash challenge:
  - "good night Teddy!" won the TEDDY challenge. Now only a comment that is *just* the
    trigger wins.
  - The window opens when Teddy announces the challenge, no longer before.
- Queue:
  - items expire by type, so a stale "welcome" doesn't show up minutes later;
  - there is one pending comment per person;
  - follow and share are thanked once per person, which also protects the followers
    goal from follow/unfollow loops.
- People joining the room no longer count as interaction, so Teddy strikes up
  conversation even when many people are joining.
- Likes are counted per person within a 5-minute window.
- When Ollama goes down, the LLM is paused for 30s instead of costing the full timeout
  on every event.

### Changed
- The bar scene shows a **martini**, so the line and the overlay no longer say
  "tequila" 🥃 (now 🍸).
- The overlay banner only promises what is enabled: chat replies, thanks for follows,
  the likes moonwalk.
- The flash-challenge card comes back after being covered by another card, while the
  challenge is still on.
- **Node.js 20+** is required (it was already a requirement of `tiktok-live-connector`
  2.4).
- The `LLM_TIMEOUT_MS` default is 8000 in the code, the same as `.env.example`. The
  unused `SIMULATOR_INTERVAL_MS` option was removed.

### Added
- `npm test`: automated tests (Node's built-in runner) for:
  - event mapping, checked against the **installed** schema;
  - reconnection;
  - moderation;
  - the queue, the challenge, the config and the overlay origin check.

## v1.0.0 — 2026-07-19

First public release.

---

## 🇧🇷 Português

## v1.1.0 — 2026-09-29

Versão de confiabilidade. A principal correção: **na live real, a v1.0.0 lia errado a
maioria dos eventos do TikTok** depois que a `tiktok-live-connector` passou a usar um
formato novo de evento (2.4). O simulador gera os eventos já normalizados e não tinha
como perceber.

### Corrigido — live real
- **Formato de evento da `tiktok-live-connector` 2.4** (protobuf v3 do TikTok):
  - O presente vem em `data.gift`. O combo era agradecido a cada repetição (uns 11
    "valeu" para 10 rosas), e todo presente valia 1 coin: presentão sem vinheta e sem
    card dourado.
  - O texto do chat vem em `data.content`. Todo comentário chegava vazio, então o Teddy
    nunca respondia o chat e o desafio nunca tinha vencedor.
  - A contagem de espectadores vem em `data.total`, e os marcos nunca disparavam.
  - A quantidade de likes vem em `data.count`, e cada lote contava como 1.
  - Agora o código lê o formato novo e o antigo, e a versão da biblioteca está fixada.
- **Reconexão** fazia uma tentativa só: se a live continuasse fora do ar 10s depois da
  queda, o bot ficava surdo pelo resto da noite. Agora tenta de novo com espera
  crescente (até 60s) até reconectar. As mensagens reenviadas na reconexão são
  descartadas, então nenhum presente é agradecido duas vezes.

### Corrigido — robustez
- A fila podia congelar para sempre. Não havia timeout no Edge TTS, no ffplay nem no
  player do PowerShell, e um MP3 corrompido deixava o fallback do PowerShell esperando
  para sempre. Agora toda etapa tem prazo.
- Com o Edge TTS fora do ar, o anúncio inteiro sumia (card, cena e até a vinheta
  local). Agora só a fala é pulada.
- O "0 desliga" do `.env` não funcionava: `Number(x) || padrão` trocava o 0 pelo
  padrão. Um `META_STEP` negativo travava o processo.
- O WebSocket do overlay não tratava erro (um frame malformado podia derrubar o
  processo) e aceitava qualquer site. Agora só aceita a própria página.
- O player que ficava tocando depois do Ctrl+C agora é encerrado. Promessas rejeitadas
  sem tratamento agora vão para o log.
- Se a conexão com o OBS caísse no meio de uma comemoração, o OBS podia ficar preso na
  cena temporária. Havia também uma corrida que fazia o urso falar na cena de dança.
- Cache de TTS:
  - o HIT renova a data do arquivo, então as frases mais usadas não são mais apagadas a
    cada 14 dias;
  - o bordão é gravado primeiro num arquivo temporário, então uma geração interrompida
    não guarda mais um MP3 truncado no cache;
  - os temporários que sobram são limpos.

### Corrigido — moderação e chat
- O apelido era falado sem filtro. Agora apelido ofensivo ou de spam vira "amigo".
- A resposta da IA passa pelo mesmo filtro antes de virar voz. O comentário vai
  delimitado com segurança no prompt, e as recusas do modelo não são faladas.
- O filtro de spam e palavrão:
  - deixava passar palavras derivadas ("seguidores", "inscreva-se", "whatsapp") e
    disfarçadas ("p0rra", "p.o.r.r.a");
  - barrava palavras inocentes ("viaduto").
- O filtro de nomes apagava dígitos ("DiscoFan42" → "DiscoFan"). Letras estilizadas
  agora são normalizadas (𝓛𝓾𝓷𝓪 → Luna). Sequências longas de dígitos (nomes padrão como
  `user8472910384`) viram "amigo".
- O bloco `<think>` de modelos raciocinadores era lido em voz alta.
- Desafio-relâmpago:
  - "boa noite Teddy!" vencia o desafio TEDDY. Agora só vence o comentário que é *só* o
    gatilho.
  - A janela abre quando o Teddy anuncia o desafio, não mais antes.
- Fila:
  - os itens vencem por tipo, então um "bem-vindo" velho não sai minutos depois;
  - há um comentário pendente por pessoa;
  - follow e share são agradecidos uma vez por pessoa, o que também protege a meta de
    seguidores do ciclo seguir e deixar de seguir.
- Entrar na sala não conta mais como interação, então o Teddy puxa papo mesmo com
  muita gente entrando.
- Os likes são contados por pessoa dentro de uma janela de 5 minutos.
- Com o Ollama fora do ar, a IA fica em pausa por 30s em vez de custar o timeout
  inteiro a cada evento.

### Mudado
- A cena do bar mostra um **martini**, então a fala e o overlay não dizem mais
  "tequila" 🥃 (agora é 🍸).
- O banner do overlay só promete o que está ligado: resposta no chat, agradecimento de
  follow, moonwalk por likes.
- O card do desafio-relâmpago volta à tela depois de ser coberto por outro card,
  enquanto o desafio ainda vale.
- Exige **Node.js 20+** (a `tiktok-live-connector` 2.4 já exigia).
- O padrão de `LLM_TIMEOUT_MS` passou a ser 8000 no código, igual ao `.env.example`. A
  opção `SIMULATOR_INTERVAL_MS`, que não era usada, foi removida.

### Adicionado
- `npm test`: testes automáticos (com o executor nativo do Node) para:
  - o mapeamento dos eventos, conferido contra o esquema **instalado**;
  - a reconexão;
  - a moderação;
  - a fila, o desafio, a configuração e a checagem de origem do overlay.

## v1.0.0 — 2026-07-19

Primeira versão pública.
