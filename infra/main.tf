provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_project_service" "required" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudfunctions.googleapis.com",
    "run.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "google_storage_bucket" "function_source" {
  name                        = "${var.project_id}-function-source-${random_id.suffix.hex}"
  location                    = "EU"
  project                     = var.project_id
  uniform_bucket_level_access = true
}

data "archive_file" "function_source" {
  type        = "zip"
  output_path = "${path.module}/basic-http.zip"
  source_dir  = "${path.module}/../functions/basic-http"
}

resource "google_storage_bucket_object" "function_archive" {
  name   = "basic-http-${data.archive_file.function_source.output_md5}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.function_source.output_path
}

resource "google_cloudfunctions2_function" "basic_http" {
  name     = var.function_name
  location = var.region
  project  = var.project_id

  build_config {
    runtime     = "nodejs20"
    entry_point = "helloHttp"

    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.function_archive.name
      }
    }
  }

  service_config {
    available_memory      = "256M"
    ingress_settings      = "ALLOW_ALL"
    max_instance_count    = 1
    timeout_seconds       = 60
    all_traffic_on_latest_revision = true
  }

  depends_on = [google_project_service.required]
}
