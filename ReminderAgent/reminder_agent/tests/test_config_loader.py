"""Tests for config_loader — validates that all configs load cleanly and
that validation catches missing / invalid fields.

Updated for 2×2 factorial design (AF_low_EC_off, AF_high_EC_off, AF_low_EC_on, AF_high_EC_on).
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
    """Create a temporary config directory with valid config files."""
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
        n_variants: 3
        max_retries: 3
        min_words: 5
        max_words: 45
        similarity_threshold: 0.85
        context_format: "prose"
    """))

    (cfg / "condition_field_map.yaml").write_text(textwrap.dedent("""\
        AF_low_EC_off:
          required_fields:
            - "reminder_context.element1.action_verb"
            - "reminder_context.element1.target_entity.entity_name"
          conditional_fields: []
          excluded_fields:
            - "reminder_context.element1.target_entity.cues"
            - "reminder_context.element1.target_entity.domain_properties"
            - "reminder_context.element1.location"
            - "reminder_context.element2"
            - "reminder_context.element3"
          excluded_zones:
            - "agent_reasoning_context"
            - "placeholder"

        AF_high_EC_off:
          required_fields:
            - "reminder_context.element1.action_verb"
            - "reminder_context.element1.target_entity.entity_name"
            - "reminder_context.element1.target_entity.cues.visual"
            - "reminder_context.element1.target_entity.domain_properties"
            - "reminder_context.element1.location"
          conditional_fields: []
          excluded_fields:
            - "reminder_context.element2"
            - "reminder_context.element3"
          excluded_zones:
            - "agent_reasoning_context"
            - "placeholder"

        AF_low_EC_on:
          required_fields:
            - "reminder_context.element1.action_verb"
            - "reminder_context.element1.target_entity.entity_name"
            - "reminder_context.element2.origin"
            - "reminder_context.element2.creation_context"
          conditional_fields: []
          excluded_fields:
            - "reminder_context.element1.target_entity.cues"
            - "reminder_context.element1.target_entity.domain_properties"
            - "reminder_context.element1.location"
            - "reminder_context.element3"
          excluded_zones:
            - "agent_reasoning_context"
            - "placeholder"

        AF_high_EC_on:
          required_fields:
            - "reminder_context.element1.action_verb"
            - "reminder_context.element1.target_entity.entity_name"
            - "reminder_context.element1.target_entity.cues.visual"
            - "reminder_context.element1.target_entity.domain_properties"
            - "reminder_context.element1.location"
            - "reminder_context.element2.origin"
            - "reminder_context.element2.creation_context"
          conditional_fields: []
          excluded_fields:
            - "reminder_context.element3"
          excluded_zones:
            - "agent_reasoning_context"
            - "placeholder"
    """))

    return cfg


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------

class TestLoadFromProductionConfigs:
    """Load the actual config files shipped in reminder_agent/config/."""

    def test_all_configs_load(self) -> None:
        model, gen, field_map = load_all_configs()
        assert model.backend == "ollama"
        assert gen.n_variants == 3
        assert len(field_map.conditions) == 4

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

    def test_condition_field_map_all_conditions(self) -> None:
        cfg = load_condition_field_map()
        expected = {"AF_low_EC_off", "AF_high_EC_off", "AF_low_EC_on", "AF_high_EC_on"}
        assert set(cfg.conditions.keys()) == expected

    def test_af_high_has_visual_cues(self) -> None:
        cfg = load_condition_field_map()
        af_high = cfg.conditions["AF_high_EC_off"]
        assert "reminder_context.element1.target_entity.cues.visual" in af_high.required_fields

    def test_all_conditions_exclude_detected_activity(self) -> None:
        cfg = load_condition_field_map()
        for cond_name, entry in cfg.conditions.items():
            assert "reminder_context.element3.detected_activity_raw" not in entry.required_fields, (
                f"{cond_name} should not include detected_activity_raw"
            )

    def test_af_high_conditions_have_domain_properties(self) -> None:
        cfg = load_condition_field_map()
        for cond_name in ("AF_high_EC_off", "AF_high_EC_on"):
            entry = cfg.conditions[cond_name]
            assert "reminder_context.element1.target_entity.domain_properties" in entry.required_fields


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
        del data["AF_high_EC_on"]
        path.write_text(yaml.dump(data))
        with pytest.raises(ValueError, match="Missing condition"):
            load_condition_field_map(path)

    def test_extra_condition_in_field_map(self, tmp_config_dir: Path) -> None:
        path = tmp_config_dir / "condition_field_map.yaml"
        data = yaml.safe_load(path.read_text())
        data["BogusCondition"] = data["AF_low_EC_off"]
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
        assert len(field_map.conditions) == 4
