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

variable "api_gateway_process_backend_url" {
  description = "HTTPS backend URL that should serve POST /process behind API Gateway."
  type        = string

  validation {
    condition     = startswith(var.api_gateway_process_backend_url, "https://")
    error_message = "The process backend URL must use HTTPS."
  }
}

variable "api_gateway_jwt_issuer" {
  description = "JWT issuer accepted by API Gateway; must match JWT_ISSUER in the auth function."
  type        = string
  default     = "checkmail-backend"
}

variable "api_gateway_jwt_audience" {
  description = "JWT audience accepted by API Gateway; must match JWT_AUDIENCE in the auth function."
  type        = string
  default     = "checkmail-clients"
}

variable "api_gateway_jwt_jwks_uri" {
  description = "Public HTTPS JWKS URL used by API Gateway to verify JWT signatures."
  type        = string

  validation {
    condition     = startswith(var.api_gateway_jwt_jwks_uri, "https://")
    error_message = "The JWKS URL must use HTTPS."
  }
}

variable "api_gateway_token_rate_limit_per_minute" {
  description = "Maximum POST /token requests per minute per API consumer project."
  type        = number
  default     = 10

  validation {
    condition     = var.api_gateway_token_rate_limit_per_minute > 0
    error_message = "Token rate limit must be greater than zero."
  }
}

variable "api_gateway_process_rate_limit_per_minute" {
  description = "Maximum POST /process requests per minute per API consumer project."
  type        = number
  default     = 60

  validation {
    condition     = var.api_gateway_process_rate_limit_per_minute > 0
    error_message = "Process rate limit must be greater than zero."
  }
}

variable "api_gateway_api_id" {
  description = "API Gateway API identifier."
  type        = string
  default     = "checkmail-api"
}

variable "api_gateway_api_config_id" {
  description = "Prefix for immutable API Gateway config identifiers."
  type        = string
  default     = "checkmail-api-config"
}

variable "api_gateway_gateway_id" {
  description = "API Gateway gateway identifier."
  type        = string
  default     = "checkmail-gateway"
}

variable "api_gateway_display_name" {
  description = "Display name for API Gateway resources."
  type        = string
  default     = "CheckMail Gateway"
}

variable "api_gateway_service_account_id" {
  description = "Service account ID used by API Gateway to invoke private backend functions."
  type        = string
  default     = "checkmail-api-gateway"
}
