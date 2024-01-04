.PHONY: run
run:
	PORT=3001 yarn start

db-reset:
	rm packages/backend/dev.sqlite3
	yarn db-migrate
	yarn db-seed

docker-build:
	docker build -f ./docker/Dockerfile -t people-manager-repo .

docker-migration-build:
	docker build -f ./docker/Dockerfile.migration -t people-manager-migration-repo .

docker-run:
	docker run -p 3001:3001 -v $(pwd)/packages/backend:/backend people-manager-repo /backend/.env.local

lint-backend:
	cd packages/backend && yarn lint

lint-frontend:
	cd packages/frontend && yarn lint

lint: lint-backend lint-frontend

lint-fix-backend:
	cd packages/backend && yarn lint-fix

lint-fix-frontend:
	cd packages/frontend && yarn lint-fix

lint-fix: lint-fix-backend lint-fix-frontend

style-backend:
	cd packages/backend && yarn style

style-frontend:
	cd packages/frontend && yarn style

style: style-backend style-frontend

style-fix-backend:
	cd packages/backend && yarn style-fix

style-fix-frontend:
	cd packages/frontend && yarn style-fix

style-fix: style-fix-backend style-fix-frontend

build-backend:
	cd packages/backend && yarn build

build-frontend:
	cd packages/frontend && yarn build

build: build-backend build-frontend

test-backend:
	cd packages/backend && yarn test --all

test-frontend:
	cd packages/frontend && yarn test --all

test: test-backend test-frontend

ci: lint style build test

ci-fix: lint-fix style-fix
