output "function_name" {
  description = "Deployed Cloud Function name."
  value       = google_cloudfunctions2_function.basic_http.name
}

output "function_uri" {
  description = "HTTPS URL of the deployed function."
  value       = google_cloudfunctions2_function.basic_http.service_config[0].uri
}
