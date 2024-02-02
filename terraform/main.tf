module "s3" {
  source = "./s3"

  project_name    = var.project_name
  domain_name     = local.frontend_subdomain
  certificate_arn = aws_acm_certificate.frontend.arn

  depends_on = [aws_acm_certificate.frontend]
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
      "image": "${var.docker_repo}:${var.docker_image_tag}",
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
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "BACKEND_URL",
          "value": "http://${aws_alb.application_load_balancer.dns_name}"
        },
        {
          "name": "CORS_WHITELIST_CSV",
          "value": "http://${module.s3.website_url},http://${aws_alb.application_load_balancer.dns_name}"
        },
        {
          "name": "GOOGLE_OAUTH_CALLBACK_URL",
          "value": "http://${aws_alb.application_load_balancer.dns_name}/api/auth/google/callback"
        },
        {
          "name": "FRONTEND_URL",
          "value": "http://${module.s3.website_url}"
        }
      ],
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
        },
        {
          "valueFrom": "${aws_secretsmanager_secret.postgresConnectionURL.arn}",
          "name": "POSTGRES_CONNECTION_URL"
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

resource "aws_ecs_task_definition" "db_migration_task" {
  family                   = "${var.project_name}-db-migration-task"
  container_definitions    = <<DEFINITION
  [
    {
      "name": "${var.project_name}-db-migration",
      "image": "${var.docker_repo}:latest-migration",
      "essential": true,
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
      "entryPoint": [
        "yarn"
      ],
      "command": [
        "db-migrate"
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "valueFrom": "${aws_secretsmanager_secret.postgresConnectionURL.arn}",
          "name": "POSTGRES_CONNECTION_URL"
        }
      ],
      "runtimePlatform": {
        "operatingSystemFamily": "LINUX"
      }
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

resource "aws_iam_policy_attachment" "ecsTaskExecutionRole_container_access_policy_bind" {
  name       = "ecsTaskExecutionRole_container_access_policy_bind"
  roles      = [aws_iam_role.ecsTaskExecutionRole.name]
  policy_arn = aws_iam_policy.container_access_policy.arn

  depends_on = [aws_iam_policy.container_access_policy]
}

resource "aws_iam_policy" "rds_access_policy" {
  name        = "rds_access_policy"
  description = "Allow access to RDS"
  policy      = <<EOF
{
   "Version": "2012-10-17",
   "Statement": [
      {
         "Effect": "Allow",
         "Action": [
             "rds-db:connect"
         ],
         "Resource": [
             "${module.rds.db_arn}"
         ]
      }
   ]
}
EOF
}

resource "aws_iam_policy_attachment" "ecsTaskExecutionRole_rds_policy_bind" {
  name       = "ecsTaskExecutionRole_rds_policy_bind"
  roles      = [aws_iam_role.ecsTaskExecutionRole.name]
  policy_arn = aws_iam_policy.rds_access_policy.arn
  depends_on = [aws_iam_policy.rds_access_policy]
}

# Define Postgres RDS
module "rds" {
  source       = "./rds"
  project_name = var.project_name
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
