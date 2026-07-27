# PC OS Infrastructure as Code (Terraform)

This directory contains the Terraform configuration for deploying PC OS on Google Cloud Platform.

## Architecture Overview

The infrastructure deploys a globally distributed, serverless architecture with:

- **5 Cloud Run Services** across different regions:
  - `app-service` (us-central1) - Main application
  - `api-service` (us-east1) - REST API endpoints
  - `auth-service` (us-east4) - Authentication service
  - `docs-service` (us-west2) - Documentation
  - `admin-service` (us-west1) - Admin panel

- **Global Load Balancer** with:
  - Host-based routing to each service subdomain
  - SSL/TLS termination
  - Automatic failover and load distribution

- **CDN Storage** (Google Cloud Storage):
  - `cdn.xsasx.company` - Static assets bucket
  - Edge caching for global performance

## Prerequisites

1. **Terraform 1.0+** installed locally
2. **Google Cloud SDK** (`gcloud`) configured with your project
3. **Service Account** with permissions:
   - `Cloud Run Developer`
   - `Compute Load Balancer Admin`
   - `Storage Admin`
   - `Compute Security Policy Admin`

4. **SSL Certificate & Private Key** (self-signed or managed):
   - Must be in PEM format
   - For production, use Google-managed certificates

## Configuration

### 1. Set up credentials
```bash
gcloud auth application-default login
gcloud config set project pc-os-deployment-cqpdbj
```

### 2. Initialize Terraform
```bash
cd terraform
terraform init
```

### 3. Create `terraform.tfvars`
```hcl
gcp_project_id = "pc-os-deployment-cqpdbj"
primary_region = "us-central1"

# Container images (from your registries)
app_container_image   = "us-docker.pkg.dev/YOUR_PROJECT/cloud-run/app:latest"
api_container_image   = "us-docker.pkg.dev/YOUR_PROJECT/cloud-run/api:latest"
auth_container_image  = "us-docker.pkg.dev/YOUR_PROJECT/cloud-run/auth:latest"
docs_container_image  = "us-docker.pkg.dev/YOUR_PROJECT/cloud-run/docs:latest"
admin_container_image = "us-docker.pkg.dev/YOUR_PROJECT/cloud-run/admin:latest"

# SSL Certificate (cat your cert.pem file)
ssl_certificate = file("${path.module}/certs/cert.pem")
ssl_private_key = file("${path.module}/certs/key.pem")

cdn_bucket_name = "pc-os-cdn-bucket"
load_balancer_name = "xsasx-lb"
```

### 4. Review the plan
```bash
terraform plan
```

### 5. Apply the configuration
```bash
terraform apply
```

### 6. Get outputs
```bash
terraform output
```

## Deployment via Cloud Build

The `../cloudbuild.yaml` file automates the entire deployment:

1. **Terraform init/validate/plan** - Prepare infrastructure
2. **Docker build** - Build PC OS container image
3. **Push to registry** - Push image to Google Container Registry
4. **Terraform apply** - Deploy all infrastructure
5. **Cloud Run deploy** - Deploy the container

### Setting up Cloud Build Trigger

1. Go to Cloud Build → Triggers
2. Create new trigger:
   - **Branch:** `claude/pc-security-apps-impl-7w5rab`
   - **Build configuration:** `cloudbuild.yaml`
   - **Substitution variables:**
     - `_SSL_CERT`: Your SSL certificate content
     - `_SSL_KEY`: Your SSL private key content

### Running manually
```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_SSL_CERT="$(cat certs/cert.pem)",_SSL_KEY="$(cat certs/key.pem)"
```

## DNS Configuration

After deployment, point these DNS records to the load balancer IP:

```
A  xsasx.company           → <LOAD_BALANCER_IP>
A  app.xsasx.company       → <LOAD_BALANCER_IP>
A  api.xsasx.company       → <LOAD_BALANCER_IP>
A  auth.xsasx.company      → <LOAD_BALANCER_IP>
A  docs.xsasx.company      → <LOAD_BALANCER_IP>
A  cdn.xsasx.company       → <LOAD_BALANCER_IP>
A  admin.xsasx.company     → <LOAD_BALANCER_IP>
```

Get the IP with:
```bash
terraform output load_balancer_ip
```

## SSL Certificate Management

### Self-Signed (for testing)
```bash
mkdir -p terraform/certs
openssl req -x509 -newkey rsa:4096 -keyout terraform/certs/key.pem \
  -out terraform/certs/cert.pem -days 365 -nodes \
  -subj "/CN=xsasx.company"
```

### Google-Managed (production)
- The `google_compute_managed_ssl_certificate` resource handles this
- Requires DNS validation (automated)
- No renewal concerns

## Monitoring & Logs

View Cloud Run logs:
```bash
gcloud run logs read app-service --region=us-central1 --limit 50
```

View load balancer logs:
```bash
gcloud logging read "resource.type=http_load_balancer" --limit 50 --format json
```

## Cleanup

Destroy all resources:
```bash
terraform destroy
```

## Cost Optimization

- **Cloud Run**: Scales to zero when idle
- **CDN**: Cache static assets to reduce egress
- **Load Balancer**: Only pay for traffic processed
- **Storage**: Enable lifecycle policies to delete old objects

## Troubleshooting

### Service not responding
```bash
gcloud run services describe app-service --region=us-central1
```

### Load balancer health checks failing
- Check Cloud Run service is publicly accessible
- Verify firewall rules allow health check traffic

### SSL certificate issues
- Check certificate expiry: `openssl x509 -in cert.pem -noout -dates`
- For Google-managed certs, verify DNS is pointing to the LB

## Updating Container Images

To deploy new versions:

1. Update container image URLs in `terraform.tfvars`
2. Run `terraform apply` to update services

Or via Cloud Build (automatic):
- Push to branch `claude/pc-security-apps-impl-7w5rab`
- Cloud Build automatically builds, pushes, and deploys

## State Management

Terraform state is stored locally by default. For team collaboration:

1. Create GCS bucket:
   ```bash
   gsutil mb gs://pc-os-deployment-tfstate
   gsutil versioning set on gs://pc-os-deployment-tfstate
   ```

2. Uncomment backend in `main.tf`:
   ```hcl
   backend "gcs" {
     bucket = "pc-os-deployment-tfstate"
     prefix = "prod"
   }
   ```

3. Run `terraform init` again to migrate state

## Support

For issues:
1. Check Cloud Build logs: `gcloud builds log <BUILD_ID>`
2. Review Cloud Run logs
3. Validate Terraform: `terraform validate`
