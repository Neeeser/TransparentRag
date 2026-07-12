<div align="center">

# Ragworks

### Follow every document from upload to answer.

**Build and inspect retrieval pipelines as directed graphs—from document
ingestion through retrieval and chat.**

[![CI](https://github.com/Neeeser/Ragworks/actions/workflows/ci.yml/badge.svg)](https://github.com/Neeeser/Ragworks/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/FastAPI-backend-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-frontend-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![pgvector](https://img.shields.io/badge/pgvector-default-336791?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Pinecone](https://img.shields.io/badge/Pinecone-optional-000000?logo=pinecone)](https://www.pinecone.io/)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-supported-6467F2)](https://openrouter.ai/)

[Overview](#overview) · [Features](#features) · [How it works](#how-it-works) · [Quick start](#quick-start) · [Development](#development)

</div>

<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="docs/assets/pipeline-flow.png">
    <img src="docs/assets/pipeline-flow.gif" alt="The default Ragworks ingestion and retrieval pipelines running through semantic and BM25 branches" width="100%">
  </picture>
</p>

> **Project status:** Ragworks is under active development. It is suitable for
> personal deployments and evaluation, but interfaces and configuration may
> change between releases.

## Overview

Ragworks is intended for people who want to run retrieval workflows on their own
infrastructure and inspect how each answer was produced. Ingestion and retrieval
are represented as editable node graphs rather than fixed application code. Each
run records the inputs, outputs, duration, and status of its nodes so failures and
poor retrieval results can be traced to a specific stage.

The included Docker Compose stack runs the application, PostgreSQL, pgvector, and
BM25 search locally. The current release uses OpenRouter for embedding and chat
models. Pinecone can be selected as an alternative vector store.

## Features

- **Visual pipelines:** build ingestion and retrieval graphs with typed ports and
  validation before execution.
- **Execution traces:** inspect node inputs, outputs, duration, and status against
  the exact pipeline version that ran.
- **Hybrid retrieval:** combine semantic and BM25 results with reciprocal rank
  fusion.
- **Pluggable vector storage:** keep vectors in the included PostgreSQL instance
  with pgvector or select Pinecone per pipeline.
- **Collection-aware chat:** stream multi-turn conversations that can search one
  or more document collections.
- **Embedding visualization:** project collection embeddings for interactive
  inspection.
- **Runtime administration:** manage provider credentials per user and application
  settings centrally.

## Quick start

Ragworks publishes backend and frontend container images for each release. To run
the default stack, save the following as `docker-compose.yml`:

```yaml
name: ragworks

services:
  postgres:
    image: paradedb/paradedb:latest-pg17
    environment:
      POSTGRES_USER: ragworks
      POSTGRES_PASSWORD: ragworks
      POSTGRES_DB: ragworks
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ragworks"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    image: ghcr.io/neeeser/ragworks-backend:latest
    environment:
      DATABASE_URL: postgresql+psycopg://ragworks:ragworks@postgres:5432/ragworks
    volumes:
      - document-storage:/data/storage
      - backend-config:/data/config
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    image: ghcr.io/neeeser/ragworks-frontend:latest
    environment:
      API_PROXY_TARGET: http://backend:8000
    ports:
      - "7247:3000"
    depends_on:
      - backend

volumes:
  postgres-data:
  document-storage:
  backend-config:
```

Start the services:

```bash
docker compose up -d
```

Open <http://localhost:7247>. The first account becomes the administrator. In
the current release, the setup flow asks for an OpenRouter API key, selects an
embedding model, and creates the initial collection. Provider credentials are
stored per user and can be updated from the settings page.

To update an existing installation:

```bash
docker compose pull
docker compose up -d
```

The Compose file follows the current release through the `latest` image tag. For
a reproducible deployment, replace `latest` with a version from the
[releases page](https://github.com/Neeeser/Ragworks/releases).

## Configuration and data

Application behavior such as registration policy, upload limits, feature flags,
and default models can be changed under **Admin > Settings** without restarting
the services.

The default deployment uses three named volumes:

- `postgres-data` stores relational data and pgvector indexes.
- `document-storage` stores uploaded files.
- `backend-config` stores machine-generated bootstrap state, including the JWT
  signing secret.

The signing secret is generated on first boot. Set `JWT_SECRET_KEY` on the
backend service to supply one explicitly. The database and files remain in their
volumes when containers are replaced or upgraded.

Ragworks records optional activity data in its own database for the administrator
dashboard. It does not send application telemetry to the project maintainers.
Requests to embedding, chat, or external vector providers are sent to the
services configured by the user.

## How it works

**A Ragworks pipeline is a directed graph.** Nodes represent parsing, chunking,
embedding, indexing, retrieval, fusion, and output stages. Typed edges define how
data moves between them, and validation catches incompatible ports, cycles, and
invalid configuration before a run starts.

The default ingestion graph parses an uploaded document, creates chunks, embeds
them, and writes the results to an index. When lexical search is available, the
same chunks also flow through a parallel BM25 indexing branch.

The default retrieval graph sends a query through semantic and BM25 branches,
merges their rankings with reciprocal rank fusion, and returns the selected
chunks to search or chat. Both graphs can be edited and versioned. Every run pins
the graph version it used and records a trace for each node, connecting an answer
back to the pipeline that produced it.

The backend uses FastAPI, Pydantic, SQLModel, PostgreSQL, and pgvector. The
frontend uses Next.js, React, and TypeScript. See the
[development guide](docs/DEVELOPMENT.md) for the repository layout and API
surface.

## Development

Local development requires Python 3.11 or later, Node.js 22, PostgreSQL, and
[uv](https://docs.astral.sh/uv/).

```bash
git clone https://github.com/Neeeser/Ragworks.git
cd Ragworks
make env
make run
```

The backend runs at <http://localhost:8000> and the frontend at
<http://localhost:3000>. Provider credentials are configured in the UI rather
than an environment file.

Run the verification gate for each area you change:

```bash
make verify
make coverage

cd frontend
npm run verify
cd ..
make format-check-frontend
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for pull request conventions and
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed setup and architecture
notes.

## Contributing

Issues and pull requests are welcome. Bug fixes require a regression test that
fails before the fix and passes afterward. Start with
[CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

Ragworks is available under the [MIT License](LICENSE).
