# Heuristic Email Analysis

The `process` Cloud Function first performs deterministic, local heuristic analysis of the normalized email payload accepted by `POST /process`. A heuristic `PHISHING` result is final and bypasses all paid model and RAG calls. Heuristic `OK` and `WARNING` results continue through Firestore vector retrieval and the configured LLM, as documented in `docs/llm-rag-analysis.md`.

## Result model

Each rule emits an internal finding with a stable code, score, and user-facing explanation. Scores are summed and clamped to the `0-100` range.

|    Score | Result     |
| -------: | ---------- |
|   `0-19` | `OK`       |
|  `20-49` | `WARNING`  |
| `50-100` | `PHISHING` |

The API response remains limited to `result` and `comment`. The comment contains at most three highest-scoring explanations and never includes raw addresses, message content, headers, or URLs.

## Authentication rules

| Finding                             |     Score |
| ----------------------------------- | --------: |
| DMARC failure                       |     `+30` |
| SPF failure                         |     `+20` |
| DKIM failure                        |     `+20` |
| SPF soft failure                    |     `+10` |
| Missing SPF, DKIM, or DMARC verdict | `+5` each |
| SPF, DKIM, and DMARC all pass       |     `-10` |

Missing authentication verdicts alone do not produce a phishing classification.

## Sender identity rules

The analyzer extracts normalized domains from `From`, `Reply-To`, and `Return-Path` addresses.

| Finding                              | Score |
| ------------------------------------ | ----: |
| Reply-To domain differs from From    | `+20` |
| Return-Path domain differs from From | `+15` |
| From address cannot be parsed        | `+10` |

An exact domain match and a direct parent/subdomain relationship are treated as matching. This initial implementation does not use the Public Suffix List, so unrelated sibling subdomains can still be treated as different domains.

## Link rules

Each link is parsed with the standard URL parser. Repeated instances of the same signal generate only one finding.

| Finding                                        | Score |
| ---------------------------------------------- | ----: |
| Direct IP address host                         | `+20` |
| Username or password embedded in URL           | `+20` |
| Punycode hostname                              | `+15` |
| Invalid or unsupported URL                     | `+10` |
| Unusually deep subdomain                       | `+10` |
| Non-standard port                              | `+10` |
| Link domain differs from sender domain         | `+10` |
| Three or more distinct web domains             | `+10` |
| `mailto:` domain differs from sender domain    | `+10` |
| Unencrypted HTTP                               |  `+5` |
| At least two technical URL-obfuscation signals | `+15` |

The analyzer intentionally does not maintain a suspicious-TLD or URL-shortener list. Such lists become stale quickly and create false positives without a reputation feed.

## Content rules

The subject and normalized body are checked against a deliberately small English and Polish vocabulary.

| Finding                                     | Score |
| ------------------------------------------- | ----: |
| Urgency combined with a call to action      | `+10` |
| Credential or account-verification language | `+10` |
| Threat of losing account access             | `+10` |
| Payment-related language                    |  `+5` |

A combination of a Reply-To mismatch, credential language, and an external link adds `+20`. This captures a stronger phishing pattern without making any individual phrase decisive.

An empty `receivedChain` adds `+5`. The `truncated` field does not change the score; links and available content are still analyzed when the body is empty or truncated.

## Logging and privacy

Successful analyses emit structured logs containing:

- classification result
- numeric score
- finding codes
- processing duration
- whether the heuristic bypassed the LLM
- model/provider, confidence, token usage, RAG corpus version, and hit count when applicable

The function does not log email bodies, headers, sender or recipient addresses, or link values.

## Limitations and next steps

- domain comparison is not yet based on the Public Suffix List
- `receivedChain` contents are not parsed beyond detecting an empty chain
- no live domain age, reputation, malware, or threat-intelligence feed is used
- heuristics have not yet been calibrated against a labeled production dataset
- successful privacy-safe scan results are persisted in PostgreSQL, but feedback and audit-event models are not yet implemented

Future tuning should use labeled messages and track false-positive and false-negative rates before changing thresholds or rule weights.
