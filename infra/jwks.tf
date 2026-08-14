resource "google_storage_bucket" "jwt_public_keys" {
  project                     = var.project_id
  name                        = "${var.project_id}-jwt-public-keys"
  location                    = "EU"
  uniform_bucket_level_access = true
  public_access_prevention    = "inherited"
}

resource "google_storage_bucket_object" "jwt_jwks" {
  bucket        = google_storage_bucket.jwt_public_keys.name
  name          = ".well-known/jwks.json"
  source        = "${path.module}/jwks.json"
  content_type  = "application/json"
  cache_control = "public, max-age=300"
}

resource "google_storage_bucket_iam_member" "jwt_jwks_public" {
  bucket = google_storage_bucket.jwt_public_keys.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

locals {
  jwt_jwks_uri = "https://storage.googleapis.com/${google_storage_bucket.jwt_public_keys.name}/${google_storage_bucket_object.jwt_jwks.name}"
}
