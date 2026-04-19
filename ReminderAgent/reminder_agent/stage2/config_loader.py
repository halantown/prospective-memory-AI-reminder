"""Config loader — loads and validates all YAML configuration files on startup.

Supports v3 EC operationalization (2 conditions: EC_off, EC_on).
Raises explicit errors on missing required fields rather than silently using defaults.
Follows guiding principle: "Fail loudly" (DEV_PLAN §Guiding Principles).
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"

VALID_BACKENDS = {"together", "ollama", "openai", "anthropic"}
VALID_CONDITIONS = {"EC_off", "EC_on"}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ModelConfig(BaseModel):
    backend: str
    model_name: str
    temperature: float = Field(ge=0.0, le=2.0)
    max_tokens: int = Field(gt=0)
    base_url: str | None = None
    api_key_env: str | None = None

    @field_validator("backend")
    @classmethod
    def _validate_backend(cls, v: str) -> str:
        if v not in VALID_BACKENDS:
            raise ValueError(f"backend must be one of {VALID_BACKENDS}, got '{v}'")
        return v


VALID_CONTEXT_FORMATS = {"prose", "json"}


class WordLimitEntry(BaseModel):
    min: int = Field(gt=0)
    max: int = Field(gt=0)


class GenerationConfig(BaseModel):
    n_variants: int = Field(gt=0)
    max_retries: int = Field(ge=0)
    min_words: int = Field(gt=0)
    max_words: int = Field(gt=0)
    similarity_threshold: float = Field(ge=0.0, le=1.0)
    context_format: str = "prose"
    ec_conditions: list[str] = ["EC_off", "EC_on"]
    word_limits: dict[str, WordLimitEntry] = {}

    @field_validator("max_words")
    @classmethod
    def _max_ge_min(cls, v: int, info: Any) -> int:
        min_w = info.data.get("min_words")
        if min_w is not None and v < min_w:
            raise ValueError(f"max_words ({v}) must be >= min_words ({min_w})")
        return v

    @field_validator("context_format")
    @classmethod
    def _validate_context_format(cls, v: str) -> str:
        if v not in VALID_CONTEXT_FORMATS:
            raise ValueError(f"context_format must be one of {VALID_CONTEXT_FORMATS}, got '{v}'")
        return v

    def get_word_limits(self, condition: str) -> tuple[int, int]:
        """Get (min_words, max_words) for a condition, falling back to global."""
        if condition in self.word_limits:
            entry = self.word_limits[condition]
            return entry.min, entry.max
        return self.min_words, self.max_words


"""
===========================================
*    ConditionFieldMap schema (v3)        *
===========================================

EC operationalization: 2 conditions
  EC_off: baseline only (action + target + recipient)
  EC_on:  baseline + ec_selected_features (entity + causality)

ConditionFieldMap
└── conditions (dict[str, ConditionEntry])
    ├── EC_off (ConditionEntry)
    │   └── visible_fields (list[str])  — paths relative to reminder_context
    └── EC_on (ConditionEntry)
        └── visible_fields (list[str])
"""

class ConditionEntry(BaseModel):
    visible_fields: list[str]


class ConditionFieldMap(BaseModel):
    """Wrapper that validates the full condition field map."""

    conditions: dict[str, ConditionEntry]

    @field_validator("conditions")
    @classmethod
    def _all_conditions_present(cls, v: dict[str, ConditionEntry]) -> dict[str, ConditionEntry]:
        missing = VALID_CONDITIONS - set(v.keys())
        if missing:
            raise ValueError(f"Missing condition definitions: {missing}")
        unexpected = set(v.keys()) - VALID_CONDITIONS
        if unexpected:
            raise ValueError(f"Unexpected condition keys: {unexpected}")
        return v


# ---------------------------------------------------------------------------
# Loader functions
# ---------------------------------------------------------------------------

def _load_yaml(path: Path) -> dict:
    """Load a YAML file and return its contents as a dict."""
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    with open(path) as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Expected a YAML mapping in {path}, got {type(data).__name__}")
    return data


def load_model_config(path: Path | None = None) -> ModelConfig:
    """Load and validate model_config.yaml."""
    path = path or CONFIG_DIR / "model_config.yaml"
    data = _load_yaml(path)
    config = ModelConfig(**data)
    logger.info("Model config loaded: backend=%s, model=%s", config.backend, config.model_name)
    return config


def load_generation_config(path: Path | None = None) -> GenerationConfig:
    """Load and validate generation_config.yaml."""
    path = path or CONFIG_DIR / "generation_config.yaml"
    data = _load_yaml(path)
    config = GenerationConfig(**data)
    logger.info(
        "Generation config loaded: n_variants=%d, max_retries=%d",
        config.n_variants,
        config.max_retries,
    )
    return config


def load_condition_field_map(path: Path | None = None) -> ConditionFieldMap:
    """Load and validate condition_field_map.yaml."""
    path = path or CONFIG_DIR / "condition_field_map.yaml"
    data = _load_yaml(path)
    config = ConditionFieldMap(conditions=data)
    logger.info("Condition field map loaded: %d conditions", len(config.conditions))
    return config


def load_all_configs(
    config_dir: Path | None = None,
) -> tuple[ModelConfig, GenerationConfig, ConditionFieldMap]:
    """Load and validate all configuration files. Raises on any error."""
    d = config_dir or CONFIG_DIR
    model = load_model_config(d / "model_config.yaml")
    generation = load_generation_config(d / "generation_config.yaml")
    field_map = load_condition_field_map(d / "condition_field_map.yaml")
    return model, generation, field_map


# ---------------------------------------------------------------------------
# CLI entry point — prints config summary
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    model_cfg, gen_cfg, field_map_cfg = load_all_configs()

    print("\n=== Model Config ===")
    print(f"  Backend:     {model_cfg.backend}")
    print(f"  Model:       {model_cfg.model_name}")
    print(f"  Temperature: {model_cfg.temperature}")
    print(f"  Max tokens:  {model_cfg.max_tokens}")
    print(f"  Base URL:    {model_cfg.base_url}")
    print(f"  API key env: {model_cfg.api_key_env}")

    print("\n=== Generation Config ===")
    print(f"  Variants:    {gen_cfg.n_variants}")
    print(f"  Max retries: {gen_cfg.max_retries}")
    print(f"  Word range:  {gen_cfg.min_words}–{gen_cfg.max_words}")
    print(f"  Similarity:  {gen_cfg.similarity_threshold}")
    print(f"  Context fmt: {gen_cfg.context_format}")

    print("\n=== Condition Field Map ===")
    for cond_name, entry in field_map_cfg.conditions.items():
        n_req = len(entry.required_fields)
        n_cond = len(entry.conditional_fields)
        print(f"  {cond_name}: {n_req} required, {n_cond} conditional")

    print("\nAll configs loaded successfully ✓")
