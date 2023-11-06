.PHONY: run
run:
	PORT=3001 yarn start

build-docker:
	docker build -t people-manager .
