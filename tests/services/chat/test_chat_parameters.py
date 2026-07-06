from __future__ import annotations

from app.chat.processing.parameters import sanitize_parameter_overrides
from app.schemas.chat_parameters import (
    ChatParameters,
    coerce_dict_parameter,
    coerce_list_parameter,
)


def test_sanitize_parameter_overrides_coerces_and_filters() -> None:
    supported = [
        "temperature",
        "top_k",
        "logprobs",
        "stop",
        "verbosity",
        "response_format",
        "reasoning",
    ]
    parameters = ChatParameters(
        temperature="0.7",
        top_k="4",
        logprobs="true",
        stop="end,\nstop",
        verbosity="HIGH",
        response_format={"type": "json_object"},
        reasoning={"effort": "high"},
        unknown="ignore-me",  # type: ignore[call-arg]
    )

    sanitized = sanitize_parameter_overrides(parameters, supported)

    assert sanitized["temperature"] == 0.7
    assert sanitized["top_k"] == 4
    assert sanitized["logprobs"] is True
    assert sanitized["stop"] == ["end", "stop"]
    assert sanitized["verbosity"] == "high"
    assert sanitized["response_format"] == {"type": "json_object"}
    assert sanitized["reasoning"] == {"effort": "high"}
    assert "unknown" not in sanitized


def test_sanitize_parameter_overrides_skips_invalid_values() -> None:
    supported = ["temperature", "verbosity", "stop", "response_format"]
    parameters = ChatParameters(
        temperature="nan",
        verbosity="louder",
        stop="",
        response_format="not-json",  # type: ignore[arg-type]
    )

    sanitized = sanitize_parameter_overrides(parameters, supported)

    assert sanitized == {}


def test_sanitize_parameter_overrides_returns_empty_for_missing_inputs() -> None:
    assert sanitize_parameter_overrides(None, ["temperature"]) == {}
    assert sanitize_parameter_overrides(ChatParameters(temperature=0.5), None) == {}


def test_sanitize_parameter_overrides_drops_fields_the_model_does_not_support() -> None:
    parameters = ChatParameters(temperature=0.5, top_k=3)

    sanitized = sanitize_parameter_overrides(parameters, ["top_k"])

    assert sanitized == {"top_k": 3}


def test_chat_parameters_drops_unknown_keys() -> None:
    parameters = ChatParameters.model_validate({"temperature": 0.5, "unknown": "value"})

    assert parameters.temperature == 0.5
    assert not hasattr(parameters, "unknown")


def test_coerce_dict_parameter_parses_json_string() -> None:
    assert coerce_dict_parameter('{"type":"json_object"}') == {"type": "json_object"}
    assert coerce_dict_parameter(" ") is None


def test_coerce_dict_parameter_rejects_none_and_non_dict_json() -> None:
    assert coerce_dict_parameter(None) is None
    assert coerce_dict_parameter('["list"]') is None
    assert coerce_dict_parameter(123) is None


def test_coerce_list_parameter_returns_none_for_empty_values() -> None:
    assert coerce_list_parameter(None) is None


def test_chat_parameters_verbosity_and_unsupported_values() -> None:
    assert ChatParameters(verbosity="HIGH").verbosity == "high"  # type: ignore[arg-type]
    assert ChatParameters(verbosity=123).verbosity is None  # type: ignore[arg-type]
    assert ChatParameters(verbosity="loud").verbosity is None  # type: ignore[arg-type]


def test_coerce_string_list_handles_mixed_iterables() -> None:
    from app.schemas.chat_parameters import coerce_string_list

    assert coerce_string_list((" a ", None, 2)) == ["a", "2"]
    assert coerce_string_list(["a", " ", None, "b"]) == ["a", "b"]
    assert coerce_string_list("a, ,b") == ["a", "b"]
    assert coerce_string_list([None, " "]) is None
    assert coerce_string_list(123) is None


def test_provider_option_coercers_accept_none() -> None:
    from app.schemas.chat_parameters import coerce_data_collection, coerce_provider_sort

    assert coerce_provider_sort(None) is None
    assert coerce_data_collection(None) is None
