#!/usr/bin/env python3
"""Validate enrichment patches and join them to the immutable RAG v1 corpus."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = ROOT / "datasets" / "generated" / "rag-corpus.jsonl"
DEFAULT_ENRICHMENT_DIR = ROOT / "datasets" / "generated" / "rag-v2-enrichment-output"
DEFAULT_OUTPUT = ROOT / "datasets" / "generated" / "rag-v2-corpus.jsonl"
EXPECTED_SCHEMA_VERSION = "rag-v2-enrichment-result-v1"


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the enriched RAG v2 JSONL corpus.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--enrichment-dir", type=Path, default=DEFAULT_ENRICHMENT_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise ValueError(f"Invalid JSON object at {path}:{line_number}.")
            records.append(value)
    if not records:
        raise ValueError(f"No records found in {path}.")
    return records


def valid_signals(value: Any) -> bool:
    return (
        isinstance(value, list)
        and 1 <= len(value) <= 8
        and all(
            isinstance(signal, str) and 0 < len(signal.strip()) <= 80 for signal in value
        )
    )


def load_enrichments(directory: Path) -> dict[str, dict[str, Any]]:
    paths = sorted(directory.glob("batch-*.json"))
    if not paths:
        raise ValueError(f"No enrichment batches found in {directory}.")
    enrichments: dict[str, dict[str, Any]] = {}
    for expected_batch_number, path in enumerate(paths, 1):
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError(f"Invalid enrichment payload in {path}.")
        batch = payload.get("enrichments")
        if (
            payload.get("schemaVersion") != EXPECTED_SCHEMA_VERSION
            or payload.get("batchNumber") != expected_batch_number
            or not isinstance(batch, list)
            or payload.get("emailCount") != len(batch)
        ):
            raise ValueError(f"Invalid batch metadata in {path}.")
        for item in batch:
            if not isinstance(item, dict):
                raise ValueError(f"Invalid enrichment item in {path}.")
            record_id = item.get("id")
            explanation = item.get("explanation")
            if (
                not isinstance(record_id, str)
                or record_id in enrichments
                or not valid_signals(item.get("signals"))
                or not isinstance(explanation, str)
                or not 0 < len(explanation.strip()) <= 600
            ):
                raise ValueError(f"Invalid or duplicate enrichment in {path}.")
            enrichments[record_id] = {
                "signals": item["signals"],
                "explanation": explanation,
            }
    return enrichments


def build_corpus(
    source_records: list[dict[str, Any]], enrichments: dict[str, dict[str, Any]]
) -> list[dict[str, Any]]:
    source_ids = [record.get("id") for record in source_records]
    if any(not isinstance(record_id, str) for record_id in source_ids):
        raise ValueError("Every RAG v1 record must have a string ID.")
    if len(set(source_ids)) != len(source_ids):
        raise ValueError("RAG v1 contains duplicate IDs.")
    if source_ids != list(enrichments):
        raise ValueError("Enrichment records must preserve the exact RAG v1 record order.")
    missing = set(source_ids) - set(enrichments)
    unexpected = set(enrichments) - set(source_ids)
    if missing or unexpected:
        raise ValueError(
            f"Enrichment IDs do not match RAG v1: missing={len(missing)}, "
            f"unexpected={len(unexpected)}."
        )
    return [{**record, **enrichments[record["id"]]} for record in source_records]


def main() -> None:
    arguments = parse_arguments()
    records = build_corpus(
        load_jsonl(arguments.input), load_enrichments(arguments.enrichment_dir)
    )
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    with arguments.output.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Wrote {len(records)} enriched records to {arguments.output}")


if __name__ == "__main__":
    main()
