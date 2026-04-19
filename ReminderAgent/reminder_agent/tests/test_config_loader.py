"""Tests for config_loader — validates that all configs load cleanly and
that validation catches missing / invalid fields.

Updated for v3 EC operationalization (2 conditions: EC_off, EC_on).
"""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest
import yaml

from reminder_agent.stage2.config_loader import (
    load_all_configs,
    load_condition_field_map,
    load_generation_config,
    load_model_config,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@pytest.fixture()
def tmp_config_dir(tmp_path: Path) -> Path:
    """Create a temporary config directory with valid v3-format config files."""
    cfg = tmp_path / "config"
    cfg.mkdir()

    (cfg / "model_config.yaml").write_text(textwrap.dedent("""\
        backend: "together"
        model_name: "meta-llama/Meta-Llama-3-70B-Instruct"
        temperature: 0.8
        max_tokens: 150
        base_url: null
        api_key_env: "TOGETHER_API_KEY"
    """))

    (cfg / "generation_config.yaml").write_text(textwrap.dedent("""\
        ec_conditions:
          - EC_off
          - EC_on
        n_variants: 3
        max_retries: 3
        min_words: 5
        max_words: 45
        similarity_threshold: 0.85
        context_format: "prose"
        word_limits:
          EC_off:
            min: 5
            max: 12
          EC_on:
            min: 12
            max: 25
    """))

    (cfg / "condition_field_map.yaml").write_text(textwrap.dedent("""\
        EC_off:
          visible_fields:
            - "baseline.action_verb"
            - "baseline.target"
            - "baseline.recipient"

        EC_on:
          visible_fields:
            - "baseline.action_verb"
            - "baseline.target"
            - "baseline.recipient"
            - "ec_selected_features.entity"
            - "ec_selected_features.causality"
    """))

    return cfg


# ---------------------------------------------------------------------------
# Happy-path tests — production configs
# ---------------------------------------------------------------------------

class TestLoadFromProductionConfigs:
    """Load the actual config files shipped in reminder_agent/config/."""

    def test_all_configs_load(self) -> None:
        model, gen, field_map = load_all_configs()
        assert model.backend == "ollama"
        assert gen.n_variants == 3
        assert len(field_map.conditions) == 2

    def test_model_config(self) -> None:
        cfg = load_model_config()
        assert cfg.backend == "ollama"
        assert cfg.model_name == "llama3.1:latest"
        assert cfg.temperature == 0.8
        assert cfg.max_tokens == 150
        assert cfg.base_url == "http://localhost:11434"
        assert cfg.api_key_env is None

    def test_generation_config(self) -> None:
        cfg = load_generation_config()
        assert cfg.n_variants == 3
        assert cfg.max_retries == 3
        assert cfg.min_words == 5
        assert cfg.max_words == 45
        assert cfg.similarity_threshold == 0.85
        assert cfg.context_format == "prose"
        assert cfg.ec_conditions == ["EC_off", "EC_on"]
        assert "EC_off" in cfg.word_limits
        assert "EC_on" in cfg.word_limits

    def test_condition_field_map(self) -> None:
        cfg = load_condition_field_map()
        assert set(cfg.conditions.keys()) == {"EC_off", "EC_on"}

    def test_ec_off_has_baseline_fields(self) -> None:
        cfg = load_condition_field_map()
        fields = cfg.conditions["EC_off"].visible_fields
        assert "baseline.action_verb" in fields
        assert "baseline.target" in fields
        assert "baseline.recipient" in fields

    def test_ec_on_has_ec_features(self) -> None:
        cfg = load_condition_field_map()
        fields = cfg.conditions["EC_on"].visible_fields
        assert "ec_selected_features.entity" in fields
        assert "ec_selected_features.causality" in fields
        # EC_on should also include all baseline fields
        assert "baseline.action_verb" in fields
        assert "baseline.target" in fields
        assert "baseline.recipient" in fields

    def test_word_limits(self) -> None:
        cfg = load_generation_config()
        assert cfg.get_word_limits("EC_off") == (5, 12)
        assert cfg.get_word_limits("EC_on") == (12, 25)
        # Unknown condition falls back to global min/max
        assert cfg.get_word_limits("unknown") == (5, 45)


# ---------------------------------------------------------------------------
# Validation tests — bad input should raise
# ---------------------------------------------------------------------------

class TestValidationErrors:

    def test_missing_config_file(self, tmp_path: Path) -> None:
        with pytest.raises(FileNotFoundError):
            load_model_config(tmp_path / "nonexistent.yaml")

    def test_invalid_backend(self, tmp_config_dir: Path) -> None:
        path = tmp_config_dir / "model_config.yaml"
        data = yaml.safe_load(path.read_text())
        data["backend"] = "invalid_backend"
        path.write_text(yaml.dump(data))
        with pytest.raises(ValueError, match="backend must be one of"):
            load_model_config(path)

    def test_missing_model_name(self, tmp_config_dir: Path) -> None:
        path = tmp_config_dir / "model_config.yaml"
        data = yaml.safe_load(path.read_text())
        del data["model_name"]
        path.write_text(yaml.dump(data))
        with pytest.raises(Exception):  # pydantic ValidationError
            load_model_config(path)

    def test_negative_temperature(self, tmp_config_dir: Path) -> None:
        path = tmp_config_dir / "model_config.yaml"
        data = yaml.safe_load(path.read_text())
        data["temperature"] = -0.5
        path.write_text(yaml.dump(data))
        with pytest.raises(Exception):
            load_model_config(path)

    def test_max_words_less_than_min(self, tmp_config_dir: Path) -> None:
        path = tmp_config_dir / "generation_config.yaml"
        data = yaml.safe_load(path.read_text())
        data["min_words"] = 50
        data["max_words"] = 10
        path.write_text(yaml.dump(data))
        with pytest.raises(ValueError, match="max_words"):
            load_generation_config(path)

    def test_similarity_threshold_out_of_range(self, tmp_config_dir: Path) -> None:
        path = tmp_config_dir / "generation_config.yaml"
        data = yaml.safe_load(path.read_text())
        data["similarity_threshold"] = 1.5
        path.write_text(yaml.dump(data))
        with pytest.raises(Exception):
            load_generation_config(path)

    def test_missing_condition_in_field_map(self, tmp_config_dir: Path) -> None:
        path = tmp_config_dir / "condition_field_map.yaml"
        data = yaml.safe_load(path.read_text())
        del data["EC_on"]
        path.write_text(yaml.dump(data))
        with pytest.raises(ValueError, match="Missing condition"):
            load_condition_field_map(path)

    def test_extra_condition_in_field_map(self, tmp_config_dir: Path) -> None:
        path = tmp_config_dir / "condition_field_map.yaml"
        data = yaml.safe_load(path.read_text())
        data["BogusCondition"] = data["EC_off"]
        path.write_text(yaml.dump(data))
        with pytest.raises(ValueError, match="Unexpected condition"):
            load_condition_field_map(path)


# ---------------------------------------------------------------------------
# Temp-dir round-trip test
# ---------------------------------------------------------------------------

class TestTmpConfigRoundTrip:

    def test_load_all_from_tmp(self, tmp_config_dir: Path) -> None:
        model, gen, field_map = load_all_configs(tmp_config_dir)
        assert model.backend == "together"
        assert gen.n_variants == 3
        assert len(field_map.conditions) == 2
        assert gen.get_word_limits("EC_off") == (5, 12)
        assert gen.get_word_limits("EC_on") == (12, 25)
