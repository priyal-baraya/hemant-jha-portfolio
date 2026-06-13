import { runPhase1 } from './ingest-upsert.js';

runPhase1().then(r => {
  console.log('Phase1 result:', JSON.stringify(r, null, 2));
}).catch(err => {
  console.error('Phase1 failed:', err);
  process.exit(1);
});
