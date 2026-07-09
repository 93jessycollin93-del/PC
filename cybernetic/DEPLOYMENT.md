# Cybernetic Deployment Guide

Production-ready deployment infrastructure for Cybernetic — unified AI orchestration platform.

## Quick Start (Local)

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- pnpm

### Run Locally

```bash
cd cybernetic

# Copy environment template
cp .env.example .env

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f api-gateway
```

Services will be available at:
- **Router Console UI**: http://localhost:3000
- **API Gateway**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3100 (admin/admin)

## Kubernetes Deployment (Cloud)

### Prerequisites
- Kubernetes cluster (GKE, EKS, AKS, etc.)
- `kubectl` configured and authenticated
- Docker images pushed to container registry

### Deploy to Kubernetes

```bash
cd cybernetic

# Create namespace
kubectl apply -f k8s/namespace.yml

# Create secrets (edit with real values first!)
kubectl apply -f k8s/configmap.yml

# Deploy infrastructure
kubectl apply -f k8s/postgres.yml
kubectl apply -f k8s/redis.yml

# Wait for databases
kubectl wait --for=condition=ready pod -l app=postgres -n cybernetic --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n cybernetic --timeout=300s

# Deploy application
kubectl apply -f k8s/api-gateway.yml
kubectl apply -f k8s/router-console.yml

# Deploy monitoring
kubectl apply -f k8s/monitoring.yml

# Check status
kubectl get pods -n cybernetic
kubectl get svc -n cybernetic
```

### Update Secrets in Kubernetes

```bash
kubectl create secret generic cybernetic-secrets \
  --from-literal=DB_PASSWORD='...' \
  --from-literal=GROQ_API_KEY='...' \
  --from-literal=GRAFANA_PASSWORD='...' \
  -n cybernetic
```

## Database Migrations

### Create migration

```bash
cd cybernetic
npx prisma migrate dev --name add_feature_name
```

### Apply migrations

```bash
# Docker Compose
docker-compose exec api-gateway pnpm prisma migrate deploy

# Kubernetes
kubectl exec -it deployment/api-gateway -n cybernetic -- pnpm prisma migrate deploy
```

## Monitoring & Observability

### Prometheus
- **URL**: http://localhost:9090
- **Scrape interval**: 15s
- **Retention**: 30 days

**Key metrics:**
- `api_requests_total` - Total API requests by endpoint
- `api_request_duration_seconds` - Request latency
- `database_connections` - Active DB connections
- `cache_hits_total` - Redis cache hits

### Grafana
- **URL**: http://localhost:3100
- **Default credentials**: admin/admin
- **Dashboards**: Auto-provisioned from `docker/grafana/provisioning/`

**Pre-built dashboards:**
- API Gateway Performance
- Database Health
- Redis Cache Stats
- System Resources

### Health Checks

```bash
# API Gateway
curl http://localhost:3001/health
curl http://localhost:3001/ready

# Router Console
curl http://localhost:3000

# Database
pg_isready -h localhost -p 5432

# Redis
redis-cli ping
```

## Scaling

### Horizontal Pod Autoscaling (K8s)

Router Console auto-scales based on CPU/memory:
```yaml
minReplicas: 2
maxReplicas: 5
CPU target: 70%
Memory target: 80%
```

Adjust in `k8s/router-console.yml`:
```yaml
resources:
  requests:
    cpu: "200m"
    memory: "512Mi"
  limits:
    cpu: "1000m"
    memory: "1Gi"
```

### Database Performance

For high-load environments:

```bash
# Connection pooling (via environment)
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# Redis for caching
REDIS_URL=redis://redis:6379
```

## Cloudflare Tunnel Setup

### Install Cloudflare CLI

```bash
curl -L https://github.com/cloudflare/wrangler/releases/download/wrangler%40v3.0.0/wrangler-v3.0.0-x86_64-unknown-linux-gnu.tar.gz | tar xz
```

### Create tunnel

```bash
wrangler tunnel login
wrangler tunnel create cybernetic
wrangler tunnel route dns cybernetic sas.cybernetic.example.com
```

### Configure tunnel

Edit `~/.wrangler/config.toml`:
```toml
[[env.production.routes]]
pattern = "api.cybernetic.example.com"
zone_id = "your_zone_id"
custom_domain = "api.cybernetic.example.com"
```

## CI/CD Pipeline

GitHub Actions automatically:
1. ✅ Runs linter & tests on PR
2. ✅ Builds Docker images on merge
3. ✅ Pushes to container registry
4. ✅ Deploys to K8s on main branch

**Workflow**: `.github/workflows/deploy.yml`

## Troubleshooting

### Database connection issues
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Reset database
docker-compose down
docker volume rm cybernetic_postgres_data
docker-compose up -d postgres
```

### Redis connection issues
```bash
# Check Redis
docker-compose exec redis redis-cli ping

# Clear cache
docker-compose exec redis redis-cli FLUSHALL
```

### Pod crashes (K8s)
```bash
kubectl logs deployment/api-gateway -n cybernetic
kubectl describe pod <pod-name> -n cybernetic
kubectl get events -n cybernetic
```

## Security Checklist

- [ ] Change all default passwords in `.env`
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS (Cloudflare or cert manager)
- [ ] Rotate API keys regularly
- [ ] Enable network policies (K8s)
- [ ] Use resource quotas (K8s)
- [ ] Enable audit logging
- [ ] Setup secret management (Vault, AWS Secrets Manager)

## Performance Tuning

### API Gateway
```env
# Connection pool
DATABASE_POOL_MAX=25

# Request timeout
HTTP_TIMEOUT=30000

# Compression
GZIP_LEVEL=6
```

### Database
```sql
-- Index frequently queried columns
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_agents_state ON agents(state);

-- VACUUM regularly
VACUUM ANALYZE;
```

### Redis
```
# Increase memory limit
maxmemory 512mb
maxmemory-policy allkeys-lru
```

## Backup & Restore

### PostgreSQL backup
```bash
docker-compose exec postgres pg_dump -U cybernetic cybernetic > backup.sql

# Restore
docker-compose exec -T postgres psql -U cybernetic cybernetic < backup.sql
```

### Kubernetes PVC backup
```bash
kubectl get pvc -n cybernetic
kubectl snapshot create postgres-backup postgres-pvc -n cybernetic
```

## Support

For deployment issues:
- Check logs: `docker-compose logs` or `kubectl logs`
- Verify `.env` configuration
- Ensure all services are healthy: `docker-compose ps` or `kubectl get pods -n cybernetic`
- Review monitoring dashboards (Prometheus/Grafana)
