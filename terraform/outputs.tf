# Log the url to the backend
output "backend_url" {
  value = aws_alb.application_load_balancer.dns_name
}

# Log the url to the frontend
output "frontend_url" {
  value = module.s3.website_url
}

# Log the url to the frontend's s3 bucket
output "s3_url" {
  value = module.s3.s3_url
}
