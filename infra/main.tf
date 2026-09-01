provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

locals {
  function_config_files = fileset("${path.module}/../functions", "*/function.json")

  functions = {
    for relative_path in local.function_config_files :
    basename(dirname(relative_path)) => merge(
      {
        available_memory      = "256M"
        directory             = basename(dirname(relative_path))
        entry_point           = "handler"
        environment_variables = {}
        ingress_settings      = "ALLOW_ALL"
        max_instance_count    = 1
        name                  = basename(dirname(relative_path))
        runtime               = "nodejs20"
        timeout_seconds       = 60
      },
      jsondecode(file("${path.module}/../functions/${relative_path}"))
    )
  }
}

resource "google_project_service" "required" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudfunctions.googleapis.com",
    "logging.googleapis.com",
    "run.googleapis.com",
    "storage.googleapis.com",
    "aiplatform.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "google_storage_bucket" "function_source" {
  name                        = "${var.project_id}-function-source-${random_id.suffix.hex}"
  location                    = "EU"
  project                     = var.project_id
  uniform_bucket_level_access = true
}

data "archive_file" "function_source" {
  for_each    = local.functions
  type        = "zip"
  output_path = "${path.module}/${each.key}.zip"
  source_dir  = "${path.module}/../functions/${each.value.directory}"
}

resource "google_storage_bucket_object" "function_archive" {
  for_each = local.functions

  name   = "${each.key}-${data.archive_file.function_source[each.key].output_md5}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.function_source[each.key].output_path
}

resource "google_cloudfunctions2_function" "functions" {
  for_each = local.functions

  name     = each.value.name
  location = var.region
  project  = var.project_id

  build_config {
    runtime     = each.value.runtime
    entry_point = each.value.entry_point

    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.function_archive[each.key].name
      }
    }
  }

  service_config {
    available_memory               = each.value.available_memory
    all_traffic_on_latest_revision = true
    environment_variables = merge(
      each.value.environment_variables,
      each.key == "auth" ? {
        JWT_AUDIENCE    = var.api_gateway_jwt_audience
        JWT_EXPIRES_IN  = var.jwt_expires_in
        JWT_ISSUER      = var.api_gateway_jwt_issuer
        JWT_KEY_ID      = var.jwt_key_id
        JWT_PRIVATE_KEY = var.jwt_private_key
      } : {},
      each.key == "process" ? {
        EMBEDDING_DIMENSION    = tostring(var.rag_embedding_dimension)
        EMBEDDING_MODEL_ID     = var.rag_embedding_model_id
        GOOGLE_CLOUD_PROJECT   = var.project_id
        LLM_MODEL_ID           = var.llm_model_id
        LLM_PROVIDER           = var.llm_provider
        LLM_TIMEOUT_MS         = tostring(var.llm_timeout_ms)
        RAG_COLLECTION         = var.rag_collection
        RAG_CORPUS_VERSION     = var.rag_corpus_version
        RAG_ENABLED            = tostring(var.rag_enabled)
        RAG_TOP_K              = tostring(var.rag_top_k)
        PROCESS_RESULTS_BUCKET = google_storage_bucket.process_results.name
        VERTEX_LOCATION        = var.vertex_ai_location
      } : {},
      lookup(var.function_env_overrides, each.key, {}),
    )
    service_account_email = each.key == "process" ? google_service_account.process.email : null
    ingress_settings      = each.value.ingress_settings
    max_instance_count    = each.value.max_instance_count
    timeout_seconds       = each.value.timeout_seconds
  }

  depends_on = [
    google_project_service.required,
    google_project_iam_member.process_permissions,
    google_storage_bucket_iam_member.process_results_writer,
  ]
}
