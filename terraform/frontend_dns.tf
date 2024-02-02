locals {
  frontend_subdomain = "www.${var.domain}"
}

resource "aws_route53_record" "frontend" {
  zone_id = data.aws_route53_zone.app.zone_id
  type    = "A"
  name    = local.frontend_subdomain
  records = [module.s3.website_url]
  ttl     = "30"
}

resource "aws_route53_record" "frontend_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.frontend.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
  name    = each.value.name
  type    = each.value.type
  zone_id = data.aws_route53_zone.app.id
  records = [each.value.record]
  ttl     = 60
}


resource "aws_acm_certificate" "frontend" {
  domain_name       = local.frontend_subdomain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "frontend" {
  for_each                = aws_route53_record.frontend_cert_validation
  certificate_arn         = aws_acm_certificate.frontend.arn
  validation_record_fqdns = [each.value.fqdn]

  depends_on = [aws_route53_record.frontend_cert_validation]
}
