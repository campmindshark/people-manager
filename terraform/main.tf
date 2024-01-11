terraform {
  backend "s3" {
    bucket = "home-terraform-1"
    key    = "people-manager.tfstate"
    region = "us-east-1"
  }
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}

provider "aws" {
  region = var.region
}

# Define ECS Cluster
resource "aws_ecs_cluster" "my_cluster" {
  name = "${var.project_name}-cluster"
}

# Define Primary ECS Task Definition for running people-manager
resource "aws_ecs_task_definition" "app_task" {
  family                   = "${var.project_name}-task"
  container_definitions    = <<DEFINITION
  [
    {
      "name": "${var.project_name}-task",
      "image": "${var.docker_repo}",
      "essential": true,
      "portMappings": [
        {
          "containerPort": ${var.port_number},
          "hostPort": ${var.port_number}
        }
      ],
      "memory": 512,
      "cpu": 256,
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "${var.project_name}",
          "awslogs-region": "${var.region}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "secrets": [
        {
          "valueFrom": "${aws_secretsmanager_secret.googleClientID.arn}",
          "name": "GOOGLE_OAUTH_CLIENT_ID"
        },
        {
          "valueFrom": "${aws_secretsmanager_secret.googleClientSecret.arn}",
          "name": "GOOGLE_OAUTH_CLIENT_SECRET"
        },
        {
          "valueFrom": "${aws_secretsmanager_secret.jwtSecret.arn}",
          "name": "JWT_SECRET"
        }
      ]
    }
  ]
  DEFINITION
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  memory                   = 512
  cpu                      = 256
  execution_role_arn       = aws_iam_role.ecsTaskExecutionRole.arn
}

# Define CloudWatch Log Group for log collection
module "log_group" {
  source  = "terraform-aws-modules/cloudwatch/aws//modules/log-group"
  version = "~> 3.0"

  name              = var.project_name
  retention_in_days = 120
}

# Define IAM Role for the running containers
resource "aws_iam_role" "ecsTaskExecutionRole" {
  name               = "ecsTaskExecutionRole"
  assume_role_policy = data.aws_iam_policy_document.assume_role_policy.json
}

data "aws_iam_policy_document" "assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "ecsTaskExecutionRole_policy" {
  role       = aws_iam_role.ecsTaskExecutionRole.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_policy" "container_access_policy" {
  name        = "container_access_policy"
  description = "Policy for the container"
  policy      = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "*"
    }
  ]
}
EOF
}

resource "aws_iam_policy_attachment" "ecsTaskExecutionRole_access_policy_bind" {
  name       = "ecsTaskExecutionRole_access_policy_bind"
  roles      = [aws_iam_role.ecsTaskExecutionRole.name]
  policy_arn = aws_iam_policy.container_access_policy.arn
}


# Provide a reference to your default VPC
resource "aws_default_vpc" "default_vpc" {

}

# Provide references to your default subnets
resource "aws_default_subnet" "default_subnet_a" {
  # Use your own region here but reference to subnet a
  availability_zone = "${var.region}a"
}

resource "aws_default_subnet" "default_subnet_b" {
  # Use your own region here but reference to subnet b
  availability_zone = "${var.region}b"
}

resource "aws_alb" "application_load_balancer" {
  name               = "${var.project_name}-load-balancer" # Naming our load balancer
  load_balancer_type = "application"
  subnets = [ # Referencing the default subnets
    "${aws_default_subnet.default_subnet_a.id}",
    "${aws_default_subnet.default_subnet_b.id}"
  ]
  # Referencing the security group
  security_groups = ["${aws_security_group.load_balancer_security_group.id}"]
}

# Creating a security group for the load balancer:
resource "aws_security_group" "load_balancer_security_group" {
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Allowing traffic in from all sources
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb_target_group" "target_group" {
  name        = var.project_name
  port        = 80
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_default_vpc.default_vpc.id # Referencing the default VPC

  health_check {
    healthy_threshold   = "3"
    interval            = "300"
    protocol            = "HTTP"
    matcher             = "200"
    timeout             = "3"
    path                = "/v1/api/health"
    unhealthy_threshold = "2"
  }
}

resource "aws_lb_listener" "listener" {
  load_balancer_arn = aws_alb.application_load_balancer.id # Referencing our load balancer
  port              = "80"
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.target_group.id # Referencing our target group
  }
}

resource "aws_ecs_service" "app_service" {
  name            = "${var.project_name}-service"        # Name the  service
  cluster         = aws_ecs_cluster.my_cluster.id        # Reference the created Cluster
  task_definition = aws_ecs_task_definition.app_task.arn # Reference the task that the service will spin up
  launch_type     = "FARGATE"
  desired_count   = 1 # Set up the number of containers to 3

  load_balancer {
    target_group_arn = aws_lb_target_group.target_group.arn # Reference the target group
    container_name   = aws_ecs_task_definition.app_task.family
    container_port   = var.port_number # Specify the container port
  }

  network_configuration {
    subnets          = ["${aws_default_subnet.default_subnet_a.id}", "${aws_default_subnet.default_subnet_b.id}"]
    assign_public_ip = true                                                # Provide the containers with public IPs
    security_groups  = ["${aws_security_group.service_security_group.id}"] # Set up the security group
  }
}

resource "aws_security_group" "service_security_group" {
  ingress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    # Only allowing traffic in from the load balancer security group
    security_groups = ["${aws_security_group.load_balancer_security_group.id}"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

#Log the load balancer app url
output "app_url" {
  value = aws_alb.application_load_balancer.dns_name
}
