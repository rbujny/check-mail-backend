resource "google_project_service" "api_gateway_required" {
  for_each = toset([
    "apikeys.googleapis.com",
    "apigateway.googleapis.com",
    "servicecontrol.googleapis.com",
    "servicemanagement.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_service_account" "api_gateway_backend" {
  project      = var.project_id
  account_id   = var.api_gateway_service_account_id
  display_name = "${var.api_gateway_display_name} Backend"
}

resource "google_project_iam_member" "api_gateway_function_invoker" {
  project = var.project_id
  role    = "roles/cloudfunctions.invoker"
  member  = "serviceAccount:${google_service_account.api_gateway_backend.email}"
}

resource "google_project_iam_member" "api_gateway_run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.api_gateway_backend.email}"
}

resource "google_apikeys_key" "gateway_client" {
  provider = google-beta

  project      = var.project_id
  name         = "${var.api_gateway_api_id}-client"
  display_name = "${var.api_gateway_display_name} Client Key"

  restrictions {
    api_targets {
      service = google_api_gateway_api.checkmail.managed_service
    }
  }

  depends_on = [google_project_service.api_gateway_required]
}

resource "google_api_gateway_api" "checkmail" {
  provider = google-beta

  project      = var.project_id
  api_id       = var.api_gateway_api_id
  display_name = var.api_gateway_display_name

  depends_on = [google_project_service.api_gateway_required]
}

resource "google_api_gateway_api_config" "checkmail" {
  provider = google-beta

  project              = var.project_id
  api                  = google_api_gateway_api.checkmail.api_id
  api_config_id_prefix = "${var.api_gateway_api_config_id}-"
  display_name         = "${var.api_gateway_display_name} Config"

  gateway_config {
    backend_config {
      google_service_account = google_service_account.api_gateway_backend.email
    }
  }

  openapi_documents {
    document {
      path = "openapi-gateway.yaml"
      contents = base64encode(
        templatefile("${path.module}/api-gateway-openapi.yaml.tftpl", {
          auth_backend_url              = google_cloudfunctions2_function.functions["auth"].service_config[0].uri
          jwt_audience                  = var.api_gateway_jwt_audience
          jwt_issuer                    = var.api_gateway_jwt_issuer
          jwt_jwks_uri                  = local.jwt_jwks_uri
          process_backend_url           = google_cloudfunctions2_function.functions["process"].service_config[0].uri
          process_rate_limit_per_minute = var.api_gateway_process_rate_limit_per_minute
          token_rate_limit_per_minute   = var.api_gateway_token_rate_limit_per_minute
        })
      )
    }
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    google_apikeys_key.gateway_client,
    google_project_iam_member.api_gateway_function_invoker,
    google_project_iam_member.api_gateway_run_invoker,
    google_project_service.api_gateway_required,
    google_storage_bucket_iam_member.jwt_jwks_public,
    google_storage_bucket_object.jwt_jwks,
  ]
}

resource "google_api_gateway_gateway" "checkmail" {
  provider = google-beta

  project      = var.project_id
  region       = var.region
  gateway_id   = var.api_gateway_gateway_id
  display_name = var.api_gateway_display_name
  api_config   = google_api_gateway_api_config.checkmail.id

  depends_on = [google_api_gateway_api_config.checkmail]
}
