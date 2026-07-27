# PC OS Browser Service - Deployment Guide

Cloud-based browser rendering service for PC OS. Renders web pages to screenshots using Puppeteer.

## Architecture

- **Service:** Cloud Run
- **Runtime:** Node.js 18
- **Dependencies:** Express, Puppeteer, CORS
- **Free tier:** 2 million requests/month

## Local Testing

```bash
cd services/browser-service
npm install
npm start
```

Server runs on `http://localhost:8080`

### Test endpoints:

```bash
# Health check
curl http://localhost:8080/health

# Render URL to screenshot
curl -X POST http://localhost:8080/render \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Get page content
curl -X POST http://localhost:8080/content \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Search
curl -X POST http://localhost:8080/search \
  -H "Content-Type: application/json" \
  -d '{"query": "cloud computing"}'
```

## Deploy to Cloud Run

### 1. Build and push image
```bash
gcloud builds submit --tag gcr.io/pc-os-deployment-cqpdbj/browser-service:latest services/browser-service/
```

### 2. Deploy to Cloud Run
```bash
gcloud run deploy browser-service \
  --image gcr.io/pc-os-deployment-cqpdbj/browser-service:latest \
  --platform managed \
  --region northamerica-northeast1 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --allow-unauthenticated
```

### 3. Get service URL
```bash
gcloud run services describe browser-service --region northamerica-northeast1 --format="value(status.url)"
```

Copy this URL—you'll use it in PC OS configuration.

## API Endpoints

### `POST /render`
Render URL to screenshot.

**Request:**
```json
{
  "url": "https://example.com",
  "width": 1024,
  "height": 768,
  "timeout": 10000
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://example.com",
  "screenshot": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "timestamp": "2024-01-15T12:00:00Z"
}
```

### `POST /content`
Extract HTML/text content from URL.

**Request:**
```json
{
  "url": "https://example.com",
  "timeout": 10000
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://example.com",
  "content": {
    "title": "Example Domain",
    "html": "...",
    "text": "..."
  },
  "timestamp": "2024-01-15T12:00:00Z"
}
```

### `POST /search`
Search and render results.

**Request:**
```json
{
  "query": "cloud computing",
  "timeout": 10000
}
```

**Response:**
```json
{
  "success": true,
  "query": "cloud computing",
  "screenshot": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "searchUrl": "https://www.google.com/search?q=cloud+computing",
  "timestamp": "2024-01-15T12:00:00Z"
}
```

## Cost & Quotas (GCP Free Tier)

- **Requests:** 2 million/month (plenty for PC OS)
- **Memory:** Free tier up to 180K vCPU-seconds/month
- **Bandwidth:** Free tier up to 1 GB/month
- **Cost:** ~$0.02-0.04 per 1M requests beyond free tier

## Monitoring

View logs:
```bash
gcloud run logs read browser-service --region northamerica-northeast1 --limit 50
```

View metrics:
```bash
gcloud run services describe browser-service --region northamerica-northeast1
```

## Next Step

Once deployed, configure PC OS to use the service URL in the Browser app.
