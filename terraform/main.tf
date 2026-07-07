terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
  backend "gcs" {
    bucket = "xsasx-terraform-state"
    prefix = "xsasx"
  }
}

provider "google" {
  project = var.project_id
}

variable "project_id" {
  default = "pc-os-deployment-cqpdbj"
}

variable "project_suffix" {
  default = "prod"
}

variable "admin_allowed_group" {
  default = "admins@xsasx.company"
}

# ===================================================================
# ENABLE APIS (only loop here)
# ===================================================================
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "storage.googleapis.com",
    "iap.googleapis.com",
    "logging.googleapis.com"
  ])
  service            = each.key
  disable_on_destroy = false
}

# ===================================================================
# CLOUD RUN SERVICES (explicit, one per service)
# ===================================================================
resource "google_cloud_run_v2_service" "app" {
  name     = "app-service"
  location = "northamerica-northeast1"
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = 1
      max_instance_count = 20
    }
    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"
      ports { container_port = 8080 }
      resources { limits = { cpu = "1", memory = "512Mi" } }
    }
  }
  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service" "api" {
  name     = "api-service"
  location = "northamerica-northeast1"
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = 2
      max_instance_count = 50
    }
    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"
      ports { container_port = 8080 }
      resources { limits = { cpu = "1", memory = "512Mi" } }
    }
  }
  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service" "auth" {
  name     = "auth-service"
  location = "northamerica-northeast1"
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = 2
      max_instance_count = 30
    }
    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"
      ports { container_port = 8080 }
      resources { limits = { cpu = "1", memory = "512Mi" } }
    }
  }
  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service" "docs" {
  name     = "docs-service"
  location = "us-central1"
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = 1
      max_instance_count = 10
    }
    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"
      ports { container_port = 8080 }
      resources { limits = { cpu = "1", memory = "512Mi" } }
    }
  }
  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service" "admin" {
  name     = "admin-service"
  location = "northamerica-northeast1"
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = 1
      max_instance_count = 5
    }
    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"
      ports { container_port = 8080 }
      resources { limits = { cpu = "1", memory = "512Mi" } }
    }
  }
  depends_on = [google_project_service.apis]
}

# ===================================================================
# PUBLIC IAM (app, api, docs)
# ===================================================================
resource "google_cloud_run_service_iam_policy" "app_public" {
  location = google_cloud_run_v2_service.app.location
  project  = var.project_id
  service  = google_cloud_run_v2_service.app.name
  policy_data = jsonencode({
    bindings = [{ role = "roles/run.invoker", members = ["allUsers"] }]
  })
}

resource "google_cloud_run_service_iam_policy" "api_public" {
  location = google_cloud_run_v2_service.api.location
  project  = var.project_id
  service  = google_cloud_run_v2_service.api.name
  policy_data = jsonencode({
    bindings = [{ role = "roles/run.invoker", members = ["allUsers"] }]
  })
}

resource "google_cloud_run_service_iam_policy" "docs_public" {
  location = google_cloud_run_v2_service.docs.location
  project  = var.project_id
  service  = google_cloud_run_v2_service.docs.name
  policy_data = jsonencode({
    bindings = [{ role = "roles/run.invoker", members = ["allUsers"] }]
  })
}

# ===================================================================
# GCS CDN + BACKEND BUCKET
# ===================================================================
resource "google_storage_bucket" "cdn" {
  name                        = "cdn-xsasx-${var.project_suffix}"
  location                    = "northamerica-northeast1"
  uniform_bucket_level_access = true
  versioning { enabled = true }
}

resource "google_compute_backend_bucket" "cdn_backend" {
  name        = "backend-cdn"
  bucket_name = google_storage_bucket.cdn.name
  enable_cdn  = true
  cdn_policy {
    cache_mode       = "CACHE_ALL_STATIC"
    client_ttl       = 3600
    default_ttl      = 3600
    max_ttl          = 86400
    negative_caching = true
  }
}

# ===================================================================
# SERVERLESS NEGs
# ===================================================================
resource "google_compute_region_network_endpoint_group" "app_neg" {
  name                  = "app-neg"
  network_endpoint_type = "SERVERLESS"
  region                = "northamerica-northeast1"
  cloud_run { service = google_cloud_run_v2_service.app.name }
}

resource "google_compute_region_network_endpoint_group" "api_neg" {
  name                  = "api-neg"
  network_endpoint_type = "SERVERLESS"
  region                = "northamerica-northeast1"
  cloud_run { service = google_cloud_run_v2_service.api.name }
}

resource "google_compute_region_network_endpoint_group" "auth_neg" {
  name                  = "auth-neg"
  network_endpoint_type = "SERVERLESS"
  region                = "northamerica-northeast1"
  cloud_run { service = google_cloud_run_v2_service.auth.name }
}

resource "google_compute_region_network_endpoint_group" "docs_neg" {
  name                  = "docs-neg"
  network_endpoint_type = "SERVERLESS"
  region                = "us-central1"
  cloud_run { service = google_cloud_run_v2_service.docs.name }
}

resource "google_compute_region_network_endpoint_group" "admin_neg" {
  name                  = "admin-neg"
  network_endpoint_type = "SERVERLESS"
  region                = "northamerica-northeast1"
  cloud_run { service = google_cloud_run_v2_service.admin.name }
}

