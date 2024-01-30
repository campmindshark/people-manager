resource "aws_alb_listener" "https" {
  load_balancer_arn = aws_alb.application_load_balancer.id
  port              = var.https_port
  protocol          = "HTTPS"
  certificate_arn   = aws_acm_certificate_validation.cert.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_alb_target_group.application_load_balancer.id
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
  name    = aws_acm_certificate.cert.domain_validation_options[0].resource_record_name
  type    = aws_acm_certificate.cert.domain_validation_options[0].resource_record_type
  zone_id = data.aws_route53_zone.app.id
  records = [aws_acm_certificate.cert.domain_validation_options[0].resource_record_value]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "cert" {
  certificate_arn         = aws_acm_certificate.cert.arn
  validation_record_fqdns = [aws_route53_record.cert_validation.fqdn]
}
