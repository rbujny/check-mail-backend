locals {
  cloudsql_postgres_database_name = "app"
  cloudsql_postgres_instance_name = "${var.project_id}-postgres"
  cloudsql_postgres_tier          = "db-f1-micro"
  cloudsql_postgres_user_name     = "check_mail_user"
}

resource "google_project_service" "cloudsql" {
  project            = var.project_id
  service            = "sqladmin.googleapis.com"
  disable_on_destroy = false
}

resource "google_sql_database_instance" "postgres" {
  name             = local.cloudsql_postgres_instance_name
  project          = var.project_id
  region           = var.region
  database_version = "POSTGRES_18"

  deletion_protection = true

  settings {
    availability_type = "ZONAL"
    disk_autoresize   = false
    disk_size         = 10
    disk_type         = "PD_SSD"
    tier              = local.cloudsql_postgres_tier

    ip_configuration {
      ipv4_enabled = true
    }
  }

  depends_on = [google_project_service.cloudsql]
}

resource "google_sql_database" "postgres_app" {
  name     = local.cloudsql_postgres_database_name
  instance = google_sql_database_instance.postgres.name
  project  = var.project_id
}

resource "google_sql_user" "postgres_app_user" {
  instance = google_sql_database_instance.postgres.name
  name     = local.cloudsql_postgres_user_name
  password = var.db_password
  project  = var.project_id
}

output "cloudsql_postgres_connection_name" {
  description = "Cloud SQL PostgreSQL connection name."
  value       = google_sql_database_instance.postgres.connection_name
}

output "cloudsql_postgres_database_name" {
  description = "Cloud SQL PostgreSQL database name."
  value       = google_sql_database.postgres_app.name
}

output "cloudsql_postgres_instance_name" {
  description = "Cloud SQL PostgreSQL instance name."
  value       = google_sql_database_instance.postgres.name
}

output "cloudsql_postgres_public_ip" {
  description = "Cloud SQL PostgreSQL public IP address."
  value       = google_sql_database_instance.postgres.public_ip_address
}

output "cloudsql_postgres_user_name" {
  description = "Cloud SQL PostgreSQL application user name."
  value       = google_sql_user.postgres_app_user.name
}