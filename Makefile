TODAY := $(shell date +"%m-%d")

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: backend
backend: ## Run the backend development server
	uv run --project backend uvicorn backend.main:app --reload --port 8100

.PHONY: frontend
frontend: ## Run the frontend development server
	cd frontend && npm run dev
