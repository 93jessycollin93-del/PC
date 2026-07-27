# Google Cloud Deployment Guide — PC OS

**Project ID:** `pc-os-deployment-CqpdbJ`  
**Storage Pod:** 500 GB (gs://pc-os-pod-500gb)  
**Service:** pc-os-app on Cloud Run (us-central1)

---

## 🚀 Quick Setup (2 methods)

### Method 1: GitHub Integration (Recommended — Auto-deploy on push)

1. **Open Google Cloud Console:**
   - Go to: https://console.cloud.google.com/
   - Select project: `pc-os-deployment-CqpdbJ`

2. **Enable Cloud Build API:**
   - Navigate to: APIs & Services → Enable APIs and Services
   - Search for "Cloud Build"
   - Click "Enable"

3. **Connect GitHub Repository:**
   - Go to: Cloud Build → Repositories
   - Click "Connect Repository"
   - Select GitHub account: `93jessycollin93-del`
   - Select repository: `PC`
   - Click "Connect"

4. **Create a Build Trigger:**
   - In Cloud Build → Triggers, click "Create Trigger"
   - **Name:** `pc-os-main-deploy`
   - **Repository:** Select `PC`
   - **Branch:** `claude/pc-security-apps-impl-7w5rab`
   - **Build type:** Cloud Run
   - **Service name:** `pc-os-app`
   - **Region:** `us-central1`
   - **Memory:** `512Mi`
   - **CPU:** `1`
   - Click **Create**

5. **First Deploy:**
   - Trigger will auto-run when you push to the branch
   - Or manually push: `git push origin claude/pc-security-apps-impl-7w5rab`
   - Monitor in Cloud Build → Build History
   - Once complete, you'll get a live URL

---

### Method 2: Local CLI Deployment (Manual)

**Prerequisites:**
```bash
# Install Google Cloud SDK
# macOS: brew install --cask google-cloud-sdk
# Linux/Windows: https://cloud.google.com/sdk/docs/install

# Initialize gcloud
gcloud init

# Authenticate
gcloud auth login
```

**Deploy:**
```bash
cd /home/user/PC
bash .cloud-run-deployment.sh
```

This will:
- ✅ Build the Docker image
- ✅ Create the 500GB storage bucket
- ✅ Deploy to Cloud Run
- ✅ Give you a live URL

---

## 📊 Monitor Your Deployment

**View Logs:**
```bash
gcloud run logs read pc-os-app --region us-central1 --limit 50
```

**Get Service URL:**
```bash
gcloud run services describe pc-os-app --region us-central1 --format='value(status.url)'
```

**View Storage Pod:**
- Google Cloud Console → Cloud Storage
- Bucket: `pc-os-pod-500gb`
- 500 GB allocated for app data

---

## 🔄 Auto-Scaling Configuration

The Cloud Run service is configured for:
- **Memory:** 512 MB
- **CPU:** 1 vCPU
- **Concurrency:** 80 (default)
- **Timeout:** 3600s (1 hour)
- **Min instances:** 0 (scales to zero when idle)
- **Max instances:** 100

---

## 🛑 Troubleshooting

**Build fails:**
```bash
gcloud builds log --stream  # View real-time build logs
```

**Service won't start:**
```bash
gcloud run services describe pc-os-app --region us-central1
# Check status in "Conditions" section
```

**Storage bucket issues:**
```bash
gsutil ls gs://pc-os-pod-500gb  # Verify bucket exists
gsutil mb -l us-central1 gs://pc-os-pod-500gb  # Create if missing
```

---

## 📋 Your Three Deployments

| Platform | URL | Status | Auto-Deploy |
|----------|-----|--------|------------|
| **Vercel (pc)** | https://pc-git-claude-pc-sec-856091-p-xb-xq-6-ocd-jacky-x-eru-7-p-xd-xq.vercel.app | ✅ Ready | GitHub push |
| **Vercel (pc-5dy8)** | https://pc-5dy8-git-claude-p-0ae65e-p-xb-xq-6-ocd-jacky-x-eru-7-p-xd-xq.vercel.app | ✅ Ready | GitHub push |
| **Google Cloud** | (will appear after first deploy) | 🔨 Ready to deploy | GitHub push |

---

## 🎯 Next Steps

1. **Choose deployment method** (GitHub integration recommended)
2. **Complete the setup** steps above
3. **Trigger the first deploy** (manual push or trigger)
4. **Get your live URL** once build completes (~5-10 min)
5. **Test in browser** — should work identically to Vercel

Questions? Let me know!
