resource "aws_alb_listener" "https" {
  for_each = aws_acm_certificate_validation.cert

  load_balancer_arn = aws_alb.application_load_balancer.id
  port              = var.https_port
  protocol          = "HTTPS"

  certificate_arn = each.value.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.target_group.id
  }
}

resource "aws_security_group_rule" "ingress_lb_https" {
  type              = "ingress"
  description       = "HTTPS"
  from_port         = var.https_port
  to_port           = var.https_port
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.load_balancer_security_group.id
}

data "aws_route53_zone" "app" {
  name = var.domain
}

locals {
  subdomain = "people-manager.${var.domain}"
}

resource "aws_route53_record" "dev" {
  zone_id = data.aws_route53_zone.app.zone_id
  type    = "CNAME"
  name    = local.subdomain
  records = [aws_alb.application_load_balancer.dns_name]
  ttl     = "30"
}

resource "aws_acm_certificate" "cert" {
  domain_name       = local.subdomain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.cert.domain_validation_options : dvo.domain_name => {
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

resource "aws_acm_certificate_validation" "cert" {
  for_each = {
    for cv in aws_route53_record.cert_validation : cv.fqdn => {
      record = cv
    }
  }
  certificate_arn         = aws_acm_certificate.cert.arn
  validation_record_fqdns = [each.value.record.fqdn]

  depends_on = [aws_route53_record.cert_validation]
}
