terraform {
  backend "gcs" {
    bucket = "checkmail-plugin-dev-state"
    prefix = "terraform/dev"
  }
}
