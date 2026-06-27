import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
dotenv.config();

const driver = neo4j.driver('neo4j://98.88.175.8:7687', neo4j.auth.basic('neo4j', 'Tata@1234567890'));
const session = driver.session({ database: 'neo4j' });

// What relationship types exist on SupportiveCareReel nodes?
const r1 = await session.run(`
  MATCH (r:SupportiveCareReel)-[rel]->(n)
  RETURN type(rel) AS relType, labels(n) AS targetLabels, count(*) AS cnt
  LIMIT 10
`);
console.log('Outgoing relationships:');
r1.records.forEach(r => console.log(' ', r.get('relType'), '->', r.get('targetLabels'), '|', r.get('cnt').toNumber()));

const r2 = await session.run(`
  MATCH (r:SupportiveCareReel)<-[rel]-(n)
  RETURN type(rel) AS relType, labels(n) AS sourceLabels, count(*) AS cnt
  LIMIT 10
`);
console.log('Incoming relationships:');
r2.records.forEach(r => console.log(' ', r.get('relType'), '<-', r.get('sourceLabels'), '|', r.get('cnt').toNumber()));

// Sample: reels related to a known non-oncology reel
const r3 = await session.run(`
  MATCH (r:SupportiveCareReel {reel_id: 'REEL_AI_001_GAMERS_AI_ERA'})-[rel]-(n)
  RETURN type(rel) AS relType, labels(n) AS nodeLabels, properties(n) AS props
  LIMIT 5
`);
console.log('\nRelationships for REEL_AI_001_GAMERS_AI_ERA:');
r3.records.forEach(r => console.log(' ', r.get('relType'), r.get('nodeLabels'), Object.keys(r.get('props'))));

await session.close();
await driver.close();
