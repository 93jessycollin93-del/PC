#!/bin/bash
# Google Cloud Run Deployment Script for PC OS
# Usage: bash .cloud-run-deployment.sh

set -e

PROJECT_ID="pc-os-deployment-CqpdbJ"
SERVICE_NAME="pc-os-app"
REGION="us-central1"
STORAGE_BUCKET="pc-os-pod-500gb"
MEMORY="512Mi"
CPU="1"

echo "🚀 Deploying PC OS to Google Cloud Run..."
echo "Project ID: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "📡 Enabling Cloud Run API..."
gcloud services enable run.googleapis.com storage-api.googleapis.com

# Create storage bucket for 500GB pod (if it doesn't exist)
echo "💾 Setting up 500GB storage pod..."
if ! gsutil ls gs://$STORAGE_BUCKET > /dev/null 2>&1; then
    gsutil mb -l $REGION gs://$STORAGE_BUCKET
    echo "✅ Storage bucket created: gs://$STORAGE_BUCKET"
else
    echo "✅ Storage bucket already exists: gs://$STORAGE_BUCKET"
fi

# Deploy to Cloud Run
echo "🔨 Building and deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --source . \
    --platform managed \
    --region $REGION \
    --memory $MEMORY \
    --cpu $CPU \
    --allow-unauthenticated \
    --set-env-vars="STORAGE_BUCKET=gs://$STORAGE_BUCKET" \
    --build-config-file=cloudbuild.yaml

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format='value(status.url)')

echo ""
echo "✅ Deployment Complete!"
echo "🌐 Service URL: $SERVICE_URL"
echo "📊 Storage Pod: gs://$STORAGE_BUCKET (500GB allocated)"
echo ""
echo "Next steps:"
echo "1. Visit: $SERVICE_URL"
echo "2. Test the app in your browser"
echo "3. Monitor logs: gcloud run logs read $SERVICE_NAME --region $REGION --limit 50"
