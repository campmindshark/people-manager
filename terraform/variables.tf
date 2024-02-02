variable "project_name" {
  type    = string
  default = "people-manager"
}

variable "port_number" {
  type    = number
  default = "3001"
}

variable "https_port" {
  default = "443"
}

variable "region" {
  type    = string
  default = "us-west-2"
}

variable "docker_repo" {
  type    = string
  default = "rnavt/people-manager"
}

variable "docker_image_tag" {
  type    = string
  default = "latest"
}

variable "domain" {
  type    = string
  default = "mindsharkportal.com"
}
