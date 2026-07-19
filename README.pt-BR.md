# 🐻🕺 Teddy Travolta Live

**[🇺🇸 English](README.md)** · 🇧🇷 Português

**Live interativa para TikTok com um personagem de IA que reage ao público em tempo real.**

<p align="center">
  <img src="docs/media/challenge.jpg" width="270" alt="Overlay em ação: card do desafio-relâmpago, barra de meta e banner de instruções sobre o urso dançando">
</p>
<!-- DEMO: GIF animado + mais fotos de ação em breve (regenerados no modo simulador) -->

Um urso de pelúcia estilo *Saturday Night Fever* dança numa boate anos 70 e:

- 🔊 **Agradece presentes pelo nome**, com voz em português (TTS gratuito, sem API key)
- 💬 **Responde os comentários do chat por voz**, usando IA local (Ollama)
- 🎬 **Troca de cena no OBS sozinho** — comemora, conversa, brinda no bar, faz moonwalk
- ✨ **Overlay animado** com cards de agradecimento, metas e desafios pro público

> Este repositório traz **todo o código** do sistema. Os vídeos, músicas e imagens do
> personagem **não são distribuídos** — você cria os seus com ferramentas de IA seguindo
> o guia [docs/criando-as-midias.md](docs/criando-as-midias.md). Sirva-se do método e
> crie o SEU personagem!

---

## Como funciona

```
TikTok Live ──► tiktok.js ──► queue.js (fila com prioridade) ──┬─► TTS + áudio (Edge TTS)
   (eventos)                  presente > comentário > share...  ├─► OBS (troca de cenas)
                                                                └─► Overlay (cards/metas)
```

Tudo passa por uma **fila sequencial**: um agradecimento por vez, os áudios nunca se
sobrepõem, e a cena temporária só volta para a dança quando a fala termina (a boca do
personagem no vídeo se mexe junto com a voz — ilusão de fala estilo VTuber).

| Evento na live | Reação do Teddy |
|---|---|
| 🎁 Presente pequeno (1–99 coins) | Frase curta + cena de comemoração |
| 🎁 Presente grande (100+ coins) | **Vinheta cantada** + frase longa + card dourado pulsante |
| 💬 Comentário | Resposta por voz gerada pela IA local (com moderação automática) |
| ➕ Follow | Boas-vindas ao time, cena de conversa |
| 🔁 Compartilhamento | Brinde de martini na cena do bar |
| ❤️ Rajada de likes | Moonwalk |
| 👋 Entrada na sala | Boas-vindas (com freio configurável) |
| 👥 Marcos de audiência | "Já somos X na pista!" |
| 😴 Ninguém interagindo | O Teddy puxa papo sozinho (IA) |
| 🎯 Meta da live batida | Comemoração + barra de progresso no overlay |
| ⚡ Desafio-relâmpago | "O 1º que mandar 🌹 no chat ganha um salve!" — e o vencedor ganha mesmo |

## Stack

- **Node.js 18+** (ESM) · [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector) (eventos da live)
- **msedge-tts** — voz pt-BR gratuita (Edge TTS, sem API key)
- **obs-websocket-js v5** — controle do OBS · **express + ws** — overlay
- **ffmpeg/ffplay** — áudio e pós-produção de vídeo
- **Ollama** *(opcional)* — IA local para frases variadas e respostas ao chat

## Requisitos

