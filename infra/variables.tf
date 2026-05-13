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

variable "function_name" {
  description = "Cloud Function name."
  type        = string
  default     = "checkmail-basic-http"
}
