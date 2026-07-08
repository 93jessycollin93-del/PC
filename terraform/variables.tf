variable "gcp_project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "pc-os-deployment-cqpdbj"
}

variable "primary_region" {
  description = "Primary GCP region"
  type        = string
  default     = "us-central1"
}

variable "app_container_image" {
  description = "Container image for app service"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "api_container_image" {
  description = "Container image for API service"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "auth_container_image" {
  description = "Container image for auth service"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "docs_container_image" {
  description = "Container image for docs service"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "admin_container_image" {
  description = "Container image for admin service"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "cdn_bucket_name" {
  description = "GCS bucket name for CDN"
  type        = string
  default     = "pc-os-cdn-bucket"
}

variable "load_balancer_name" {
  description = "Global load balancer name"
  type        = string
  default     = "xsasx-lb"
}

variable "domain_suffix" {
  description = "Domain suffix for subdomains"
  type        = string
  default     = "xsasx.company"
}

variable "ssl_certificate" {
  description = "SSL certificate content (PEM format)"
  type        = string
  sensitive   = true
}

variable "ssl_private_key" {
  description = "SSL private key content (PEM format)"
  type        = string
  sensitive   = true
}

variable "load_balancer_ip" {
  description = "Static IP address for load balancer (optional)"
  type        = string
  default     = ""
}
