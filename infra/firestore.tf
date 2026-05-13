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
