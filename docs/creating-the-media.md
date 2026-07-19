# 🎬 Creating your character's media

🇺🇸 English · **[🇧🇷 Português](criando-as-midias.md)**

This repository **does not distribute videos, music or images** — the character is
yours! This guide walks through the full process of creating every media asset with
AI tools, the same way the original Teddy Travolta was made.

> You can create ANY character (disco bear, singing alligator, DJ robot...).
> What matters is following the **master image** method to keep it consistent.

---

## The master image method (read this first)

The secret to keeping the character **identical across every video** — and making OBS
scene switches invisible — is a single idea:

1. Create **ONE official image** of the character (the "master image"), in vertical 9:16.
2. Generate **all** videos via *image-to-video* from it, using the image as both the
   **first AND last frame**. Every video then starts and ends in the same pose →
   perfect loops and imperceptible scene cuts.
3. Never generate video from text alone: the character would change on every generation.

---

## Step 1 — The master image (image generators)

Tools: Gemini (Nano Banana), Midjourney, or any image generator.

1. Generate the character in its setting (e.g. a 70s disco, LED dance floor, mirror balls).
2. TikTok LIVE is **vertical (9:16)**. If the image comes out horizontal, expand it with
   *outpainting*. Example prompt (Gemini):

   > Expand this image to vertical 9:16 format, keeping the character and everything
   > that already exists exactly as is, changing nothing about them. Complete the top
   > with the venue's ceiling and the bottom with the continuation of the floor.