- Windows 10/11 (o player de áudio usa ffplay com fallback nativo do Windows)
- [Node.js 18+](https://nodejs.org)
- [OBS Studio 30+](https://obsproject.com) (WebSocket já vem embutido)
- ffmpeg: `winget install Gyan.FFmpeg.Essentials`
- *(Opcional)* [Ollama](https://ollama.com) com `ollama pull qwen2.5:7b-instruct`

## Instalação

```powershell
git clone https://github.com/klucilla/teddytravolta.git
cd teddytravolta
npm install
Copy-Item .env.example .env
# edite o .env (usuário do TikTok, senha do OBS, flags)
```

## 1) Crie as mídias do seu personagem

O repositório não inclui vídeos/músicas/imagens. Siga o guia completo:

➡️ **[docs/criando-as-midias.md](docs/criando-as-midias.md)** — imagem mestra,
prompts prontos para o Google Flow/Veo (com as travas anti-zoom e anti-morphing),
pós-produção com ffmpeg (marca d'água, loop ping-pong) e música/vinheta no Suno.

Ao final você terá `assets/videos/*.mp4` e `assets/musica/*.mp3`.

## 2) Configure o OBS

**Vídeo vertical:** Configurações → Vídeo → Base e Saída = `1080x1920`.

**Cenas** (os nomes são configuráveis no `.env`):

| Cena | Vídeo | Uso |
|---|---|---|
| `danca_loop` | danca_loop.mp4 | Padrão (fica no ar; com `danca_loop2/3` o sistema alterna sozinho) |
| `comemoracao` | comemoracao.mp4 | Presentes, metas e marcos |
| `fala` | fala.mp4 | Comentários, follows e falas de engajamento |
| `bar` | bar.mp4 | Compartilhamentos |
| `boasvindas` | boasvindas.mp4 | Entradas na sala |
| `moonwalk` | moonwalk.mp4 | Rajadas de likes (+ rodízio de dança, se listado em `OBS_SCENE_DANCE`) |

Para **cada cena**: `+` em Fontes → **Fonte de mídia** com o vídeo (**Repetir** ✔) →
**Navegador** com `http://localhost:3000` (1080×1920, acima do vídeo; use *Adicionar
existente* a partir da segunda cena).

**Música de fundo:** Fonte de mídia `musica` com seu MP3 — **Repetir** ✔ e
**desmarque** "Reiniciar reprodução quando a fonte ficar ativa" (é o que faz a música
atravessar as trocas de cena sem recomeçar). Adicione a mesma fonte em todas as cenas,
no fundo da lista, com volume ~-18 dB no mixer.

**WebSocket:** Ferramentas → Configurações do Servidor WebSocket → **Ativar** →
copie a senha para `OBS_PASSWORD` no `.env`.

> Se o OBS estiver fechado, o sistema continua funcionando (áudio + overlay) e
> reconecta sozinho a cada 5s.

## 3) Rode

**Simulador (teste sem live) — comece por aqui:**

```powershell
npm run simulador
```

Gera uma live falsa completa: presentes, comentários, entradas, rajadas, momentos
calmos, marcos de audiência. Você ouve o personagem, vê as cenas trocando e os cards
no overlay — sem precisar estar ao vivo.

**Live real:**

1. No `.env`: `SIMULATOR=false` e `TIKTOK_USERNAME=seu_usuario` (sem @)
2. Inicie a live no TikTok (o conector precisa da live aberta)
3. `npm start`

**Transmitindo para o TikTok:** se sua conta tem acesso RTMP, pegue a chave em
`livecenter.tiktok.com/producer` (ela muda a cada transmissão) e use em OBS →
Configurações → Transmissão → Personalizado. Sem chave, o plano B é o **TikTok LIVE
Studio**: no OBS clique em *Iniciar câmera virtual* e, no LIVE Studio, adicione a
câmera "OBS Virtual Camera" (1080×1920) com captura do som do sistema.

## IA local (opcional, recomendada)

Com `LLM_ENABLED=true` e o Ollama rodando (`qwen2.5:7b-instruct`):

- **Frases variadas**: cada agradecimento é único, no personagem (nada de lista repetida)
- **Chat com voz**: o Teddy responde comentários — com **moderação em duas camadas**
  (filtro determinístico barra links/spam/palavrões antes da IA) e freio configurável
- **Falas de engajamento**: nos momentos parados, ele puxa papo com o público
- O modelo é pré-aquecido no start e mantido em memória (`LLM_KEEP_ALIVE`); se o
  Ollama cair, tudo volta ao fallback de frases fixas sem quebrar

## Configuração (.env)

Veja o [.env.example](.env.example) — todas as opções estão comentadas. Destaques:

| Variável | O que faz |
|---|---|
| `SIMULATOR` | `true` = live falsa para testar tudo |
| `OBS_SCENE_DANCE` | Uma ou várias cenas de dança separadas por vírgula (rodízio automático) |
| `WELCOME_EVERY` | Boas-vindas a cada N entradas (evita metralhadora de "bem-vindo") |
| `LIKES_THRESHOLD` | Likes acumulados por pessoa para disparar o moonwalk |
| `META_TYPE` / `META_TARGET` | Meta da live (seguidores ou coins) com barra no overlay |
| `CHALLENGE_EVERY_MIN` | Frequência do desafio-relâmpago |
| `LLM_*` | IA local: modelo, timeouts, moderação de comentários |

## ⚠️ Avisos importantes

- **Política do TikTok sobre conteúdo pré-gravado:** lives compostas só de vídeo em
  loop podem ser penalizadas (presentes suspensos / alcance restrito). Este sistema
  mitiga com respostas de IA ao vivo, rodízio de cenas e eventos dinâmicos — mas a
  melhor defesa é **participar da live de verdade** (falar ao microfone, interagir).
  Use por sua conta e risco, respeitando as diretrizes da plataforma.
- **Direitos autorais de música:** live monetizada = uso comercial. Não use músicas
  conhecidas (nem instrumentais/covers). Gere trilhas originais (Suno com plano
  comercial) ou use royalty-free (Pixabay Music).
- **Local por padrão:** o servidor do overlay escuta só em `127.0.0.1` (defina
  `OVERLAY_HOST` apenas se o OBS rodar em outra máquina da sua rede). **Nunca
  exponha o WebSocket do OBS (porta 4455) à internet**, e mantenha seu `.env`
  privado — ele guarda a senha do OBS. Veja o [SECURITY.md](SECURITY.md).
- Este projeto não é afiliado ao TikTok. A API de eventos usada pela
  `tiktok-live-connector` não é oficial e pode mudar sem aviso.

## Solução de problemas

| Problema | Solução |
|---|---|
| Sem áudio | Confira o dispositivo de saída padrão do Windows; rode `npm run test:tts` |
| `OBS indisponível (ECONNREFUSED)` | OBS fechado ou WebSocket desativado |
| Não conecta na live | A live precisa estar **ao vivo**; confira o `TIKTOK_USERNAME` (sem @) |
| Overlay em branco no OBS | Rode o sistema antes, ou botão direito na fonte → **Atualizar** |
| Comentários ignorados pela IA | Ollama fechado ou modelo frio — veja `LLM_TIMEOUT_MS`/`LLM_KEEP_ALIVE` |
| Likes não disparam o moonwalk | O TikTok envia eventos de like de forma imprevisível (limitação da plataforma) — por isso o moonwalk também entra no rodízio de danças |

## Testes individuais

```powershell
npm run test:tiktok   # simulador de eventos (sem áudio)
npm run test:tts      # gera e cacheia um áudio
npm run test:queue    # fila completa: eventos -> TTS -> áudio
npm run test:obs      # conexão/reconexão com o OBS
```

## Licença

[MIT](LICENSE) — use, adapte e crie o seu personagem. 🕺

---

Feito com Node.js, ffmpeg, muita IA generativa e amor pela pista de dança. 🪩
