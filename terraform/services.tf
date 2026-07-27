resource "google_cloud_run_service" "app" {
  name     = "app-service"
  location = local.services.app.region
  project  = var.gcp_project_id

  template {
    spec {
      containers {
        image = local.services.app.container_image
        ports {
          container_port = 8080
        }
        resources {
          limits = {
            cpu    = "2"
            memory = "2Gi"
          }
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

resource "google_cloud_run_service" "api" {
  name     = "api-service"
  location = local.services.api.region
  project  = var.gcp_project_id

  template {
    spec {
      containers {
        image = local.services.api.container_image
        ports {
          container_port = 8080
        }
        resources {
          limits = {
            cpu    = "2"
            memory = "2Gi"
          }
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

resource "google_cloud_run_service" "auth" {
  name     = "auth-service"
  location = local.services.auth.region
  project  = var.gcp_project_id

  template {
    spec {
      containers {
        image = local.services.auth.container_image
        ports {
          container_port = 8080
        }
        resources {
          limits = {
            cpu    = "2"
            memory = "2Gi"
          }
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

resource "google_cloud_run_service" "docs" {
  name     = "docs-service"
  location = local.services.docs.region
  project  = var.gcp_project_id

  template {
    spec {
      containers {
        image = local.services.docs.container_image
        ports {
          container_port = 8080
        }
        resources {
          limits = {
            cpu    = "1"
            memory = "1Gi"
          }
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

resource "google_cloud_run_service" "admin" {
  name     = "admin-service"
  location = local.services.admin.region
  project  = var.gcp_project_id

  template {
    spec {
      containers {
        image = local.services.admin.container_image
        ports {
          container_port = 8080
        }
        resources {
          limits = {
            cpu    = "1"
            memory = "1Gi"
          }
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

# Make Cloud Run services publicly accessible
resource "google_cloud_run_service_iam_member" "app_public" {
  service       = google_cloud_run_service.app.name
  location      = google_cloud_run_service.app.location
  role          = "roles/run.invoker"
  member        = "allUsers"
  project       = var.gcp_project_id
}

resource "google_cloud_run_service_iam_member" "api_public" {
  service       = google_cloud_run_service.api.name
  location      = google_cloud_run_service.api.location
  role          = "roles/run.invoker"
  member        = "allUsers"
  project       = var.gcp_project_id
}

resource "google_cloud_run_service_iam_member" "auth_public" {
  service       = google_cloud_run_service.auth.name
  location      = google_cloud_run_service.auth.location
  role          = "roles/run.invoker"
  member        = "allUsers"
  project       = var.gcp_project_id
}

resource "google_cloud_run_service_iam_member" "docs_public" {
  service       = google_cloud_run_service.docs.name
  location      = google_cloud_run_service.docs.location
  role          = "roles/run.invoker"
  member        = "allUsers"
  project       = var.gcp_project_id
}

resource "google_cloud_run_service_iam_member" "admin_public" {
  service       = google_cloud_run_service.admin.name
  location      = google_cloud_run_service.admin.location
  role          = "roles/run.invoker"
  member        = "allUsers"
  project       = var.gcp_project_id
}
