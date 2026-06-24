import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
export const REEL_TEMP_DIR = path.join(__dirname, '../../data/reel-temp');
export const REEL_OUT_DIR  = path.join(__dirname, '../../data/videos');

export const wrapCaption = (text, maxChars = 26) => {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) { line = candidate; }
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.join('\n');
};

export const ffmpeg = (args, cwd) => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], {
    stdio: 'pipe', maxBuffer: 64 * 1024 * 1024, ...(cwd ? { cwd } : {}),
  });
  if (result.error) throw new Error(`ffmpeg spawn failed: ${result.error.message}`);
  if (result.status !== 0) {
    const stderr = (result.stderr?.toString() || '').trim();
    throw new Error(`ffmpeg error:\n${stderr || `exit ${result.status}`}`);
  }
};

export const getAudioDuration = (audioPath) => {
  const result = spawnSync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_streams', audioPath], { stdio: 'pipe' });
  try { return parseFloat(JSON.parse(result.stdout.toString()).streams[0]?.duration) || 3.5; } catch { return 3.5; }
};

const FONT_CANDIDATES = [
  'C:\\Windows\\Fonts\\arialbd.ttf',
  'C:\\Windows\\Fonts\\arial.ttf',
  'C:\\Windows\\Fonts\\DejaVuSans-Bold.ttf',
  'C:\\Windows\\Fonts\\DejaVuSans.ttf',
];

export async function renderReel({ topic, slides, azureImageClient, openai }) {
  const videoId = `rs_${Date.now()}`;
  const tempDir = path.join(REEL_TEMP_DIR, videoId);
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(REEL_OUT_DIR, { recursive: true });

  const ROLES = ['Hook', 'Problem', 'Insight', 'Takeaway', 'CTA'];

  try {
    const clipPaths = [];

    for (let i = 0; i < slides.length; i++) {
      const caption   = slides[i].caption;
      const role      = ROLES[i] || `Slide ${i + 1}`;
      const imgFile   = `slide_${i}.png`;
      const imgPath   = path.join(tempDir, imgFile);
      const audioFile = `audio_${i}.mp3`;
      const audioPath = path.join(tempDir, audioFile);
      const clipFile  = `clip_${i}.mp4`;

      // A: Generate image
      const imagePrompt = [
        `Professional LinkedIn thought-leadership reel visual, slide ${i + 1} of 5 (role: ${role}).`,
        `Topic: "${topic}".`,
        `The image should visually represent the idea: "${caption}".`,
        'Style: cinematic, editorial photography or bold abstract illustration.',
        'Dark, premium feel — deep navy, slate, or near-black background.',
        'Subtle purple or gold accent tones. Clean, no clutter.',
        'NO text, NO words, NO letters anywhere in the image.',
        'Portrait 9:16 aspect ratio. Leave the bottom 30% relatively uncluttered for caption overlay.',
      ].join(' ');

      let imageGenerated = false;
      if (azureImageClient) {
        try {
          const imgRes = await azureImageClient.images.generate({
            model: process.env.AZURE_IMAGE_DEPLOYMENT || 'gpt-image-1.5',
            prompt: imagePrompt, size: '1024x1536', n: 1,
          });
          const b64 = imgRes.data[0].b64_json;
          if (!b64) throw new Error('No b64_json in Azure image response');
          fs.writeFileSync(imgPath, Buffer.from(b64, 'base64'));
          imageGenerated = true;
        } catch (err) { console.warn(`[reel-studio] Azure image failed slide ${i}: ${err.message}`); }
      }

      if (!imageGenerated) {
        ffmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=0x0f172a:size=1080x1920:rate=1', '-vframes', '1', imgFile], tempDir);
      }

      // B: TTS voiceover
      try {
        const tts = await openai.audio.speech.create({ model: 'tts-1', voice: 'onyx', input: caption, speed: 0.92 });
        fs.writeFileSync(audioPath, Buffer.from(await tts.arrayBuffer()));
      } catch (err) {
        console.warn(`[reel-studio] TTS failed slide ${i}: ${err.message}`);
        ffmpeg(['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '3.5', '-c:a', 'libmp3lame', audioFile], tempDir);
      }

      const duration = getAudioDuration(audioPath) + 0.4;

      // C: Caption overlay
      const captionFile = `caption_${i}.txt`;
      fs.writeFileSync(path.join(tempDir, captionFile), wrapCaption(caption), 'utf8');

      let fontParam = '';
      const localFontName = `font_${i}.ttf`;
      for (const candidate of FONT_CANDIDATES) {
        if (fs.existsSync(candidate)) {
          fs.copyFileSync(candidate, path.join(tempDir, localFontName));
          fontParam = `fontfile=${localFontName}:`;
          break;
        }
      }

      const bandH = 400;
      const bandY = `ih-${bandH}`;
      const textY = `h-${bandH}+(${bandH}-th)/2`;
      const vf = [
        'scale=1080:1920:force_original_aspect_ratio=decrease',
        'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0f172a',
        `drawbox=y=${bandY}:w=iw:h=${bandH}:color=black@0.6:t=fill`,
        `drawtext=textfile=${captionFile}:${fontParam}fontcolor=white:fontsize=48:` +
        `x=(w-tw)/2:y=${textY}:line_spacing=16:shadowcolor=black@0.9:shadowx=2:shadowy=2`,
      ].join(',');

      ffmpeg([
        '-y', '-loop', '1', '-i', imgFile, '-i', audioFile,
        '-c:v', 'libx264', '-c:a', 'aac', '-b:a', '128k',
        '-t', String(duration), '-pix_fmt', 'yuv420p', '-r', '30',
        '-vf', vf, '-shortest', clipFile,
      ], tempDir);

      clipPaths.push(clipFile);
    }

    // D: Concatenate
    const listFile = 'list.txt';
    fs.writeFileSync(path.join(tempDir, listFile), clipPaths.map(f => `file '${f}'`).join('\n'));
    const outPath = path.join(REEL_OUT_DIR, `${videoId}.mp4`);
    ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:v', 'libx264', '-c:a', 'aac', '-preset', 'fast', '-pix_fmt', 'yuv420p', outPath], tempDir);

    fs.rmSync(tempDir, { recursive: true, force: true });
    return { videoId, previewUrl: `/videos/${videoId}.mp4` };
  } catch (err) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw err;
  }
}
