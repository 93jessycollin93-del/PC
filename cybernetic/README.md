# CYBERNETIC — Unified Orchestration System

**Consolidated:** PC + Eru + Jacky + pi-web into a single, cohesive AI orchestration platform

**Target Environments:**
- iPhone 12 (Router Console PWA — offline-first)
- Replit (Model Training Lab, primary deployment)
- Docker (PC desktop when online)
- GitHub Pages (PWA static hosting)

---

## Architecture

```
Cybernetic Monorepo
├── packages/
│   ├── core-orchestration    Agent routing, scoring, escalation
│   ├── data-models           PostgreSQL schema via Prisma
│   ├── infrastructure        Cloud deployment, monitoring
│   ├── api-gateway           Express backend, API routes
│   ├── ui-components         React components (extracted from eru)
│   └── security              Auth, rate limiting, audit logging
├── apps/
│   ├── desktop               PC app (Vite + React)
│   ├── mobile-pwa            Router Console v2 (offline-first)
│   └── web                   Backend server + APIs
└── docs/
    ├── ARCHITECTURE.md
    ├── API.md
    └── DEPLOYMENT.md
```

---

## Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| **Orchestration** | TypeScript, custom routing | ✅ Core built |
| **Database** | PostgreSQL + Prisma ORM | ✅ Schema ready |
| **API** | Express + TypeScript | 🔧 In progress |
| **Frontend** | React + Vite + Radix UI | 🔧 In progress |
| **Deployment** | Docker, Replit, GitHub Pages | 🔧 Planned |

---

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm 8+
- PostgreSQL 14+ (local or cloud)

### Installation

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Create .env files for each package
# See DEPLOYMENT.md for details
```

### Database Setup

```bash
# Create migration
pnpm db:migrate

# Seed data (optional)
pnpm db:seed
```

### Development

```bash
# Run all dev servers in parallel
pnpm dev

# Or run individual packages
cd packages/core-orchestration && pnpm dev
cd apps/web && pnpm dev
cd apps/mobile-pwa && pnpm dev
```

---

## Key Features

### ✅ Agent Orchestration
- Intelligent task routing based on keywords + confidence scoring
- Confidence-based escalation (route to next agent if uncertain)
- Resource-aware deployment (thermal, memory, battery monitoring)

### ✅ Zero Base44 Dependencies
- All Base44 entities replaced with PostgreSQL + Prisma
- Fully self-hostable, no vendor lock-in

### ✅ Multi-Environment Support
- Offline-first PWA for iPhone 12
- Backend APIs for all platforms
- Docker deployment for PC

### ✅ Security Framework
- Biometric authentication + MFA fallback
- Rate limiting on all APIs
- Immutable audit logging
- Session timeout (30 min idle)

### ✅ Monitoring & Observability
- Real-time thermal, CPU, memory, battery tracking
- Agent execution metrics
- System health dashboard

---

## File Structure Explained

### `packages/core-orchestration`
The heart of Cybernetic. Contains:
- `AgentRouter`: Scores agents, returns best match
- `EscalationEngine`: Manages confidence-based escalation
- `SituationAssessor`: Monitors system resources
- `OrchestratorService`: Ties everything together

### `packages/data-models`
PostgreSQL schema (Prisma) replaces Base44 entities:
- `Agent`: AI model definitions
- `Task`: Work items routed to agents
- `BotDeployment`: Where/how agents are deployed
- `SystemMetric`, `AgentMetric`: Monitoring data
- `AuditLog`, `RateLimit`: Security

### `packages/ui-components`
React components extracted from eru-main:
- Theme toggle, language switcher
- Biometric auth, MFA verification
- Error boundaries, permission gates
- Dashboard layouts

### `apps/mobile-pwa`
Progressive Web App (offline-first):
- Runs on iPhone Safari
- No App Store approval needed
- Full offline operation
- Auto-syncs when reconnected

### `apps/web`
Backend server:
- Express API routes
- WebSocket for real-time updates
- Prisma database queries
- Authentication endpoints

---

## Extraction from Source Projects

| Source | Extracted | Status |
|--------|-----------|--------|
| **ocd-jacky-777** | Agent routing, scoring logic | ✅ Done |
| **PC-main** | Deployment infrastructure, monitoring | 🔧 In progress |
| **pi-web-main** | API patterns, middleware | 🔧 In progress |
| **eru-main** | UI components (non-marketplace) | 🔧 In progress |

**Removed:** All `@base44/sdk` imports and Base44-specific features

---

## Development Checklist

- [ ] Database: PostgreSQL running locally or cloud (set `DATABASE_URL`)
- [ ] Dependencies: `pnpm install` complete
- [ ] Prisma: `pnpm db:generate` ran successfully
- [ ] Core: Test `packages/core-orchestration` locally
- [ ] API: Test `apps/web` endpoints with Postman
- [ ] UI: Build `apps/mobile-pwa` and test on phone
- [ ] Docker: Build and test in container

---

## Deployment

### Local Development
```bash
pnpm dev
```

### Production (Replit)
```bash
npm install -g pnpm
pnpm install
pnpm build
pnpm start
```

### Docker (PC)
```bash
docker build -t cybernetic .
docker run -e DATABASE_URL=postgres://... cybernetic
```

### PWA (GitHub Pages)
```bash
cd apps/mobile-pwa
pnpm build
# Deploy `dist/` to GitHub Pages
```

See `docs/DEPLOYMENT.md` for detailed instructions.

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/tasks` | Create and route a task |
| `GET /api/tasks/:id` | Get task status |
| `GET /api/agents` | List all agents |
| `POST /api/agents/:id/promote` | Wake agent from hibernation |
| `POST /api/agents/:id/pause` | Put agent to sleep |
| `GET /api/thermal` | System thermal status |
| `GET /api/memory` | Memory usage |
| `GET /api/battery` | Battery status |

See `docs/API.md` for full reference.

---

## Monitoring

### Local
```bash
pnpm run db:studio  # Prisma Studio at localhost:5555
```

### Production
- System metrics dashboard in UI
- Audit logs in PostgreSQL
- WebSocket real-time updates

---

## Testing

```bash
# Unit tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

---

## Troubleshooting

**Database connection failed:**
- Check `DATABASE_URL` env var
- Verify PostgreSQL is running
- Run migrations: `pnpm db:migrate`

**Port already in use:**
- Change port: `PORT=3001 pnpm dev`

**Module not found:**
- Regenerate Prisma: `pnpm db:generate`
- Clear node_modules: `pnpm clean && pnpm install`

---

## Next Steps

1. **Week 1:** Finish extracting PC + pi-web + eru components
2. **Week 2:** Build UI dashboard, connect to orchestration APIs
3. **Week 3:** Deploy to Replit, test on iPhone
4. **Week 4:** Integrate Model Training Lab, Daigle compression, preservation

---

## Contributing

- Follow TypeScript best practices
- No Base44 dependencies allowed
- Add tests for new features
- Document API changes in `docs/API.md`

---

## Status

✅ **MVP Foundation:** Orchestration core, data models, monorepo structure  
🔧 **In Progress:** API layer, UI components, deployment  
📋 **Planned:** Model Training Lab, preservation system, full iPhone integration

---

**Last Updated:** 2026-07-09  
**Owner:** @93jessycollin93-del  
**Repository:** github.com/93jessycollin93-del/pc
