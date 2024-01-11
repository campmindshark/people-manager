# Secret Variables
variable "GOOGLE_OAUTH_CLIENT_ID" {
  description = "Google Oauth Client ID"
  type        = string
  sensitive   = true
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

# Secret Setting
resource "aws_secretsmanager_secret" "googleClientID" {
  name = "${var.project_name}-google-client-id"
}

resource "aws_secretsmanager_secret_version" "googleClientIDVersion" {
  secret_id     = aws_secretsmanager_secret.googleClientID.id
  secret_string = var.GOOGLE_OAUTH_CLIENT_ID
}

resource "aws_secretsmanager_secret" "googleClientSecret" {
  name = "${var.project_name}-google-client-secret"
}

resource "aws_secretsmanager_secret_version" "googleClientSecretVersion" {
  secret_id     = aws_secretsmanager_secret.googleClientSecret.id
  secret_string = var.GOOGLE_OAUTH_CLIENT_ID
}

resource "aws_secretsmanager_secret" "jwtSecret" {
  name = "${var.project_name}-jwt-secret"
}

resource "aws_secretsmanager_secret_version" "jwtSecretVersion" {
  secret_id     = aws_secretsmanager_secret.jwtSecret.id
  secret_string = var.JWT_SECRET
}
