.PHONY: run
run:
	PORT=3001 yarn start

docker-build:
	docker build -t people-manager .
