import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const root = process.cwd();
const ffmpeg = ffmpegInstaller.path;
const slidesDir = path.join(root, 'docs', 'visuals', 'exports');
const audioDir = path.join(root, 'docs', 'visuals', 'audio');
const outputDir = path.join(root, 'docs', 'visuals', 'video');
const workDir = path.join(root, '.tmp', 'methodik-video');
const output = path.join(outputDir, 'methodik-grafikserie-youtube.mp4');

const slideCount = 8;
const width = 1920;
const height = 1080;

function run(args, label) {
  const result = spawnSync(ffmpeg, args, { stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`\n${label} failed`);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result;
}

function requireFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(root, filePath)}`);
  }
}

fs.mkdirSync(outputDir, { recursive: true });
fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });

const segments = [];
for (let index = 1; index <= slideCount; index += 1) {
  const slideNo = String(index).padStart(2, '0');
  const image = path.join(slidesDir, `methodik-slide-${slideNo}.png`);
  const audio = path.join(audioDir, `methodik-slide-${slideNo}.mp3`);
  const segment = path.join(workDir, `segment-${slideNo}.mp4`);
  requireFile(image);
  requireFile(audio);

  run([
    '-y',
    '-loop', '1',
    '-framerate', '30',
    '-i', image,
    '-i', audio,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-tune', 'stillimage',
    '-r', '30',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '48000',
    '-ac', '2',
    '-shortest',
    '-movflags', '+faststart',
    segment,
  ], `Rendering segment ${slideNo}`);

  segments.push(segment);
}

const concatFile = path.join(workDir, 'segments.txt');
fs.writeFileSync(
  concatFile,
  segments.map((segment) => `file '${segment.replaceAll("'", "'\\''")}'`).join('\n') + '\n',
  'utf8',
);

run([
  '-y',
  '-f', 'concat',
  '-safe', '0',
  '-i', concatFile,
  '-c', 'copy',
  '-movflags', '+faststart',
  output,
], 'Concatenating final video');

const stats = fs.statSync(output);
console.log(`Created ${path.relative(root, output)} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
console.log('Format: 1920x1080, H.264/AAC, YouTube-ready MP4');
