variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "region" {
  description = "GCP region for the Cloud Function."
  type        = string
}

variable "github_actions_service_account_email" {
  description = "Service account email impersonated by GitHub Actions deployment and benchmark workflows."
  type        = string

  validation {
    condition     = can(regex("^[^@]+@[^@]+\\.iam\\.gserviceaccount\\.com$", var.github_actions_service_account_email))
    error_message = "github_actions_service_account_email must be a Google service account email."
  }
}

variable "function_env_overrides" {
  description = "Per-function environment variable overrides keyed by function directory name."
  type        = map(map(string))
  default     = {}
}

variable "process_results_retention_days" {
  description = "Number of days successful process result objects are retained in Cloud Storage."
  type        = number
  default     = 90

  validation {
    condition     = var.process_results_retention_days > 0 && floor(var.process_results_retention_days) == var.process_results_retention_days
    error_message = "process_results_retention_days must be a positive whole number."
  }
}

variable "llm_provider" {
  description = "Active production LLM provider for non-phishing heuristic results."
  type        = string
  default     = "gemini"

  validation {
    condition     = contains(["gemini", "claude", "openai-compatible"], var.llm_provider)
    error_message = "llm_provider must be gemini, claude, or openai-compatible."
  }
}

variable "llm_model_id" {
  description = "Active production model ID."
  type        = string
  default     = "gemini-3.5-flash-lite"
}

variable "llm_timeout_ms" {
  description = "Total timeout for one model or embedding request in milliseconds."
  type        = number
  default     = 10000
}

variable "vertex_ai_location" {
  description = "Vertex AI location used by the production model and embedding endpoint."
  type        = string
  default     = "global"
}

variable "rag_enabled" {
  description = "Whether production analysis retrieves Firestore vector context before calling the LLM."
  type        = bool
  default     = true
}

variable "rag_collection" {
  description = "Firestore collection containing versioned RAG documents."
  type        = string
  default     = "checkmail_rag_documents"
}

variable "rag_corpus_version" {
  description = "Active RAG corpus version."
  type        = string
  default     = "v1"
}

variable "rag_top_k" {
  description = "Maximum number of nearest RAG documents supplied to the model."
  type        = number
  default     = 5
}

variable "rag_embedding_model_id" {
  description = "Vertex AI embedding model used for corpus and query vectors."
  type        = string
  default     = "gemini-embedding-001"
}

variable "rag_embedding_dimension" {
  description = "Embedding dimension shared by Vertex AI and the Firestore vector index."
  type        = number
  default     = 768
}

variable "db_password" {
  description = "Cloud SQL DB password"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.db_password) > 0
    error_message = "db_password must be provided by the deployment workflow."
  }
}

variable "api_gateway_jwt_issuer" {
  description = "JWT issuer accepted by API Gateway; must match JWT_ISSUER in the auth function."
  type        = string
}

variable "api_gateway_jwt_audience" {
  description = "JWT audience accepted by API Gateway; must match JWT_AUDIENCE in the auth function."
  type        = string
}

variable "jwt_private_key" {
  description = "RSA private key used by the auth function to sign JWTs."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.jwt_private_key) > 0
    error_message = "jwt_private_key must be provided by the deployment workflow."
  }
}

variable "jwt_key_id" {
  description = "JWT key ID matching the public key entry in the JWKS document."
  type        = string

  validation {
    condition     = length(var.jwt_key_id) > 0
    error_message = "jwt_key_id must not be empty."
  }
}

variable "jwt_expires_in" {
  description = "Default JWT lifetime used by the auth function, for example 1h."
  type        = string

  validation {
    condition     = length(var.jwt_expires_in) > 0
    error_message = "jwt_expires_in must not be empty."
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
