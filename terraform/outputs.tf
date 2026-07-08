output "load_balancer_ip" {
  description = "Static IP address of the global load balancer"
  value       = google_compute_address.main.address
}

output "cloud_run_services" {
  description = "URLs of Cloud Run services"
  value = {
    app   = google_cloud_run_service.app.status[0].url
    api   = google_cloud_run_service.api.status[0].url
    auth  = google_cloud_run_service.auth.status[0].url
    docs  = google_cloud_run_service.docs.status[0].url
    admin = google_cloud_run_service.admin.status[0].url
  }
}

output "cdn_bucket" {
  description = "CDN bucket name"
  value       = google_storage_bucket.cdn.name
}

output "dns_instructions" {
  description = "DNS configuration instructions"
  value       = <<-EOT
    Configure DNS records to point to the load balancer IP:

    Type    Name                    Value
    A       xsasx.company           ${google_compute_address.main.address}
    A       app.xsasx.company       ${google_compute_address.main.address}
    A       api.xsasx.company       ${google_compute_address.main.address}
    A       auth.xsasx.company      ${google_compute_address.main.address}
    A       docs.xsasx.company      ${google_compute_address.main.address}
    A       cdn.xsasx.company       ${google_compute_address.main.address}
    A       admin.xsasx.company     ${google_compute_address.main.address}
  EOT
}
