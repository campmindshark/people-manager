variable "project_name" {
  type    = string
  default = "people-manager"
}

resource "random_password" "db_password" {
  length  = 32
  upper   = true
  special = false
}
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds"
  description = "Allow all inbound for Postgres"
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
resource "aws_db_instance" "people_manager_postgres" {
  identifier             = "${var.project_name}-db"
  instance_class         = "db.t3.micro"
  allocated_storage      = 5
  engine                 = "postgres"
  engine_version         = "15.4"
  skip_final_snapshot    = true
  publicly_accessible    = true
  vpc_security_group_ids = [aws_security_group.rds.id]
  username               = "postgres"
  password               = random_password.db_password.result
}
output "db_arn" {
  value = aws_db_instance.people_manager_postgres.arn
}

output "db_endpoint" {
  value = aws_db_instance.people_manager_postgres.endpoint
}

output "db_username" {
  value = aws_db_instance.people_manager_postgres.username
}

output "db_password" {
  value = random_password.db_password.result
}
