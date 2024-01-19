#!/usr/bin/env bash

DB_DETAILS_RAW=$(aws rds describe-db-instances --region us-west-2 --db-instance-identifier people-manager-db)
DB_HOST=$(echo $DB_DETAILS_RAW | jq -r '.DBInstances[0].Endpoint.Address')
DB_PORT=$(echo $DB_DETAILS_RAW | jq -r '.DBInstances[0].Endpoint.Port')
DB_USERNAME=$(echo $DB_DETAILS_RAW | jq -r '.DBInstances[0].MasterUsername')

AUTH_TOKEN=$(aws rds generate-db-auth-token --hostname $DB_HOST --port $DB_PORT --region us-west-2 --username $DB_USERNAME)

AUTH_URL="postgresql://$DB_USERNAME:$AUTH_TOKEN@$DB_HOST:$DB_PORT/people-manager-db"

echo "Running db-migrate with $AUTH_URL"

POSTGRES_CONNECTION_URL=$AUTH_URL yarn db-migrate
