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
