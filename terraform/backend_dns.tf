locals {
  backend_subdomain = "people-manager.${var.domain}"
}

resource "aws_route53_record" "backend" {
  zone_id = data.aws_route53_zone.app.zone_id
  type    = "CNAME"
  name    = local.backend_subdomain
  records = [aws_alb.application_load_balancer.dns_name]
  ttl     = "30"
}

resource "aws_route53_record" "backend_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.backend.domain_validation_options : dvo.domain_name => {
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


resource "aws_acm_certificate" "backend" {
  domain_name       = local.backend_subdomain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "backend" {
  for_each                = aws_route53_record.backend_cert_validation
  certificate_arn         = aws_acm_certificate.backend.arn
  validation_record_fqdns = [each.value.fqdn]

  depends_on = [aws_route53_record.backend_cert_validation]
}
