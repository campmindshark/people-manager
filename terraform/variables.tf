variable "project_name" {
  type    = string
  default = "people-manager"
}

variable "port_number" {
  type    = number
  default = "3000"
}

variable "region" {
  type    = string
  default = "us-west-2"
}

variable "docker_repo" {
  type    = string
  default = "rnavt/people-manager"
}
