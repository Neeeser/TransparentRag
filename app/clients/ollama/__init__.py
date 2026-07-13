"""Typed client for the official Ollama API."""

from app.clients.ollama.catalog import OllamaCatalog
from app.clients.ollama.client import OllamaApiError, OllamaClient, get_ollama_client

__all__ = ["OllamaApiError", "OllamaCatalog", "OllamaClient", "get_ollama_client"]
