.PHONY: run
run:
	PORT=3001 yarn start

docker-build:
	docker build -t people-manager-repo .

docker-migration-build:
	docker build -f Dockerfile.migration -t people-manager-migration-repo .

docker-run:
	docker run -p 3001:3001 -v $(pwd)/packages/backend:/backend people-manager-repo /backend/.env.local
