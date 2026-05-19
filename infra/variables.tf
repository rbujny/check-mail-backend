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

variable "jwt_issuer" {
  description = "Issuer claim expected by API Gateway for Checkmail JWTs."
  type        = string
  default     = "checkmail-backend"
}

variable "jwt_audience" {
  description = "Audience claim expected by API Gateway for Checkmail JWTs."
  type        = string
  default     = "checkmail-clients"
}

variable "api_gateway_id" {
  description = "API Gateway API identifier."
  type        = string
  default     = "checkmail-api"
}

variable "api_gateway_config_id" {
  description = "API Gateway API config identifier. Change this value when the OpenAPI document changes because API Gateway configs are immutable."
  type        = string
  default     = "checkmail-api-config-v1"
}

variable "api_gateway_gateway_id" {
  description = "API Gateway gateway identifier."
  type        = string
  default     = "checkmail-api-gateway"
}

variable "db_password" {
  description = "Cloud SQL DB password"
  type        = string
  default     = ""
}
