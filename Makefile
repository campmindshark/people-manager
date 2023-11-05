.PHONY: run
run:
	PORT=3001 yarn start

buf-lint:
	docker run --volume "$(pwd):/workspace" --workdir /workspace bufbuild/buf lint

generate:
	buf mod update
	buf generate
