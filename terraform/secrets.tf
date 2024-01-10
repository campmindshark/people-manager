# Secret Variables
variable "GOOGLE_OAUTH_CLIENT_ID" {
  description = "Google Oauth Client ID"
  type        = string
  sensitive   = true
}

variable "google_GOOGLE_OAUTH_CLIENT_SECRET" {
  description = "Google Oauth Client Secret"
  type        = string
  sensitive   = true
}

variable "JWT_SECRET" {
  description = "Secret random string for JWT signing"
  type        = string
  sensitive   = true
}
