# Architecture Patterns: Local AI Integration with Flask

**Domain:** Parking slot booking system with local AI integration  
**Researched:** 2026-04-06  
**Confidence:** MEDIUM (official llama-cpp-python docs, current Flask async patterns)

---

## Executive Summary

Integrating local AI (llama_cpp with GGUF models) into an existing Flask parking booking system requires careful architectural decisions to avoid blocking the main thread during inference. The recommended approach uses a **dedicated AI service layer** with lazy-loaded model initialization, OpenAI-compatible API design for AI responses, and a robust fallback mechanism when local AI is unavailable.

---

## Recommended Architecture

### Overall Structure

```
backend/
├── app.py                    # Existing Flask app (unchanged core)
├── services/
│   └── ai_service.py         # NEW: AI abstraction layer
├── models/
│   └── (GGUF files)          # NEW: Local model storage
├── config.py                 # NEW: AI configuration
└── requirements.txt          # UPDATED: Add llama-cpp-python
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `app.py` (Flask routes) | HTTP handling, business logic | Delegates to `ai_service` |
| `ai_service.py` | Model loading, inference, provider abstraction | llama_cpp library, fallback providers |
| `config.py` | Environment-based AI configuration | `.env` file |

---

## 1. Where to Place AI Logic: Service Layer Pattern

### Why a Service Layer?

The existing Flask app uses synchronous request handling. Llama_cpp inference can take **seconds to minutes** depending on model size and hardware. Blocking the Flask main thread would freeze the entire API.

**Recommended: Create `backend/services/ai_service.py`**

```python
# backend/services/ai_service.py

import os
from enum import Enum
from typing import Optional
import llama_cpp

class AIProvider(Enum):
    LOCAL = "local"
    GEMINI = "gemini"  # fallback external provider

class AIService:
    def __init__(self):
        self._llama_model: Optional[llama_cpp.Llama] = None
        self._provider = self._detect_provider()
    
    def _detect_provider(self) -> AIProvider:
        """Read from .env to decide which provider to use"""
        provider = os.environ.get("AI_PROVIDER", "local").lower()
        if provider == "gemini":
            return AIProvider.GEMINI
        return AIProvider.LOCAL
    
    def _load_model(self) -> llama_cpp.Llama:
        """Lazy-load the GGUF model only when first needed"""
        if self._llama_model is None:
            model_path = os.environ.get(
                "LLAMA_MODEL_PATH", 
                "models/gemma-4-E2B-it-UD-IQ2_M.gguf"
            )
            
            n_ctx = int(os.environ.get("LLAMA_N_CTX", "2048"))
            n_gpu_layers = int(os.environ.get("LLAMA_N_GPU_LAYERS", "0"))
            
            self._llama_model = llama_cpp.Llama(
                model_path=model_path,
                n_ctx=n_ctx,
                n_gpu_layers=n_gpu_layers,
                verbose=False
            )
        
        return self._llama_model
    
    def generate(self, prompt: str, **kwargs) -> str:
        """Unified generate method - handles both providers"""
        
        # Configurable parameters from environment
        temperature = float(os.environ.get("LLAMA_TEMPERATURE", "0.7"))
        max_tokens = int(os.environ.get("LLAMA_MAX_TOKENS", "512"))
        
        # Override with kwargs if provided
        temperature = kwargs.get("temperature", temperature)
        max_tokens = kwargs.get("max_tokens", max_tokens)
        
        if self._provider == AIProvider.LOCAL:
            return self._local_generate(prompt, temperature, max_tokens)
        else:
            return self._fallback_generate(prompt, temperature, max_tokens)
    
    def _local_generate(self, prompt: str, temperature: float, max_tokens: int) -> str:
        """Use local llama_cpp model"""
        try:
            model = self._load_model()
            
            output = model(
                prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                stop=["</s>", "USER:", "INST:"],  # Stop sequences
            )
            
            return output["choices"][0]["text"].strip()
            
        except Exception as e:
            # Model load failure → raise to trigger fallback
            raise RuntimeError(f"Local AI inference failed: {e}")
    
    def _fallback_generate(self, prompt: str, temperature: float, max_tokens: int) -> str:
        """Use external provider (Gemini) as fallback"""
        import google.generativeai as genai
        
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY not configured")
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-pro")
        
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            }
        )
        
        return response.text.strip()
    
    @property
    def provider(self) -> AIProvider:
        return self._provider
    
    def is_available(self) -> bool:
        """Check if current provider can generate responses"""
        try:
            # Simple health check - generate a minimal response
            test_prompt = "Hi"
            result = self.generate(test_prompt, max_tokens=5)
            return len(result) > 0
        except Exception:
            return False