3. Save it as `assets/videos/teddy.png` (or your character's name). **Guard it well:
   every future asset is born from this file.**

Tip: for scenes with a different setting (e.g. the bar), generate a **second master
image** from the first one: *"Using exactly the same character from this image, without
changing anything about them, create a new scene: the character standing at a retro 70s
bar counter, with a martini glass with an olive on the counter..."* — then use that
image as the first/last frame of the bar video. A camera cutaway looks far more natural
than asking the character to "walk to" a place that doesn't exist in the frame.

---

## Step 2 — The videos (Google Flow / Veo)

In [Google Flow](https://labs.google/flow) (requires a plan with video credits):

**Settings (the same for every video):**
- **Frames** mode (frames-to-video), with the master image in **both the first AND last**
  slots (the *Fast* variant doesn't accept a last frame — use **Veo Quality**)
- Aspect ratio **9:16** · Outputs **1x** (saves credits per attempt)

**Boilerplate that prevents the classic defects** — include it in EVERY prompt:

> The character's appearance must stay exactly identical to the reference image at all
> times — same face, fur, body size, proportions and clothes. Do not alter, morph, or
> restyle the character. Tripod shot, completely locked camera, absolutely no zoom,
> no push-in, no pull-out, no pan, no camera movement of any kind — the character stays
> at the same distance the entire time. Continuous, smooth motion with NO cuts, NO
> jumps, NO teleporting. He returns to his exact starting pose and position at the end.
> Do NOT add any closing effect, flash, fade-out, sparkle, transition, text or logo.
> Seamless loop.

**Prompts used for Teddy (adapt to your character):**

| Scene (file) | Action in the prompt |
|---|---|
| `danca_loop.mp4` | *"...dances disco in place: smooth groovy moves, finger pointing up then down, hips swaying to the beat. Background dancers keep moving, disco lights pulsing."* |
| `danca_loop2.mp4` | *"...does a smooth full spin, then strikes the classic one-arm-up pose, then relaxes, swaying to the beat."* |
| `danca_loop3.mp4` | *"...grooves in place: hips swaying side to side, shoulders bouncing, a couple of claps, finger snaps, full of 70s disco swagger."* |
| `comemoracao.mp4` | *"...bursts into celebration: jumps with joy, raises both arms in victory, then speaks excitedly straight to the camera with his mouth clearly moving, as if shouting a happy thank-you. Golden confetti falls, lights flash faster."* |
| `fala.mp4` | *"...stands relaxed and talks warmly straight to the camera, mouth clearly moving as if chatting with friends, small friendly hand gestures, gentle sway. No jumping, no confetti."* |
| `bar.mp4` | *(use the BAR master image)* *"...picks up the classic martini glass with an olive from the bar counter, raises it in a cheerful toast straight to the camera with a big smile, takes a happy sip, places the glass back."* |
| `boasvindas.mp4` | *"...greets a newcomer: smiles warmly, waves hello with one paw, then extends the arm to point welcomingly toward the camera with a friendly nod. Only his arms and upper body move."* |
| `moonwalk.mp4` | *"...performs a smooth Michael-Jackson-style moonwalk: glides backward a few steps with classic disco flair, then steps forward and returns to the exact center where he started."* |

**A moving mouth matters!** In scenes where the character "speaks" (celebration, talk),
ask for *mouth clearly moving* — when the TTS plays over it, the talking illusion is
convincing (the classic VTuber trick: the scene switches exactly when the voice starts).

**Checklist for every generated video:**
1. Does the character stay identical the whole video (no face "morphing")?
2. Did the camera stay truly locked (no zoom, not even mid-clip)?
3. Does start = end (does the loop close)?

If it fails #3 (or has a bad ending effect), the ffmpeg **ping-pong** fixes it (below).
If it fails #1 or #2, generate again — randomness changes on every attempt.

---

## Step 3 — Post-production (ffmpeg)

Install ffmpeg: `winget install Gyan.FFmpeg.Essentials`

**Strip the generator's audio + remove the watermark** (Veo/Gemini leave marks in the
bottom-right corner; the coordinates below are for 1080x1920 — adjust by inspecting a
frame):

```powershell
ffmpeg -i original.mp4 -an -vf "delogo=x=860:y=1700:w=115:h=125,delogo=x=955:y=1795:w=118:h=118" -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p danca_loop.mp4
```

> Stripping the audio is mandatory: Veo's generated sound would fight the TTS voice
> and the background music.

**Ping-pong loop** (when the video doesn't return to the starting pose, or has a bad
effect at the end — trim at the last good point, e.g. 6.2s, and the video plays
forward then in reverse, closing the cycle):

```powershell
ffmpeg -t 6.2 -i original.mp4 -filter_complex "[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[out]" -map "[out]" -an -c:v libx264 -crf 18 -pix_fmt yuv420p boasvindas.mp4
```

**Verify the loop** (extract the first and last frames and compare):

```powershell
ffmpeg -i video.mp4 -frames:v 1 first.png
ffmpeg -sseof -0.1 -i video.mp4 -frames:v 1 -update 1 last.png
```

---

## Step 4 — Music and jingle (Suno)

⚠️ **Copyright first:** a monetized live is commercial use. **Do not use well-known
music** — not even instrumentals/covers (the composition is protected; TikTok mutes or
takes down the live). Use music **you generated yourself** or royalty-free tracks.

**Background track** ([Suno](https://suno.com)):
- Style: `70s disco funk instrumental, four-on-the-floor beat, groovy bassline, wah-wah guitar, lush strings, energetic dancefloor vibe, no vocals`
- Check **Instrumental**. Generate 2-3 tracks and save them in `assets/musica/`.
- **License:** Suno's free plan is non-commercial; for a monetized live use a paid plan
  (commercial rights) — or [Pixabay Music](https://pixabay.com/music/) (free, including
  commercial use; search "disco funk").

**Big-gift sung jingle** (plays before the thank-you on 100+ coin gifts):
- Style: `1970s disco funk celebration stinger, big brass fanfare, funky bassline, party whistles, group of male singers chanting with falsetto harmonies, energetic, punchy`
- Lyrics (Custom mode): your character's name (e.g. `Teddy! Teddy! Teddy Travolta!`)
- Cut the strongest ~6 seconds and normalize the loudness:

```powershell
ffmpeg -ss 10 -t 6 -i "full-jingle.mp3" -af "afade=t=in:d=0.05,afade=t=out:st=5.4:d=0.6,loudnorm=I=-14:TP=-1.5" -q:a 3 assets/musica/jingle.mp3
```

---

## Expected final structure

```
assets/
├── videos/
│   ├── teddy.png          # master image (keep it for future scenes!)
│   ├── danca_loop.mp4     # required (add danca_loop2/3... for rotation)
│   ├── comemoracao.mp4    # required
│   ├── fala.mp4           # optional (comments/follows)
│   ├── bar.mp4            # optional (shares)
│   ├── boasvindas.mp4     # optional (joins)
│   └── moonwalk.mp4       # optional (likes + rotation)
└── musica/
    ├── (your track).mp3   # background music (plays in OBS)
    └── jingle.mp3         # big-gift jingle (JINGLE_FILE config)
```

The voice cache (`assets/audio/cache/`) is created automatically by the system.
