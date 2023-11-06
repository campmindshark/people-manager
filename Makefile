.PHONY: run
run:
	PORT=3001 yarn start

docker-build:
	docker build -t people-manager .

docker-run-backend:
	docker run -it -p 3001:3001 people-manager packages/backend/build/index.js

docker-run-frontend:
	docker run -p 3000:3000 -d people-manager