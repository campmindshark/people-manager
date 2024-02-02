locals {
  frontend_domain = var.domain
}

resource "aws_route53_record" "frontend" {
  zone_id = data.aws_route53_zone.app.zone_id
  type    = "A"
  name    = var.domain

  alias {
    name                   = module.s3.website_url
    zone_id                = module.s3.hosted_zone_id
    evaluate_target_health = false
  }
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
  provider = aws.us-east-1

  domain_name       = local.frontend_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "frontend" {
  provider = aws.us-east-1

  for_each                = aws_route53_record.frontend_cert_validation
  certificate_arn         = aws_acm_certificate.frontend.arn
  validation_record_fqdns = [each.value.fqdn]

  depends_on = [aws_route53_record.frontend_cert_validation]
}
