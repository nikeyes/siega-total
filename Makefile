.PHONY: install dev check test build size preview

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

size: build
	node scripts/check-size.mjs

preview:
	npm run preview
