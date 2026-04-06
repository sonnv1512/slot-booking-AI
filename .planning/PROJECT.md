# Slot Booking AI

## What This Is

A parking slot booking system with Flask backend and React frontend. Now adding local AI capabilities to replace external API calls (like Gemini) with self-hosted GGUF models running locally via llama_cpp.

## Core Value

Users can book parking slots via a web interface; system now supports local AI for intelligent responses instead of relying on external AI APIs.

## Requirements

### Validated

- ✓ User authentication (email/password) — existing
- ✓ Parking slot booking — existing  
- ✓ Admin management — existing
- ✓ REST API backend — existing
- ✓ React SPA frontend — existing

### Active

- [ ] Integrate llama_cpp Python library for local GGUF model loading
- [ ] Add .env configuration for AI provider selection (local vs external)
- [ ] Create models/ folder for storing GGUF model files
- [ ] Add API endpoint to switch between local/external AI
- [ ] Configure model parameters (temperature, max_tokens) via config
- [ ] Add fallback mechanism when local AI unavailable

### Out of Scope

- [Multiple GPU support] — Single GPU/CPU inference only for v1
- [Model fine-tuning] — Use pre-trained GGUF models only

## Context

**Existing Stack:**
- Backend: Flask + SQLite
- Frontend: React 19 + React Router 7
- Current: Uses Gemini API for AI responses

**New Requirement:**
- Replace Gemini API with local AI using llama_cpp
- Use GGUF format models (gemma-4-E2B-it-UD-IQ2_M.gguf)
- Make configurable via .env (toggle between local/external)

## Constraints

- **Tech Stack**: llama_cpp Python bindings, GGUF model format
- **Storage**: models/ directory for local model files
- **Config**: .env file for AI provider configuration

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| llama_cpp over Ollama | Direct Python integration, more control | — Pending |
| GGUF format | Efficient quantization, widely supported | — Pending |
| .env config for toggle | Easy switching between local/external | — Pending |

---

*Last updated: 2026-04-06 after feature request*