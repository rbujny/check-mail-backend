locals {
  api_gateway_openapi_spec = templatefile("${path.module}/openapi/checkmail.yaml.tftpl", {
    auth_function_url       = google_cloudfunctions2_function.functions["auth"].service_config[0].uri
    basic_http_function_url = google_cloudfunctions2_function.functions["basic-http"].service_config[0].uri
    jwt_audience            = var.jwt_audience
    jwt_issuer              = var.jwt_issuer
    project_id              = var.project_id
  })
}

resource "google_service_account" "api_gateway" {
  account_id   = "${var.api_gateway_id}-gateway"
  display_name = "Checkmail API Gateway"
  project      = var.project_id

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_service_iam_member" "api_gateway_function_invoker" {
  for_each = google_cloudfunctions2_function.functions

  location = each.value.location
  member   = "serviceAccount:${google_service_account.api_gateway.email}"
  project  = var.project_id
  role     = "roles/run.invoker"
  service  = each.value.name
}

resource "google_cloudfunctions2_function_iam_member" "api_gateway_function_invoker" {
  for_each = google_cloudfunctions2_function.functions

  cloud_function = each.value.name
  location       = each.value.location
  member         = "serviceAccount:${google_service_account.api_gateway.email}"
  project        = var.project_id
  role           = "roles/cloudfunctions.invoker"
}

resource "google_cloud_run_service_iam_member" "auth_public_invoker" {
  location = google_cloudfunctions2_function.functions["auth"].location
  member   = "allUsers"
  project  = var.project_id
  role     = "roles/run.invoker"
  service  = google_cloudfunctions2_function.functions["auth"].name
}

resource "google_cloudfunctions2_function_iam_member" "auth_public_invoker" {
  cloud_function = google_cloudfunctions2_function.functions["auth"].name
  location       = google_cloudfunctions2_function.functions["auth"].location
  member         = "allUsers"
  project        = var.project_id
  role           = "roles/cloudfunctions.invoker"
}

resource "google_api_gateway_api" "checkmail" {
  api_id       = var.api_gateway_id
  display_name = "Checkmail API"
  project      = var.project_id

  depends_on = [google_project_service.required]
}

resource "google_api_gateway_api_config" "checkmail" {
  api           = google_api_gateway_api.checkmail.api_id
  api_config_id = var.api_gateway_config_id
  display_name  = "Checkmail OpenAPI config"
  project       = var.project_id

  gateway_config {
    backend_config {
      google_service_account = google_service_account.api_gateway.email
    }
  }

  openapi_documents {
    document {
      path     = "openapi.yaml"
      contents = base64encode(local.api_gateway_openapi_spec)
    }
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    google_cloud_run_service_iam_member.api_gateway_function_invoker,
    google_cloudfunctions2_function_iam_member.api_gateway_function_invoker,
  ]
}

resource "google_project_service" "api_gateway_managed_service" {
  project            = var.project_id
  service            = google_api_gateway_api.checkmail.managed_service
  disable_on_destroy = false

  depends_on = [google_api_gateway_api_config.checkmail]
}

resource "google_api_gateway_gateway" "checkmail" {
  api_config   = google_api_gateway_api_config.checkmail.id
  display_name = "Checkmail API Gateway"
  gateway_id   = var.api_gateway_gateway_id
  project      = var.project_id
  region       = var.region

  depends_on = [google_project_service.api_gateway_managed_service]
}
