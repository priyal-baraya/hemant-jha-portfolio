# Reels Backend (minimal scaffold)

This backend provides a minimal scaffold to ingest reels from an S3 bucket, generate thumbnails and later upsert embeddings to Qdrant and metadata to Neo4j.

Quick start

1. Copy `.env.example` to `.env` and set credentials.
2. Install dependencies:

```bash
cd backend
npm install
```

3. Ensure `ffmpeg` is installed and in PATH.

4. Run the server:

```bash
npm run dev
```

5. Trigger S3 ingest (either via API or directly):

```bash
node ingest-s3.js
```

6. Run Phase 1 (transcribe -> chunk -> embeddings -> upsert to Qdrant):

```bash
npm run phase1
```

Next steps
- Add transcription (Whisper/OpenAI)
- Generate embeddings and upsert to Qdrant
- Create Neo4j nodes/relationships
- Implement `/api/search` to perform RAG with Qdrant + Neo4j
