"""LLM Backend — model-agnostic interface for text generation.

Supports multiple backends selected via model_config.yaml.
Implements retry logic with exponential backoff.
"""

from __future__ import annotations

import logging
import os
import time
from abc import ABC, abstractmethod
from typing import Any

import httpx

from reminder_agent.stage2.config_loader import ModelConfig, load_model_config

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
BASE_DELAY = 1.0  # seconds


class GenerationError(Exception):
    """Raised when text generation fails after all retries."""


# ---------------------------------------------------------------------------
# Abstract interface
# ---------------------------------------------------------------------------

class LLMBackend(ABC):
    """Abstract interface for LLM text generation."""

    def __init__(self, config: ModelConfig) -> None:
        self.config = config

    @abstractmethod
    def _call(self, system_prompt: str, user_prompt: str) -> str:
        """Make a single API call. Subclasses implement this."""

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        """Generate text with retry logic and exponential backoff."""
        last_error: Exception | None = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                result = self._call(system_prompt, user_prompt)
                result = result.strip()
                if not result:
                    raise GenerationError("Empty response from LLM")
                logger.info(
                    "Generation succeeded (attempt %d/%d): %d chars",
                    attempt, MAX_RETRIES, len(result),
                )
                return result
            except Exception as e:
                last_error = e
                delay = BASE_DELAY * (2 ** (attempt - 1))
                logger.warning(
                    "Generation attempt %d/%d failed: %s. Retrying in %.1fs...",
                    attempt, MAX_RETRIES, e, delay,
                )
                if attempt < MAX_RETRIES:
                    time.sleep(delay)

        raise GenerationError(
            f"Generation failed after {MAX_RETRIES} attempts. Last error: {last_error}"
        )


# ---------------------------------------------------------------------------
# Ollama backend
# ---------------------------------------------------------------------------

class OllamaBackend(LLMBackend):
    """Local Ollama instance — POST http://localhost:11434/api/generate."""

    def _call(self, system_prompt: str, user_prompt: str) -> str:
        base_url = self.config.base_url or "http://localhost:11434"
        url = f"{base_url}/api/chat"

        payload: dict[str, Any] = {
            "model": self.config.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": {
                "temperature": self.config.temperature,
                "num_predict": self.config.max_tokens,
            },
        }

        response = httpx.post(url, json=payload, timeout=120.0)
        response.raise_for_status()
        data = response.json()
        return data["message"]["content"]


# ---------------------------------------------------------------------------
# Together.ai backend
# ---------------------------------------------------------------------------

class TogetherBackend(LLMBackend):
    """Together.ai cloud API."""

    API_URL = "https://api.together.xyz/v1/chat/completions"

    def _call(self, system_prompt: str, user_prompt: str) -> str:
        api_key_env = self.config.api_key_env or "TOGETHER_API_KEY"
        api_key = os.environ.get(api_key_env)
        if not api_key:
            raise GenerationError(
                f"API key not found in environment variable '{api_key_env}'"
            )

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.config.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_tokens,
        }

        response = httpx.post(
            self.API_URL, headers=headers, json=payload, timeout=60.0
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# OpenAI backend
# ---------------------------------------------------------------------------

class OpenAIBackend(LLMBackend):
    """OpenAI API (or compatible, e.g. Qwen 百炼 via DashScope)."""

    DEFAULT_URL = "https://api.openai.com/v1/chat/completions"

    def _call(self, system_prompt: str, user_prompt: str) -> str:
        api_key_env = self.config.api_key_env or "OPENAI_API_KEY"
        api_key = os.environ.get(api_key_env)
        if not api_key:
            raise GenerationError(
                f"API key not found in environment variable '{api_key_env}'"
            )

        base_url = (self.config.base_url or self.DEFAULT_URL).rstrip("/")
        # If base_url doesn't end with a path segment like /chat/completions, append it
        if not base_url.endswith("/chat/completions"):
            url = f"{base_url}/chat/completions"
        else:
            url = base_url

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.config.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_tokens,
        }

        response = httpx.post(
            url, headers=headers, json=payload, timeout=60.0
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# Anthropic backend
# ---------------------------------------------------------------------------

class AnthropicBackend(LLMBackend):
    """Anthropic API."""

    API_URL = "https://api.anthropic.com/v1/messages"

    def _call(self, system_prompt: str, user_prompt: str) -> str:
        api_key_env = self.config.api_key_env or "ANTHROPIC_API_KEY"
        api_key = os.environ.get(api_key_env)
        if not api_key:
            raise GenerationError(
                f"API key not found in environment variable '{api_key_env}'"
            )

        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.config.model_name,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_tokens,
        }

        response = httpx.post(
            self.API_URL, headers=headers, json=payload, timeout=60.0
        )
        response.raise_for_status()
        data = response.json()
        return data["content"][0]["text"]


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

_BACKENDS: dict[str, type[LLMBackend]] = {
    "ollama": OllamaBackend,
    "together": TogetherBackend,
    "openai": OpenAIBackend,
    "anthropic": AnthropicBackend,
}


def create_backend(config: ModelConfig | None = None) -> LLMBackend:
    """Create an LLM backend from config."""
    if config is None:
        config = load_model_config()
    backend_cls = _BACKENDS.get(config.backend)
    if backend_cls is None:
        raise ValueError(
            f"Unknown backend '{config.backend}'. Available: {sorted(_BACKENDS.keys())}"
        )
    logger.info("Created %s backend: model=%s", config.backend, config.model_name)
    return backend_cls(config)


# ---------------------------------------------------------------------------
# CLI entry point — quick generation test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    backend = create_backend()
    print(f"Backend: {backend.config.backend} / {backend.config.model_name}")

    system = "You are a helpful assistant that generates short reminder messages."
    user = "Generate a brief reminder to take medicine after dinner."

    print("\nGenerating...")
    try:
        result = backend.generate(system, user)
        print(f"\nResult: {result}")
    except GenerationError as e:
        print(f"\nFailed: {e}")
