resource "aws_alb_listener" "https" {
  for_each = aws_acm_certificate_validation.backend

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
  to_port           = var.port_number
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.load_balancer_security_group.id
}
