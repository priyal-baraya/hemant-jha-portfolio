/**
 * categorizeReels.mjs
 * Assigns topic categories to all reels in the `videos` table based on title keywords.
 * Run: node src/migrations/categorizeReels.mjs
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Category rules (ordered — first match wins) ──────────────────────────────
// Each entry: [category, [...keywords]]  (case-insensitive)
// Extra catch-all rules for titles that didn't match the main rules
const EXTRA = [
  ['Health', [
    'pain diary', 'pain scale', 'pain rating', 'pain ratings', 'breakthrough pain',
    'dry mouth', 'mouth sores', 'nausea', 'side effect', 'medication tracking',
    'morphine', 'opioid', 'opioids', 'chemo brain', 'managing dry', 'managing mouth',
    'managing nausea', 'managing side', 'safe storage', 'pain medicine',
    'when to call', 'care team', 'unintentional weight', 'weight gain',
    'sedentary', 'rasayana', 'ayurved', 'gaming and child', 'child development',
    'investing time in kids', 'investment in children', 'kids',
    'important documents', 'organizing important', 'weight loss',
    'meaningful moment', 'meaningful conversation', 'life with kiss',
    'human battery', 'your strength',
  ]],
  ['Mental Health', [
    'legacy and life', 'life stories', 'living with uncertainty', 'uncertainty',
    'mindful moment', 'mindful pause', 'toxic positivity', 'scansiety',
    'sibling support', 'family crisis', 'meaningful', 'lessons from a street dog',
    'street dog', 'life simplified', 'transform yourself', 'transformation through',
    'the impact of borrowed', 'borrowed fear',
  ]],
  ['Leadership', [
    'non-deterministic', 'structured business', 'future engineer', 'unlocking hidden',
    'hidden knowledge', 'the human battery concept', 'legacy',
  ]],
];

const RULES = [
  ['AI', [
    'ai ', ' ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt', 'chatgpt',
    'openai', 'agent', 'automation', 'prompt', 'neural', 'deepmind',
    'borrowed vision', 'ai transformation', 'ai strategy', 'data scientist',
    'agentic', 'sdlc', 'copilot',
  ]],
  ['Leadership', [
    'leadership', 'leader', 'cto', 'ceo', 'executive', 'management', 'manager',
    'engineering manager', 'team building', 'delegation', 'strategy', 'culture',
    'decision making', 'decision-making', 'product sense', 'influence', 'persuasion',
    'feedback', 'performance review', 'hiring', 'firing',
    'stakeholder', 'vision', 'mission', 'okr', 'priority', 'prioriti',
    'power of listening', 'listening', 'presence', 'definition of expertise',
    'expertise', 'asking the right questions', 'personal bests to people',
    'evolving experience', 'hard conversations', 'communication',
  ]],
  ['Running', [
    'running', 'marathon', 'runner', 'race', 'pace', 'vo2', 'cadence', 'stride',
    'ultramarathon', 'trail', '5k', '10k', 'half marathon', 'finish line',
    'personal best', 'pb ', 'training plan',
  ]],
  ['Mental Health', [
    'depression', 'anxiety', 'mental health', 'grief', 'anticipatory grief', 'burnout',
    'stress', 'loneliness', 'lonely', 'isolation', 'trauma', 'ptsd', 'therapy',
    'therapist', 'suicide', 'self-harm', 'feeling like a burden', 'withdrawn',
    'withdrawal', 'supporting withdrawn', 'patient silence', 'emotional',
    'cope', 'coping', 'resilience', 'mindset', 'mindfulness', 'meditation',
    'understanding depression', 'accepting help', 'asking for help',
    'accepting reality', 'fear and freedom', 'freedom from fear',
    'celebration guilt', 'fear of recurrence', 'finding strength',
    'gratitude', 'hope and realism', 'realism', 'fear of loss',
    'milestones in recovery', 'celebrating milestones', 'celebrating small wins',
    'small wins', 'evolving experience',
  ]],
  ['Health', [
    'palliative', 'cancer', 'oncology', 'tumor', 'chemotherapy', 'hospice',
    'constipation', 'breathlessness', 'dyspnea', 'pain management', 'symptom',
    'caregiver', 'caregiving', 'end of life', 'terminal', 'prognosis', 'diagnosis',
    'chronic', 'disease', 'illness', 'patient', 'clinical', 'doctor', 'nurse',
    'hospital', 'medical', 'health', 'nutrition', 'diet', 'food', 'sleep',
    'exercise', 'fitness', 'gut', 'gut health', 'immune', 'inflammation',
    'hope when cure', 'quality of life', 'good day', 'cure is not possible',
    'burden', 'what do you say', 'say next', 'when was your last',
    'advance care planning', 'advanced care planning', 'acp',
    'difficulty swallowing', 'swallowing', 'communicating pain',
    'essential appointment', 'appointment', 'high protein', 'protein',
    'smoothie', 'snack', 'recovery', 'recurrence', 'survivor',
    'hope and realism in illness', 'accepting reality', 'milestones',
    'treatment', 'infusion', 'radiation', 'surgery', 'biopsy',
  ]],
  ['Career', [
    'career', 'job', 'jobs', 'resume', 'interview', 'salary', 'negotiation',
    'layoff', 'laid off', 'linkedin', 'networking',
    'upskill', 'reskill', 'freelance',
  ]],
  ['Technology', [
    'software', 'code', 'coding', 'developer', 'devops', 'cloud',
    'aws', 'azure', 'kubernetes', 'docker', 'api', 'database', 'system design',
    'architecture', 'microservice', 'startup', 'saas',
  ]],
];

function classify(title) {
  const t = (title || '').toLowerCase();
  for (const [category, keywords] of RULES) {
    if (keywords.some(kw => t.includes(kw))) return category;
  }
  for (const [category, keywords] of EXTRA) {
    if (keywords.some(kw => t.includes(kw))) return category;
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const pool = await mysql.createPool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const [rows] = await pool.query("SELECT id, name, category FROM videos WHERE category = 'reel' OR category IS NULL");
console.log(`\nLoaded ${rows.length} videos\n`);

// Bucket by proposed category
const updates = {};   // category -> [id, ...]
let skipped = 0;

for (const row of rows) {
  const cat = classify(row.name);
  if (!cat) { skipped++; continue; }
  if (!updates[cat]) updates[cat] = [];
  updates[cat].push(row.id);
}

// Preview
console.log('Category breakdown:');
for (const [cat, ids] of Object.entries(updates)) {
  console.log(`  ${cat.padEnd(16)} ${ids.length} reels`);
}
console.log(`  ${'(unmatched)'.padEnd(16)} ${skipped} reels (kept as-is)\n`);

// Apply updates
for (const [cat, ids] of Object.entries(updates)) {
  await pool.query('UPDATE videos SET category = ? WHERE id IN (?)', [cat, ids]);
  console.log(`✓ Set "${cat}" on ${ids.length} rows`);
}

await pool.end();
console.log('\nDone.');
