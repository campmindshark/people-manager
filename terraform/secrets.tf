# Secret Variables
variable "GOOGLE_OAUTH_CLIENT_ID" {
  description = "Google Oauth Client ID"
  type        = string
}

variable "GOOGLE_OAUTH_CLIENT_SECRET" {
  description = "Google Oauth Client Secret"
  type        = string
  sensitive   = true
}

variable "JWT_SECRET" {
  description = "Secret random string for JWT signing"
  type        = string
  sensitive   = true
}

# Create and set Google Client Secret
resource "aws_secretsmanager_secret" "googleClientSecret" {
  name = "${var.project_name}-google-client-secret"
}

resource "aws_secretsmanager_secret_version" "googleClientSecretVersion" {
  secret_id     = aws_secretsmanager_secret.googleClientSecret.id
  secret_string = var.GOOGLE_OAUTH_CLIENT_SECRET
}

# Create and set JWT secret
resource "aws_secretsmanager_secret" "jwtSecret" {
  name = "${var.project_name}-jwt-secret"
}

resource "aws_secretsmanager_secret_version" "jwtSecretVersion" {
  secret_id     = aws_secretsmanager_secret.jwtSecret.id
  secret_string = var.JWT_SECRET
}

# Create and set Postgres Connection URL
resource "aws_secretsmanager_secret" "postgresConnectionURL" {
  name = "${var.project_name}-postgres-connection-url"
}

resource "aws_secretsmanager_secret_version" "postgresSecretVersion" {
  secret_id     = aws_secretsmanager_secret.postgresConnectionURL.id
  secret_string = "postgresql://${module.rds.db_username}:${module.rds.db_password}@${module.rds.db_endpoint}"
}
