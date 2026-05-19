variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "region" {
  description = "GCP region for the Cloud Function."
  type        = string
}

variable "function_env_overrides" {
  description = "Per-function environment variable overrides keyed by function directory name."
  type        = map(map(string))
  default     = {}
}

variable "db_password" {
  description = "Cloud SQL DB password"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.db_password) > 0
    error_message = "db_password must be provided by the deployment workflow through TF_VAR_db_password."
  }
}

variable "jwt_secret" {
  description = "Secret used by the auth function to sign JWTs."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.jwt_secret) > 0
    error_message = "jwt_secret must be provided by the deployment workflow through TF_VAR_jwt_secret."
  }
}

variable "jwt_issuer" {
  description = "Issuer claim used by the auth function."
  type        = string
}

variable "jwt_audience" {
  description = "Audience claim used by the auth function."
  type        = string
}

variable "jwt_expires_in" {
  description = "Default JWT lifetime used by the auth function."
  type        = string
}
