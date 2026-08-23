#!/usr/bin/env python3
"""Download, sanitize, deduplicate, and split the public CheckMail datasets."""

from __future__ import annotations

import csv
import email
import hashlib
import json
import random
import re
import tarfile
import urllib.request
from email import policy
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "datasets" / "sources.json"
GENERATED_DIR = ROOT / "datasets" / "generated"
RAW_DIR = GENERATED_DIR / "raw"
EMAIL_PATTERN = re.compile(r"([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})", re.IGNORECASE)
URL_PATTERN = re.compile(r"https?://[^\s<>'\"]+", re.IGNORECASE)
LONG_NUMBER_PATTERN = re.compile(r"\b\d{4,}\b")


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        return
    print(f"Downloading {url}")
    request = urllib.request.Request(url, headers={"User-Agent": "CheckMail research dataset importer"})
    with urllib.request.urlopen(request) as response, destination.open("wb") as output:
        output.write(response.read())


def truncate_utf16(value: str, max_code_units: int) -> str:
    encoded = value.encode("utf-16-le")
    return encoded[: max_code_units * 2].decode("utf-16-le", errors="ignore")


def sanitize(value: str, max_code_units: int = 1000) -> str:
    value = EMAIL_PATTERN.sub(lambda match: f"<USER>@{match.group(2).lower()}", value)
    value = LONG_NUMBER_PATTERN.sub("<NUMBER>", value)
    return truncate_utf16(" ".join(value.replace("\x00", " ").split()), max_code_units)


def request_from_text(text: str, subject: str = "") -> dict[str, Any]:
    links = list(dict.fromkeys(URL_PATTERN.findall(text)))[:50]
    normalized_body = URL_PATTERN.sub("[LINK]", text)
    normalized_body_utf16_length = len(normalized_body.encode("utf-16-le")) // 2
    return {
        "headers": {"subject": sanitize(subject)},
        "receivedChain": [],
        "securityVerdicts": {"spf": "none", "dkim": "none", "dmarc": "none"},
        "body": sanitize(normalized_body),
        "truncated": normalized_body_utf16_length > 1000,
        "links": [sanitize(link, 2048) for link in links],
    }


def phishing_records(path: Path, source: str) -> Iterable[dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as handle:
        reader = csv.DictReader(handle)
        for index, row in enumerate(reader):
            lowered = {str(key).lower(): value or "" for key, value in row.items()}
            text = next((lowered[key] for key in ("email text", "email_text", "body", "text", "content") if lowered.get(key)), "")
            subject = next((lowered[key] for key in ("subject", "email subject") if lowered.get(key)), "")
            if text.strip():
                yield make_record(source, str(index), "phishing", request_from_text(text, subject))


def message_body(message: email.message.EmailMessage) -> str:
    body = message.get_body(preferencelist=("plain",)) if message.is_multipart() else message
    if body is None:
        return ""
    try:
        return body.get_content()
    except (LookupError, UnicodeDecodeError):
        payload = body.get_payload(decode=True) or b""
        return payload.decode("utf-8", errors="replace")


def ham_records(path: Path, source: str) -> Iterable[dict[str, Any]]:
    with tarfile.open(path, "r:bz2") as archive:
        for member in archive.getmembers():
            if not member.isfile():
                continue
            extracted = archive.extractfile(member)
            if extracted is None:
                continue
            message = email.message_from_bytes(extracted.read(), policy=policy.default)
            text = message_body(message)
            if text.strip():
                yield make_record(source, member.name, "safe", request_from_text(text, str(message.get("subject", ""))))


def make_record(source: str, source_id: str, label: str, request: dict[str, Any]) -> dict[str, Any]:
    digest = hashlib.sha256(json.dumps(request, sort_keys=True).encode()).hexdigest()
    return {"id": digest, "label": label, "source": source, "sourceRecordId": source_id, "request": request}


def deduplicate(records: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    unique: dict[str, dict[str, Any]] = {}
    for record in records:
        text_key = hashlib.sha256(record["request"]["body"].lower().encode()).hexdigest()
        unique.setdefault(text_key, record)
    return list(unique.values())


def write_jsonl(path: Path, records: Iterable[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as output:
        for record in records:
            output.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    all_records: list[dict[str, Any]] = []
    for source in manifest["sources"]:
        suffix = ".csv" if source["url"].endswith(".csv") else ".tar.bz2"
        destination = RAW_DIR / f"{source['id']}{suffix}"
        download(source["url"], destination)
        parser = phishing_records if source["label"] == "phishing" else ham_records
        all_records.extend(parser(destination, source["id"]))

    records = deduplicate(all_records)
    rng = random.Random(20260823)
    by_label = {
        label: [record for record in records if record["label"] == label]
        for label in ("safe", "phishing")
    }
    for values in by_label.values():
        rng.shuffle(values)

    corpus: list[dict[str, Any]] = []
    evaluation: list[dict[str, Any]] = []
    for label, values in by_label.items():
        corpus.extend(values[:1000])
        evaluation.extend(values[1000:6000])
        print(f"{label}: {len(values)} unique, {min(1000, len(values))} corpus, {len(values[1000:6000])} evaluation")

    rng.shuffle(corpus)
    rng.shuffle(evaluation)
    corpus_records = [
        {
            "id": record["id"],
            "label": record["label"],
            "text": f"Subject: {record['request']['headers'].get('subject', '')}\nBody: {record['request']['body']}",
            "source": record["source"],
            "sourceRecordId": record["sourceRecordId"],
        }
        for record in corpus
    ]

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    write_jsonl(GENERATED_DIR / "rag-corpus.jsonl", corpus_records)
    write_jsonl(GENERATED_DIR / "evaluation.jsonl", evaluation)
    print(f"Wrote {len(corpus_records)} corpus and {len(evaluation)} evaluation records to {GENERATED_DIR}")


if __name__ == "__main__":
    main()
