.PHONY: install dev check test build size preview e2e e2e-headed e2e-ui e2e-debug simulate icon

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

# The same tests in a Chrome window you can watch.
e2e-headed: build
	npx playwright test --headed

# Playwright's interface: pick a test, watch it and step back through a timeline with a snapshot of every action.
e2e-ui: build
	npx playwright test --ui

# Runs the tests one action at a time, stopping before each one.
e2e-debug: build
	npx playwright test --debug

# Plays the campaign with a bot and prints coins, time left and blade size level by level.
simulate:
	node scripts/simulate.mjs

icon:
	node scripts/render-icon.mjs
