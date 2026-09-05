#!/usr/bin/env python3
"""Split the existing RAG v1 corpus into deterministic enrichment batches."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = ROOT / "datasets" / "generated" / "rag-corpus.jsonl"
DEFAULT_OUTPUT_DIR = ROOT / "datasets" / "generated" / "rag-v2-enrichment-input"
SCHEMA_VERSION = "rag-v2-enrichment-batch-v1"


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare structured batches for manual RAG v2 enrichment."
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--batch-size", type=int, default=20)
    return parser.parse_args()


def parse_email_text(text: str, line_number: int) -> tuple[str, str]:
    prefix = "Subject: "
    separator = "\nBody: "
    if not text.startswith(prefix) or separator not in text:
        raise ValueError(
            f"Invalid v1 email text structure at line {line_number}: "
            "expected 'Subject: ...\\nBody: ...'."
        )
    subject, content = text[len(prefix) :].split(separator, 1)
    return subject, content


def load_records(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            source: Any = json.loads(line)
            if not isinstance(source, dict):
                raise ValueError(f"Invalid v1 record at line {line_number}.")
            required = ("id", "label", "text", "source", "sourceRecordId")
            if any(not isinstance(source.get(field), str) for field in required):
                raise ValueError(f"Invalid v1 record fields at line {line_number}.")
            if source["label"] not in ("safe", "phishing"):
                raise ValueError(f"Invalid v1 label at line {line_number}.")
            if source["id"] in seen_ids:
                raise ValueError(f"Duplicate v1 record ID at line {line_number}.")
            seen_ids.add(source["id"])
            subject, content = parse_email_text(source["text"], line_number)
            records.append(
                {
                    "id": source["id"],
                    "subject": subject,
                    "content": content,
                    "classification": (
                        "legitimate" if source["label"] == "safe" else "phishing"
                    ),
                }
            )
    if not records:
        raise ValueError(f"No v1 records found in {path}.")
    return records


def write_batches(records: list[dict[str, Any]], output_dir: Path, batch_size: int) -> None:
    if batch_size <= 0:
        raise ValueError("--batch-size must be a positive integer.")
    output_dir.mkdir(parents=True, exist_ok=True)
    for stale_path in output_dir.glob("batch-*.json"):
        stale_path.unlink()

    batch_count = (len(records) + batch_size - 1) // batch_size
    for batch_index in range(batch_count):
        start = batch_index * batch_size
        batch_records = records[start : start + batch_size]
        payload = {
            "schemaVersion": SCHEMA_VERSION,
            "batchNumber": batch_index + 1,
            "batchCount": batch_count,
            "emailCount": len(batch_records),
            "emails": batch_records,
        }
        path = output_dir / f"batch-{batch_index + 1:03d}.json"
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


def main() -> None:
    arguments = parse_arguments()
    records = load_records(arguments.input)
    write_batches(records, arguments.output_dir, arguments.batch_size)
    batch_count = (len(records) + arguments.batch_size - 1) // arguments.batch_size
    print(
        f"Wrote {len(records)} emails in {batch_count} batches "
        f"to {arguments.output_dir}"
    )


if __name__ == "__main__":
    main()
