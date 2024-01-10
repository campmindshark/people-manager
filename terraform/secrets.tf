# Secret Variables
variable "google_oauth_client_id" {
  description = "Google Oauth Client ID"
  type        = string
  sensitive   = true
}

variable "google_oauth_client_secret" {
  description = "Google Oauth Client Secret"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Secret random string for JWT signing"
  type        = string
  sensitive   = true
}
