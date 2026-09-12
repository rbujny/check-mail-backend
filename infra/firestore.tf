locals {
  firestore_database_id = "(default)"
  firestore_location_id = var.region
}

resource "google_project_service" "firestore" {
  project            = var.project_id
  service            = "firestore.googleapis.com"
  disable_on_destroy = false
}

resource "google_firestore_database" "default" {
  project     = var.project_id
  name        = local.firestore_database_id
  location_id = local.firestore_location_id
  type        = "FIRESTORE_NATIVE"

  delete_protection_state = "DELETE_PROTECTION_ENABLED"

  depends_on = [google_project_service.firestore]
}

resource "google_firestore_index" "rag_vector" {
  project     = var.project_id
  database    = google_firestore_database.default.name
  collection  = var.rag_collection
  query_scope = "COLLECTION"

  fields {
    field_path = "corpusVersion"
    order      = "ASCENDING"
  }

  fields {
    field_path = "__name__"
    order      = "ASCENDING"
  }

  fields {
    field_path = "embedding"

    vector_config {
      dimension = var.rag_embedding_dimension
      flat {}
    }
  }
}

resource "google_service_account" "process" {
  project      = var.project_id
  account_id   = "checkmail-process"
  display_name = "CheckMail Process Function"
}

resource "google_project_iam_member" "process_permissions" {
  for_each = toset([
    "roles/aiplatform.user",
    "roles/cloudsql.client",
    "roles/datastore.viewer",
    "roles/logging.logWriter",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.process.email}"
}

output "firestore_database_id" {
  description = "Firestore database ID."
  value       = google_firestore_database.default.name
}

output "firestore_database_location" {
  description = "Firestore database location."
  value       = google_firestore_database.default.location_id
}

output "firestore_database_type" {
  description = "Firestore database type."
  value       = google_firestore_database.default.type
}
