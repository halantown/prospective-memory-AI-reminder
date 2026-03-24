"""Tests for config_loader — validates that all configs load cleanly and
that validation catches missing / invalid fields.

Updated for 3-group between-subjects design (Baseline, AF_only, AF_CB).
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
        max_words: 35
        similarity_threshold: 0.85
        context_format: "prose"
    """))

    (cfg / "condition_field_map.yaml").write_text(textwrap.dedent("""\
        Baseline:
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

        AF_only:
          required_fields:
            - "reminder_context.element1.action_verb"
            - "reminder_context.element1.target_entity.entity_name"
            - "reminder_context.element1.target_entity.cues.visual"
            - "reminder_context.element1.target_entity.domain_properties"
            - "reminder_context.element1.location"
          conditional_fields:
            - field: "reminder_context.element2.origin.task_creator"
              condition: "reminder_context.element2.origin.creator_is_authority == true"
          excluded_fields:
            - "reminder_context.element3"
          excluded_zones:
            - "agent_reasoning_context"
            - "placeholder"

        AF_CB:
          required_fields:
            - "reminder_context.element1.action_verb"
            - "reminder_context.element1.target_entity.entity_name"
            - "reminder_context.element1.target_entity.cues.visual"
            - "reminder_context.element1.target_entity.domain_properties"
            - "reminder_context.element1.location"
            - "reminder_context.element3.detected_activity_raw"
          conditional_fields:
            - field: "reminder_context.element2.origin.task_creator"
              condition: "reminder_context.element2.origin.creator_is_authority == true"
          excluded_fields: []
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
        assert len(field_map.conditions) == 3

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
        assert cfg.max_words == 35
        assert cfg.similarity_threshold == 0.85

    def test_condition_field_map_all_conditions(self) -> None:
        cfg = load_condition_field_map()
        expected = {"Baseline", "AF_only", "AF_CB"}
        assert set(cfg.conditions.keys()) == expected

    def test_af_only_has_visual_cues(self) -> None:
        cfg = load_condition_field_map()
        af_only = cfg.conditions["AF_only"]
        assert "reminder_context.element1.target_entity.cues.visual" in af_only.required_fields

    def test_af_only_excludes_detected_activity(self) -> None:
        cfg = load_condition_field_map()
        af_only = cfg.conditions["AF_only"]
        assert "reminder_context.element3.detected_activity_raw" not in af_only.required_fields

    def test_af_cb_has_detected_activity(self) -> None:
        cfg = load_condition_field_map()
        af_cb = cfg.conditions["AF_CB"]
        assert "reminder_context.element3.detected_activity_raw" in af_cb.required_fields

    def test_both_conditions_have_domain_properties(self) -> None:
        cfg = load_condition_field_map()
        for cond_name in ("AF_only", "AF_CB"):
            entry = cfg.conditions[cond_name]
            assert "reminder_context.element1.target_entity.domain_properties" in entry.required_fields

    def test_conditional_authority_field(self) -> None:
        cfg = load_condition_field_map()
        for cond_name in ("AF_only", "AF_CB"):
            entry = cfg.conditions[cond_name]
            cond_fields = [cf.field for cf in entry.conditional_fields]
            assert "reminder_context.element2.origin.task_creator" in cond_fields


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
        del data["AF_CB"]
        path.write_text(yaml.dump(data))
        with pytest.raises(ValueError, match="Missing condition"):
            load_condition_field_map(path)

    def test_extra_condition_in_field_map(self, tmp_config_dir: Path) -> None:
        path = tmp_config_dir / "condition_field_map.yaml"
        data = yaml.safe_load(path.read_text())
        data["BogusCondition"] = data["AF_only"]
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
        assert len(field_map.conditions) == 3
