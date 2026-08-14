output "function_names" {
  description = "Deployed Cloud Function names keyed by function directory."
  value = {
    for key, function in google_cloudfunctions2_function.functions : key => function.name
  }
}

output "function_uris" {
  description = "HTTPS URLs of deployed functions keyed by function directory."
  value = {
    for key, function in google_cloudfunctions2_function.functions : key => function.service_config[0].uri
  }
}

output "api_gateway_name" {
  description = "Provisioned API Gateway name."
  value       = google_api_gateway_gateway.checkmail.name
}

output "api_gateway_default_hostname" {
  description = "Default hostname of the provisioned API Gateway."
  value       = google_api_gateway_gateway.checkmail.default_hostname
}

output "api_gateway_client_key" {
  description = "API key required for quota attribution on every gateway endpoint."
  value       = google_apikeys_key.gateway_client.key_string
  sensitive   = true
}

output "api_gateway_backend_service_account" {
  description = "Service account used by API Gateway to invoke backend services."
  value       = google_service_account.api_gateway_backend.email
}

output "jwt_jwks_uri" {
  description = "Public Cloud Storage URL used by API Gateway to verify JWT signatures."
  value       = local.jwt_jwks_uri
}
