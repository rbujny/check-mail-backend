variable "project_id" {
  description = "GCP project ID."
  type        = string
  default     = "checkmailplugin"
}

variable "region" {
  description = "GCP region for the Cloud Function."
  type        = string
  default     = "europe-west1"
}

variable "function_env_overrides" {
  description = "Per-function environment variable overrides keyed by function directory name."
  type        = map(map(string))
  default     = {}
}

variable "db_password" {
  description = "Cloud SQL DB password"
  type        = string
  default     = ""
}