# ===================================================================
# BACKEND SERVICES
# ===================================================================
resource "google_compute_backend_service" "app_backend" {
  name                  = "backend-app"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = 30
  backend { group = google_compute_region_network_endpoint_group.app_neg.id }
}

resource "google_compute_backend_service" "api_backend" {
  name                  = "backend-api"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = 30
  backend { group = google_compute_region_network_endpoint_group.api_neg.id }
}

resource "google_compute_backend_service" "auth_backend" {
  name                  = "backend-auth"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = 30
  backend { group = google_compute_region_network_endpoint_group.auth_neg.id }
}

resource "google_compute_backend_service" "docs_backend" {
  name                  = "backend-docs"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = 30
  backend { group = google_compute_region_network_endpoint_group.docs_neg.id }
}

resource "google_compute_security_policy" "admin_armor" {
  name = "admin-armor-policy"
  rule {
    action   = "allow"
    priority = 1000
    match {
      versioned_expr = "SRC_IPS_V1"
      config { src_ip_ranges = ["0.0.0.0/0"] }
    }
  }
}

resource "google_compute_backend_service" "admin_backend" {
  name                  = "backend-admin"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = 30
  security_policy       = google_compute_security_policy.admin_armor.id
  backend { group = google_compute_region_network_endpoint_group.admin_neg.id }
}

# ===================================================================
# GLOBAL LOAD BALANCER - URL MAP
# ===================================================================
resource "google_compute_url_map" "url_map" {
  name            = "xsasx-frontend-url-map"
  default_service = google_compute_backend_service.app_backend.id

  host_rule {
    hosts        = ["app.xsasx.company"]
    path_matcher = "app"
  }
  host_rule {
    hosts        = ["api.xsasx.company"]
    path_matcher = "api"
  }
  host_rule {
    hosts        = ["auth.xsasx.company"]
    path_matcher = "auth"
  }
  host_rule {
    hosts        = ["docs.xsasx.company"]
    path_matcher = "docs"
  }
  host_rule {
    hosts        = ["cdn.xsasx.company"]
    path_matcher = "cdn"
  }
  host_rule {
    hosts        = ["admin.xsasx.company"]
    path_matcher = "admin"
  }

  path_matcher {
    name            = "app"
    default_service = google_compute_backend_service.app_backend.id
  }
  path_matcher {
    name            = "api"
    default_service = google_compute_backend_service.api_backend.id
  }
  path_matcher {
    name            = "auth"
    default_service = google_compute_backend_service.auth_backend.id
  }
  path_matcher {
    name            = "docs"
    default_service = google_compute_backend_service.docs_backend.id
  }
  path_matcher {
    name            = "cdn"
    default_service = google_compute_backend_bucket.cdn_backend.id
  }
  path_matcher {
    name            = "admin"
    default_service = google_compute_backend_service.admin_backend.id
  }
}

# ===================================================================
# SSL + HTTPS PROXY + FORWARDING RULE
# ===================================================================
resource "google_compute_managed_ssl_certificate" "cert" {
  name = "xsasx-managed-cert"
  managed {
    domains = [
      "xsasx.company",
      "app.xsasx.company",
      "api.xsasx.company",
      "auth.xsasx.company",
      "docs.xsasx.company",
      "cdn.xsasx.company",
      "admin.xsasx.company"
    ]
  }
}

resource "google_compute_target_https_proxy" "proxy" {
  name             = "xsasx-https-proxy"
  url_map          = google_compute_url_map.url_map.id
  ssl_certificates = [google_compute_managed_ssl_certificate.cert.id]
}

resource "google_compute_global_address" "ip" {
  name         = "xsasx-global-ip"
  address_type = "EXTERNAL"
}

resource "google_compute_global_forwarding_rule" "frontend" {
  name                  = "xsasx-frontend"
  target                = google_compute_target_https_proxy.proxy.id
  ip_address            = google_compute_global_address.ip.address
  ip_protocol           = "TCP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  port_range            = "443"
}

# ===================================================================
# IAP FOR ADMIN
# ===================================================================
resource "google_iap_web_backend_service_iam_policy" "admin_iap" {
  web_backend_service = google_compute_backend_service.admin_backend.name
  policy_data = jsonencode({
    bindings = [{
      role    = "roles/iap.httpsResourceAccessor"
      members = ["group:${var.admin_allowed_group}"]
    }]
  })
}

# ===================================================================
# LOGGING
# ===================================================================
resource "google_logging_project_sink" "logs" {
  name                   = "xsasx-run-logs"
  destination            = "bigquery.googleapis.com/projects/${var.project_id}/datasets/xsasx_logs"
  filter                 = "resource.type=cloud_run_revision"
  unique_writer_identity = true
}

# ===================================================================
# OUTPUTS
# ===================================================================
output "global_ip" {
  value = google_compute_global_address.ip.address
}

output "cdn_bucket" {
  value = google_storage_bucket.cdn.name
}

output "dns_records" {
  value = <<-EOT
    Point these A records to ${google_compute_global_address.ip.address}:
    xsasx.company
    app.xsasx.company
    api.xsasx.company
    auth.xsasx.company
    docs.xsasx.company
    cdn.xsasx.company
    admin.xsasx.company
  EOT
}