# Singleton instance
ai_service = AIService()
```

### Key Design Decisions

1. **Lazy Loading**: Model loads on first request, not at app startup. This keeps startup fast and fails gracefully if model is missing.

2. **Provider Abstraction**: The `generate()` method hides whether using local or external AI. This makes fallback seamless and allows runtime switching.

3. **Configuration via Environment**: All AI parameters come from `.env`, enabling easy toggling between providers without code changes.

---

## 2. API Design for AI Responses

### Option A: OpenAI-Compatible Endpoints (Recommended)

This approach mirrors the existing Gemini API structure, making frontend changes minimal.

```python
# Add to app.py

from services.ai_service import ai_service

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    """OpenAI-compatible chat completion endpoint"""
    data = request.get_json()
    
    if not data or 'messages' not in data:
        return jsonify({'error': 'Missing messages field'}), 400
    
    messages = data['messages']
    
    # Convert messages to prompt format
    # (Simplified - for chat models, you'd use proper chat template)
    prompt = "\n".join([f"{m['role']}: {m['content']}" for m in messages])
    
    try:
        response_text = ai_service.generate(
            prompt,
            temperature=data.get('temperature', 0.7),
            max_tokens=data.get('max_tokens', 512)
        )
        
        return jsonify({
            'choices': [{
                'message': {
                    'role': 'assistant',
                    'content': response_text
                }
            }],
            'model': 'local-llama',
            'provider': ai_service.provider.value
        })
        
    except Exception as e:
        return jsonify({
            'error': 'AI generation failed',
            'details': str(e),
            'provider': ai_service.provider.value
        }), 503


@app.route('/api/ai/status', methods=['GET'])
def ai_status():
    """Health check endpoint for AI service"""
    return jsonify({
        'available': ai_service.is_available(),
        'provider': ai_service.provider.value
    })
```

### Option B: Direct Endpoint (Simpler but Less Standard)

```python
@app.route('/api/ai/generate', methods=['POST'])
def generate_ai_response():
    """Simple endpoint for AI-generated parking assistance"""
    data = request.get_json()
    user_message = data.get('message', '')
    
    # Build context-aware prompt for parking domain
    prompt = f"""You are a parking slot booking assistant.
User asks: {user_message}

Provide a helpful, concise response about parking availability, booking process, or policies."""

    try:
        response = ai_service.generate(prompt)
        return jsonify({'response': response})
    except Exception as e:
        return jsonify({'error': str(e)}), 503
```

### API Response Format

```json
// Success response
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "You can book parking slots up to 14 days in advance..."
      }
    }
  ],
  "model": "local-llama",
  "provider": "local"
}

// Error response
{
  "error": "AI generation failed",
  "details": "Local AI unavailable",
  "provider": "local",
  "fallback_available": true
}
```

---

## 3. Error Handling and Fallbacks

### Multi-Layer Fallback Strategy

```
Request → Local AI → [failure] → External AI (Gemini) → [failure] → Static Response
```

### Implementation

```python
# backend/services/ai_service.py - Enhanced with fallback

class AIService:
    def __init__(self):
        self._llama_model: Optional[llama_cpp.Llama] = None
        self._primary_provider = self._detect_primary_provider()
        self._fallback_chain = self._build_fallback_chain()
    
    def _detect_primary_provider(self) -> AIProvider:
        provider = os.environ.get("AI_PROVIDER", "local").lower()
        return AIProvider.LOCAL if provider == "local" else AIProvider.GEMINI
    
    def _build_fallback_chain(self) -> list:
        """Order matters: try local first, then external, then static"""
        return [
            (AIProvider.LOCAL, self._local_generate),
            (AIProvider.GEMINI, self._fallback_generate),
        ]
    
    def generate_with_fallback(self, prompt: str, **kwargs) -> tuple[str, str]:
        """
        Try each provider in chain until one succeeds.
        Returns (response_text, provider_name)
        """
        last_error = None
        
        for provider, generate_func in self._fallback_chain:
            try:
                result = generate_func(prompt, **kwargs)
                return result, provider.value
            except Exception as e:
                last_error = e
                continue
        
        # All providers failed - return static response
        return self._static_fallback(prompt), "static"
    
    def _static_fallback(self, prompt: str) -> str:
        """Hardcoded responses for core parking questions"""
        prompt_lower = prompt.lower()
        
        if "available" in prompt_lower or "book" in prompt_lower:
            return "I can help you check available parking slots. Please use the /api/spaces/available endpoint with a date parameter."
        elif "cancel" in prompt_lower:
            return "To cancel a booking, use the DELETE /api/bookings/<booking_id> endpoint with your user_id."
        else:
            return "I'm here to help with parking bookings. You can check availability, make bookings, or manage existing reservations."
    
    def is_available(self) -> bool:
        """Check if ANY provider can respond"""
        try:
            result, provider = self.generate_with_fallback("test", max_tokens=5)
            return provider != "static"
        except Exception:
            return False
