resource "google_storage_bucket" "cdn" {
  name          = var.cdn_bucket_name
  location      = var.primary_region
  project       = var.gcp_project_id
  force_destroy = false

  uniform_bucket_level_access = true
  public_access_prevention    = "inherited"

  lifecycle {
    ignore_changes = [location]
  }
}

# Network Endpoint Groups (NEGs) for Cloud Run services
resource "google_compute_network_endpoint_group" "app_neg" {
  name                  = "app-service-neg"
  network_endpoint_type = "SERVERLESS"
  location              = local.services.app.region
  project               = var.gcp_project_id

  cloud_run {
    service = google_cloud_run_service.app.name
  }
}

resource "google_compute_network_endpoint_group" "api_neg" {
  name                  = "api-service-neg"
  network_endpoint_type = "SERVERLESS"
  location              = local.services.api.region
  project               = var.gcp_project_id

  cloud_run {
    service = google_cloud_run_service.api.name
  }
}

resource "google_compute_network_endpoint_group" "auth_neg" {
  name                  = "auth-service-neg"
  network_endpoint_type = "SERVERLESS"
  location              = local.services.auth.region
  project               = var.gcp_project_id

  cloud_run {
    service = google_cloud_run_service.auth.name
  }
}

resource "google_compute_network_endpoint_group" "docs_neg" {
  name                  = "docs-service-neg"
  network_endpoint_type = "SERVERLESS"
  location              = local.services.docs.region
  project               = var.gcp_project_id

  cloud_run {
    service = google_cloud_run_service.docs.name
  }
}

resource "google_compute_network_endpoint_group" "admin_neg" {
  name                  = "admin-service-neg"
  network_endpoint_type = "SERVERLESS"
  location              = local.services.admin.region
  project               = var.gcp_project_id

  cloud_run {
    service = google_cloud_run_service.admin.name
  }
}

# Backend services
resource "google_compute_backend_service" "app_backend" {
  name            = "backend-app"
  protocol        = "HTTPS"
  port_name       = "http"
  project         = var.gcp_project_id
  timeout_sec     = 30
  session_affinity = "NONE"

  backend {
    group = google_compute_network_endpoint_group.app_neg.id
  }

  log_config {
    enable = true
  }
}

resource "google_compute_backend_service" "api_backend" {
  name            = "backend-api"
  protocol        = "HTTPS"
  port_name       = "http"
  project         = var.gcp_project_id
  timeout_sec     = 30
  session_affinity = "NONE"

  backend {
    group = google_compute_network_endpoint_group.api_neg.id
  }

  log_config {
    enable = true
  }
}

resource "google_compute_backend_service" "auth_backend" {
  name            = "backend-auth"
  protocol        = "HTTPS"
  port_name       = "http"
  project         = var.gcp_project_id
  timeout_sec     = 30
  session_affinity = "NONE"

  backend {
    group = google_compute_network_endpoint_group.auth_neg.id
  }

  log_config {
    enable = true
  }
}

resource "google_compute_backend_service" "docs_backend" {
  name            = "backend-docs"
  protocol        = "HTTPS"
  port_name       = "http"
  project         = var.gcp_project_id
  timeout_sec     = 30
  session_affinity = "NONE"

  backend {
    group = google_compute_network_endpoint_group.docs_neg.id
  }

  log_config {
    enable = true
  }
}

resource "google_compute_backend_service" "admin_backend" {
  name            = "backend-admin"
  protocol        = "HTTPS"
  port_name       = "http"
  project         = var.gcp_project_id
  timeout_sec     = 30
  session_affinity = "NONE"

  backend {
    group = google_compute_network_endpoint_group.admin_neg.id
  }

  log_config {
    enable = true
  }
}

# Backend bucket for CDN
resource "google_compute_backend_bucket" "cdn_backend" {
  name            = "backend-cdn"
  bucket_name     = google_storage_bucket.cdn.name
  project         = var.gcp_project_id
  enable_cdn      = true

  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    negative_caching  = true
    serve_while_stale = 86400
  }
}

# URL maps to route traffic
resource "google_compute_url_map" "main" {
  name            = var.load_balancer_name
  default_service = google_compute_backend_service.app_backend.id
  project         = var.gcp_project_id

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

# HTTPS proxy
resource "google_compute_target_https_proxy" "main" {
  name     = "${var.load_balancer_name}-https-proxy"
  url_map  = google_compute_url_map.main.id
  project  = var.gcp_project_id

  ssl_certificates = [google_compute_ssl_certificate.main.id]
  ssl_policy       = google_compute_ssl_policy.main.id
}

# SSL certificate (managed by Google Cloud)
resource "google_compute_managed_ssl_certificate" "main" {
  name     = "${var.load_balancer_name}-ssl-cert"
  project  = var.gcp_project_id

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

# Self-signed cert for bootstrap (replace with managed cert above)
resource "google_compute_ssl_certificate" "main" {
  name    = "${var.load_balancer_name}-cert"
  project = var.gcp_project_id

  private_key = var.ssl_private_key
  certificate = var.ssl_certificate
}

# SSL policy
resource "google_compute_ssl_policy" "main" {
  name            = "${var.load_balancer_name}-ssl-policy"
  profile         = "MODERN"
  min_tls_version = "TLS_1_2"
  project         = var.gcp_project_id
}

# Global forwarding rule
resource "google_compute_global_forwarding_rule" "main" {
  name                 = "${var.load_balancer_name}-fw-rule"
  load_balancing_scheme = "EXTERNAL"
  ip_protocol          = "TCP"
  port_range           = "443"
  target               = google_compute_target_https_proxy.main.id
  project              = var.gcp_project_id
}

# Reserve static IP for load balancer
resource "google_compute_address" "main" {
  name          = "${var.load_balancer_name}-ip"
  address_type  = "EXTERNAL"
  address       = var.load_balancer_ip
  project       = var.gcp_project_id
}
