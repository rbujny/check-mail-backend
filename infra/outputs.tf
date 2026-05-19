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

output "api_gateway_url" {
  description = "Public HTTPS URL for the API Gateway."
  value       = "https://${google_api_gateway_gateway.checkmail.default_hostname}"
}

output "api_gateway_managed_service" {
  description = "Managed service name created for the API Gateway API."
  value       = google_api_gateway_api.checkmail.managed_service
}
