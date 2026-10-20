.PHONY: install dev check test build preview

install:
	npm ci

dev:
	npm run dev

check:
	npm run check

test:
	npm test

build:
	npm run build

preview:
	npm run preview