```

### Graceful Degradation Patterns

| Scenario | Behavior | HTTP Status |
|----------|----------|-------------|
| Local AI loads successfully | Use local model | 200 |
| Local AI fails (no model file) | Fall back to Gemini | 200 (with warning header) |
| Gemini fails | Return static response | 200 (static content) |
| No providers configured | Static response | 200 |

### Flask Error Handlers

```python
# Add to app.py

@app.errorhandler(503)
def service_unavailable(e):
    return jsonify({
        'error': 'Service temporarily unavailable',
        'ai_provider': ai_service.provider.value,
        'suggestion': 'Try again later or contact support'
    }), 503

# Optional: Middleware to add AI status headers to all responses
@app.after_request
def add_ai_headers(response):
    response.headers['X-AI-Provider'] = ai_service.provider.value
    response.headers['X-AI-Available'] = str(ai_service.is_available()).lower()
    return response
```

---

## 4. Configuration (`.env`)

```bash
# AI Configuration
AI_PROVIDER=local  # or "gemini" for external fallback

# Local AI (llama_cpp)
LLAMA_MODEL_PATH=models/gemma-4-E2B-it-UD-IQ2_M.gguf
LLAMA_N_CTX=2048
LLAMA_N_GPU_LAYERS=0  # Set to -1 for all GPU layers, 0 for CPU only
LLAMA_TEMPERATURE=0.7
LLAMA_MAX_TOKENS=512

# External fallback (Gemini)
GEMINI_API_KEY=your-api-key-here
```

---

## 5. Scalability Considerations

| Scale | Approach |
|-------|----------|
| 1-10 concurrent requests | Single Flask process with in-memory model |
| 10-50 concurrent requests | Run llama_cpp server as separate process, Flask calls via HTTP |
| 50+ concurrent requests | Multiple Flask workers with model preloaded per worker |

### Production Recommendation: Separate llama_cpp Server

For higher throughput, run the llama_cpp server as a separate process:

```bash
# Start llama_cpp server on port 8000
python -m llama_cpp.server \
  --model models/gemma-4-E2B-it-UD-IQ2_M.gguf \
  --host 0.0.0.0 \
  --port 8000
```

Then Flask calls it:

```python
import requests

def _local_generate_remote(prompt: str, temperature: float, max_tokens: int) -> str:
    response = requests.post(
        "http://localhost:8000/v1/chat/completions",
        json={
            "model": "local",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
    )
    return response.json()["choices"][0]["message"]["content"]
```

---

## 6. Testing Considerations

```python
# tests/test_ai_service.py

import pytest
from services.ai_service import AIService, AIProvider

def test_provider_detection():
    os.environ["AI_PROVIDER"] = "local"
    service = AIService()
    assert service.provider == AIProvider.LOCAL

def test_generate_with_fallback():
    os.environ["AI_PROVIDER"] = "local"
    service = AIService()
    
    response, provider = service.generate_with_fallback("Hello")
    assert len(response) > 0
    assert provider in ["local", "gemini", "static"]

def test_static_fallback_when_all_fail():
    # Mock both providers to fail
    service = AIService()
    service._fallback_chain = []  # No providers
    
    response, provider = service.generate_with_fallback("test")
    assert provider == "static"
```

---

## Sources

- **llama-cpp-python Official Documentation** (OpenAI-compatible server): https://llama-cpp-python.readthedocs.io/en/latest/server
- **Flask Async Patterns**: https://prosperasoft.com/blog/full-stack/async-optimization-in-flask-api/
- **Flask 3.1 ASGI Support**: https://www.johal.in/flask-3-1-asgi-support-uvicorn-deployment-configs/

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Service layer pattern | HIGH | Standard Flask pattern, well-documented |
| llama_cpp integration | HIGH | Official docs fully specify API |
| Fallback mechanism | MEDIUM | Pattern is sound; specifics depend on exact model behavior |
| Scalability guidance | MEDIUM | Based on general llama_cpp server patterns |

---

## Next Steps

1. **Phase 1**: Create `backend/services/ai_service.py` with lazy loading
2. **Phase 2**: Add `/api/ai/chat` endpoint to `app.py`
3. **Phase 3**: Add `.env` configuration and fallback chain
4. **Phase 4**: Add health check endpoint and monitoring
5. **Phase 5**: Performance testing with concurrent requests
