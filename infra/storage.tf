resource "google_storage_bucket" "process_results" {
  name                        = "${var.project_id}-process-results"
  location                    = var.region
  project                     = var.project_id
  force_destroy               = false
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = var.process_results_retention_days
    }

    action {
      type = "Delete"
    }
  }
}

resource "google_storage_bucket" "benchmark_summaries" {
  name                        = "${var.project_id}-benchmark-summaries"
  location                    = var.region
  project                     = var.project_id
  force_destroy               = false
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true
}

resource "google_storage_bucket_iam_member" "benchmark_summaries_writer" {
  bucket = google_storage_bucket.benchmark_summaries.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${var.github_actions_service_account_email}"
}
