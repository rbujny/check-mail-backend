#!/usr/bin/env bash

set -Eeuo pipefail

user_home_dir="${HOME:?HOME must be set}"
llama_cpp_dir="${LLAMA_CPP_DIR:-${user_home_dir}/tools/llama.cpp}"
server_bin="${LLAMA_SERVER_BIN:-${llama_cpp_dir}/build-cuda/bin/llama-server}"
model_cache_dir="${GEMMA_MODEL_CACHE_DIR:-${user_home_dir}/.cache/huggingface/hub/models--ggml-org--gemma-4-E4B-it-GGUF/snapshots}"
model_path="${GEMMA_MODEL_PATH:-}"
model_alias="${GEMMA_MODEL_ALIAS:-gemma-4-e4b-it}"
listen_host="${LLAMA_HOST:-127.0.0.1}"
listen_port="${LLAMA_PORT:-8080}"
context_size="${LLAMA_CTX_SIZE:-8192}"
gpu_layers="${LLAMA_GPU_LAYERS:-99}"
parallel_slots="${LLAMA_PARALLEL:-1}"
flash_attention="${LLAMA_FLASH_ATTN:-on}"

if [[ ! -x "${server_bin}" ]]; then
  echo "llama-server is not executable: ${server_bin}" >&2
  echo "Set LLAMA_SERVER_BIN or build llama.cpp with CUDA support." >&2
  exit 1
fi

if [[ -z "${model_path}" ]]; then
  shopt -s nullglob
  model_candidates=("${model_cache_dir}"/*/gemma-4-E4B-it-Q8_0.gguf)
  shopt -u nullglob

  for candidate in "${model_candidates[@]}"; do
    if [[ -z "${model_path}" || "${candidate}" -nt "${model_path}" ]]; then
      model_path="${candidate}"
    fi
  done
fi

if [[ -z "${model_path}" || ! -f "${model_path}" ]]; then
  echo "Gemma GGUF model was not found." >&2
  echo "Set GEMMA_MODEL_PATH to gemma-4-E4B-it-Q8_0.gguf." >&2
  exit 1
fi

if [[ ! "${listen_port}" =~ ^[1-9][0-9]*$ ]] || ((listen_port > 65535)); then
  echo "LLAMA_PORT must be an integer between 1 and 65535." >&2
  exit 1
fi

if [[ ! "${context_size}" =~ ^[1-9][0-9]*$ || ! "${parallel_slots}" =~ ^[1-9][0-9]*$ ]]; then
  echo "LLAMA_CTX_SIZE and LLAMA_PARALLEL must be positive integers." >&2
  exit 1
fi

if [[ ! "${gpu_layers}" =~ ^(0|[1-9][0-9]*)$ ]]; then
  echo "LLAMA_GPU_LAYERS must be a non-negative integer." >&2
  exit 1
fi

if [[ "${flash_attention}" != "on" && "${flash_attention}" != "off" && "${flash_attention}" != "auto" ]]; then
  echo "LLAMA_FLASH_ATTN must be on, off, or auto." >&2
  exit 1
fi

if command -v nvidia-smi >/dev/null 2>&1 && ! nvidia-smi >/dev/null 2>&1; then
  echo "Warning: nvidia-smi cannot access the GPU. llama-server may fail to initialize CUDA." >&2
fi

echo "Starting ${model_alias} from ${model_path}"
echo "OpenAI-compatible endpoint: http://${listen_host}:${listen_port}"
echo "Repository variables: GEMMA_ENDPOINT=http://${listen_host}:${listen_port}, GEMMA_MODEL_ID=${model_alias}"

exec "${server_bin}" \
  --model "${model_path}" \
  --alias "${model_alias}" \
  --host "${listen_host}" \
  --port "${listen_port}" \
  --n-gpu-layers "${gpu_layers}" \
  --ctx-size "${context_size}" \
  --parallel "${parallel_slots}" \
  --flash-attn "${flash_attention}" \
  --jinja \
  --reasoning auto \
  "$@"
