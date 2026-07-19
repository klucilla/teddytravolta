# 🎬 Criando as mídias do seu personagem

**[🇺🇸 English](creating-the-media.md)** · 🇧🇷 Português

Este repositório **não distribui vídeos, músicas nem imagens** — o personagem é seu!
Este guia mostra o processo completo para criar todas as mídias com ferramentas de IA,
do jeito que o Teddy Travolta original foi feito.

> Você pode criar QUALQUER personagem (urso disco, jacaré cantor, robô DJ...).
> O que importa é seguir o método da **imagem mestra** para manter a consistência.

---

## O método da imagem mestra (leia antes de tudo)

O segredo para o personagem ficar **idêntico em todos os vídeos** — e para as trocas
de cena do OBS ficarem invisíveis — é um só:

1. Crie **UMA imagem oficial** do personagem (a "imagem mestra"), em formato vertical 9:16.
2. Gere **todos** os vídeos por *image-to-video* a partir dela, usando a imagem como
   **primeiro E último quadro**. Assim, todo vídeo começa e termina na mesma pose →
   loop perfeito e cortes de cena imperceptíveis.
3. Nunca gere vídeo só por texto: o personagem mudaria a cada geração.

---

## Passo 1 — A imagem mestra (geradores de imagem)

Ferramentas: Gemini (Nano Banana), Midjourney, ou qualquer gerador de imagem.

1. Gere o personagem no cenário (ex.: boate anos 70, pista de LED, globos de espelho).
2. A live do TikTok é **vertical (9:16)**. Se a imagem sair horizontal, expanda com
   *outpainting*. Prompt de exemplo (Gemini):

   > Expanda esta imagem para o formato vertical 9:16, mantendo o personagem e tudo
   > que já existe exatamente como está, sem alterar nada dele. Complete a parte de
   > cima com o teto do cenário e a parte de baixo com a continuação do chão.

3. Salve como `assets/videos/teddy.png` (ou o nome do seu personagem). **Guarde bem:
   toda mídia futura nasce desse arquivo.**

Dica: para cenas com cenário diferente (ex.: o bar), gere uma **segunda imagem mestra**
a partir da primeira: *"Usando exatamente o mesmo personagem desta imagem, sem alterar
nada dele, crie uma nova cena: ele em pé junto a um balcão de bar retrô anos 70, com
uma taça de martini com azeitona sobre o balcão..."* — e use essa imagem como
primeiro/último quadro do vídeo do bar. Corte de câmera (cutaway) fica mais natural
do que pedir para o personagem "andar até" um lugar que não existe no quadro.

---

## Passo 2 — Os vídeos (Google Flow / Veo)

No [Google Flow](https://labs.google/flow) (requer plano com créditos de vídeo):

**Configuração (igual para todos os vídeos):**
- Modo **Frames** (quadros para vídeo), com a imagem mestra no **primeiro E no último** slot
  (a variante *Fast* não aceita último quadro — use **Veo Quality**)
- Proporção **9:16** · Saídas **1x** (economiza créditos por tentativa)

**Boilerplate que evita os defeitos clássicos** — inclua em TODO prompt (em inglês):

> The character's appearance must stay exactly identical to the reference image at all
> times — same face, fur, body size, proportions and clothes. Do not alter, morph, or
> restyle the character. Tripod shot, completely locked camera, absolutely no zoom,
> no push-in, no pull-out, no pan, no camera movement of any kind — the character stays
> at the same distance the entire time. Continuous, smooth motion with NO cuts, NO
> jumps, NO teleporting. He returns to his exact starting pose and position at the end.
> Do NOT add any closing effect, flash, fade-out, sparkle, transition, text or logo.
> Seamless loop.

**Prompts usados no Teddy (adapte ao seu personagem):**

| Cena (arquivo) | Ação no prompt |
|---|---|
| `danca_loop.mp4` | *"...dances disco in place: smooth groovy moves, finger pointing up then down, hips swaying to the beat. Background dancers keep moving, disco lights pulsing."* |
| `danca_loop2.mp4` | *"...does a smooth full spin, then strikes the classic one-arm-up pose, then relaxes, swaying to the beat."* |
| `danca_loop3.mp4` | *"...grooves in place: hips swaying side to side, shoulders bouncing, a couple of claps, finger snaps, full of 70s disco swagger."* |
| `comemoracao.mp4` | *"...bursts into celebration: jumps with joy, raises both arms in victory, then speaks excitedly straight to the camera with his mouth clearly moving, as if shouting a happy thank-you. Golden confetti falls, lights flash faster."* |
| `fala.mp4` | *"...stands relaxed and talks warmly straight to the camera, mouth clearly moving as if chatting with friends, small friendly hand gestures, gentle sway. No jumping, no confetti."* |
| `bar.mp4` | *(use a imagem mestra DO BAR)* *"...picks up the classic martini glass with an olive from the bar counter, raises it in a cheerful toast straight to the camera with a big smile, takes a happy sip, places the glass back."* |
| `boasvindas.mp4` | *"...greets a newcomer: smiles warmly, waves hello with one paw, then extends the arm to point welcomingly toward the camera with a friendly nod. Only his arms and upper body move."* |
| `moonwalk.mp4` | *"...performs a smooth Michael-Jackson-style moonwalk: glides backward a few steps with classic disco flair, then steps forward and returns to the exact center where he started."* |

**Boca mexendo importa!** Nas cenas em que o personagem "fala" (comemoração, fala),
peça *mouth clearly moving* — quando o TTS tocar junto, a ilusão de fala é convincente
(o truque clássico de VTuber: a cena troca exatamente quando a voz começa).

**Checklist ao receber cada vídeo:**
1. O personagem continua idêntico o vídeo todo (sem "morphing" no rosto)?
2. A câmera ficou realmente travada (sem zoom, nem no meio)?
3. Começo = fim (loop fecha)?

Se falhar no 3 (ou tiver efeito ruim no final), o **ping-pong** do ffmpeg resolve
(abaixo). Se falhar no 1 ou 2, gere de novo — a aleatoriedade muda a cada tentativa.

---

## Passo 3 — Pós-produção (ffmpeg)

Instale o ffmpeg: `winget install Gyan.FFmpeg.Essentials`

**Remover o áudio do gerador + a marca d'água** (Veo/Gemini deixam marcas no canto
inferior direito; as coordenadas abaixo valem para 1080x1920 — ajuste olhando um frame):

