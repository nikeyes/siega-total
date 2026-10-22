.PHONY: install dev check test build size preview e2e simulate

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

# Plays the built game in the installed Chrome; fails on any console error.
e2e: build
	npx playwright test

# Plays the campaign with a bot and prints coins, time left and blade size level by level.
simulate:
	node scripts/simulate.mjs
