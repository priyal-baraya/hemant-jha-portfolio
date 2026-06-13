import path from 'path';
import { generateThumbnail } from './utils/thumbnail.js';

const video = path.resolve('./data/videos/REEL_AI_001_GAMERS_AI_ERA_en.mp4');
const out = path.resolve('./data/thumbnails/REEL_AI_001_GAMERS_AI_ERA_en.mp4.jpg');

generateThumbnail(video, out).then(r => console.log('thumb saved:', r)).catch(err => { console.error('thumb error', err); process.exit(1); });