```powershell
ffmpeg -i original.mp4 -an -vf "delogo=x=860:y=1700:w=115:h=125,delogo=x=955:y=1795:w=118:h=118" -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p danca_loop.mp4
```

> Remover o áudio é obrigatório: o som gerado pelo Veo brigaria com a voz TTS e a música.

**Loop ping-pong** (quando o vídeo não volta à pose inicial, ou tem efeito ruim no fim —
corte no último ponto bom, ex. 6.2s, e o vídeo toca e volta de ré, fechando o ciclo):

```powershell
ffmpeg -t 6.2 -i original.mp4 -filter_complex "[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[out]" -map "[out]" -an -c:v libx264 -crf 18 -pix_fmt yuv420p boasvindas.mp4
```

**Verificar o loop** (extraia o primeiro e o último frame e compare):

```powershell
ffmpeg -i video.mp4 -frames:v 1 inicio.png
ffmpeg -sseof -0.1 -i video.mp4 -frames:v 1 -update 1 fim.png
```

---

## Passo 4 — Música e vinheta (Suno)

⚠️ **Direitos autorais primeiro:** a live monetizada é uso comercial. **Não use música
conhecida** — nem instrumental/cover (a composição é protegida; o TikTok silencia ou
derruba a live). Use música **original gerada por você** ou royalty-free.

**Trilha de fundo** ([Suno](https://suno.com)):
- Estilo: `70s disco funk instrumental, four-on-the-floor beat, groovy bassline, wah-wah guitar, lush strings, energetic dancefloor vibe, no vocals`
- Marque **Instrumental**. Gere 2-3 faixas e salve em `assets/musica/`.
- **Licença:** no plano gratuito do Suno o uso é não-comercial; para live monetizada,
  use o plano pago (direitos comerciais) — ou [Pixabay Music](https://pixabay.com/music/)
  (grátis, inclusive comercial; busque "disco funk").

**Vinheta cantada dos presentões** (toca antes do agradecimento em presentes de 100+ coins):
- Estilo: `1970s disco funk celebration stinger, big brass fanfare, funky bassline, party whistles, group of male singers chanting with falsetto harmonies, energetic, punchy`
- Letra (modo Custom): o nome do seu personagem (ex.: `Teddy! Teddy! Teddy Travolta!`)
- Corte os ~6 segundos mais fortes e normalize o volume:

```powershell
ffmpeg -ss 10 -t 6 -i "vinheta-completa.mp3" -af "afade=t=in:d=0.05,afade=t=out:st=5.4:d=0.6,loudnorm=I=-14:TP=-1.5" -q:a 3 assets/musica/jingle.mp3
```

---

## Estrutura final esperada

```
assets/
├── videos/
│   ├── teddy.png          # imagem mestra (guarde para cenas futuras!)
│   ├── danca_loop.mp4     # obrigatório (pode ter danca_loop2/3... p/ rodízio)
│   ├── comemoracao.mp4    # obrigatório
│   ├── fala.mp4           # opcional (comentários/follows)
│   ├── bar.mp4            # opcional (compartilhamentos)
│   ├── boasvindas.mp4     # opcional (entradas)
│   └── moonwalk.mp4       # opcional (likes + rodízio)
└── musica/
    ├── (sua trilha).mp3   # música de fundo (toca no OBS)
    └── jingle.mp3         # vinheta dos presentões (config JINGLE_FILE)
```

O cache de vozes (`assets/audio/cache/`) é criado automaticamente pelo sistema.
