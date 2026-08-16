terraform {
  backend "gcs" {
    bucket = "checkmail-plugin-backend-dev-state"
    prefix = "terraform/dev"
  }
}
