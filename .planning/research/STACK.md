# Technology Stack

**Project:** Slot Booking AI - Local AI Integration
**Researched:** 2026-04-06
**Confidence:** HIGH

## Recommended Stack

### Core AI Library

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| llama-cpp-python | latest (0.2.x) | Python bindings for llama.cpp | Industry standard (10K+ stars), provides both high-level and low-level APIs, supports GGUF natively, active maintenance |
| GGUF format | N/A | Model file format | Efficient quantization support, widely adopted by Hugging Face models, direct compatibility with llama_cpp |

### Python Environment

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Python | 3.10+ | Runtime | Required for llama-cpp-python, Python 3.10+ needed for optimal async support |
| pip | latest | Package manager | Standard Python package management |
| virtualenv/venv | built-in | Environment isolation | Prevent dependency conflicts with existing Flask setup |

### Optional GPU Acceleration

| Technology | Purpose | When to Use |
|------------|---------|-------------|
| CUDA (cuBLAS) | GPU acceleration for NVIDIA cards | Production with NVIDIA GPU, significantly faster inference |
| Metal | GPU acceleration for Apple Silicon | Mac users with M1/M2/M3 chips |
| OpenBLAS | CPU fallback | Systems without GPU, slower but universally compatible |

### Flask Integration

| Technology | Purpose | Why |
|------------|---------|-----|
| Flask | Web framework | Existing project uses Flask, no need to switch |
| gunicorn | WSGI server | Production-grade server with worker support for concurrent requests |
| python-dotenv | .env file loading | Standard way to manage environment variables in Flask |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| AI Library | llama-cpp-python | Ollama | Ollama provides excellent UX but adds Docker/container overhead and less direct Python integration; llama-cpp-python gives finer control for Flask integration |
| Model Format | GGUF | safetensors | GGUF is optimized for quantization and works directly with llama_cpp; safetensors requires conversion |
| Server | Gunicorn (sync workers) | FastAPI + async | FastAPI's async model doesn't benefit LLM inference (CPU-bound blocking call); Gunicorn with sync workers is simpler for this use case |
| .env handling | python-dotenv | environmental | python-dotenv is the Flask standard, lighter weight |

## Installation

### Core Installation (CPU-only)

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install llama-cpp-python (CPU version with OpenBLAS)
CMAKE_ARGS="-DGGML_BLAS=ON -DGGML_BLAS_VENDOR=OpenBLAS" pip install llama-cpp-python

# Install Flask dependencies
pip install flask gunicorn python-dotenv
```

### GPU Installation (NVIDIA CUDA)

```bash
# With CUDA support
CMAKE_ARGS="-DGGML_CUDA=on" pip install llama-cpp-python
```

Or use pre-built wheels (faster installation):

```bash
pip install llama-cpp-python \
  --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu121
```

### GPU Installation (Apple Silicon)

```bash
# With Metal support
CMAKE_ARGS="-DGGML_METAL=on" pip install llama-cpp-python

# Or use pre-built wheels
pip install llama-cpp-python \
  --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/metal
```

## Environment Configuration

### Required .env Variables

```bash
# AI Provider Configuration
AI_PROVIDER=local  # or "external" for Gemini API fallback

# Local Model Settings
MODEL_PATH=models/gemma-4-E2B-it-UD-IQ2_M.gguf
MODEL_N_CTX=2048          # Context window size
MODEL_N_GPU_LAYERS=-1     # Layers to offload to GPU (-1 = all)
MODEL_TEMPERATURE=0.7     # Sampling temperature
MODEL_MAX_TOKENS=512      # Max tokens to generate

# Fallback (when local AI unavailable)
GEMINI_API_KEY=your-api-key-here
```

### Model Parameters Reference

| Parameter | Default | Description |
|-----------|---------|-------------|
| n_ctx | 512 | Context window size (tokens). Increase for longer conversations but uses more memory |
| n_gpu_layers | 0 | Number of layers to offload to GPU. -1 means all, 0 means CPU only |
| temperature | 0.7 | Controls randomness. Higher = more creative, lower = more deterministic |
| max_tokens | 512 | Maximum tokens to generate per request |
| top_p | 0.95 | Nucleus sampling threshold |
| top_k | 40 | Top-k sampling parameter |
| repeat_penalty | 1.1 | Penalizes repetition in generated text |

## Flask Integration Pattern

### Singleton Model Manager (Recommended)

```python
# app/ai/model_manager.py
from llama_cpp import Llama
import os
from dotenv import load_dotenv

load_dotenv()

class ModelManager:
    _instance = None
    _llm = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load_model(self):
        if self._llm is None:
            model_path = os.getenv('MODEL_PATH')
            self._llm = Llama(
                model_path=model_path,
                n_ctx=int(os.getenv('MODEL_N_CTX', 2048)),
                n_gpu_layers=int(os.getenv('MODEL_N_GPU_LAYERS', -1)),
                chat_format="gemma"  # Adjust based on your model
            )
        return self._llm

    def generate(self, prompt, **kwargs):
        llm = self.load_model()
        # Apply default parameters from environment
        params = {
            'temperature': float(os.getenv('MODEL_TEMPERATURE', 0.7)),
            'max_tokens': int(os.getenv('MODEL_MAX_TOKENS', 512)),
        }
        params.update(kwargs)
        return llm(prompt, **params)
```

### Flask Route Example

```python
# app/routes/ai.py
from flask import Blueprint, request, jsonify
from app.ai.model_manager import ModelManager

ai_bp = Blueprint('ai', __name__, url_prefix='/api/ai')

@ai_bp.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_message = data.get('message', '')
    
    provider = os.getenv('AI_PROVIDER', 'local')
    
    if provider == 'local':
        try:
            model = ModelManager.get_instance().load_model()
            response = model(
                f"User: {user_message}\nAssistant: ",
                max_tokens=512,
                temperature=0.7
            )
            return jsonify({
                'response': response['choices'][0]['text'],
                'provider': 'local'
            })
        except Exception as e:
            # Fallback to external API
            return fallback_to_external(user_message)
    else:
        return fallback_to_external(user_message)
```

## Directory Structure

```
slot-booking-AI/
├── models/                          # GGUF model files
│   └── gemma-4-E2B-it-UD-IQ2_M.gguf
├── app/
│   ├── __init__.py
│   ├── ai/
│   │   ├── __init__.py
│   │   ├── model_manager.py        # Singleton model manager
│   │   └── routes.py               # AI endpoints
│   └── ...
├── .env                             # Configuration (add to .gitignore)
└── requirements.txt
```

## Sources

- **llama-cpp-python Documentation**: https://llama-cpp-python.readthedocs.io/en/latest/ (HIGH confidence - official documentation)
- **PyPI Package**: https://pypi.org/project/llama-cpp-python/ (HIGH confidence - official package index)
- **Flask Integration Patterns**: https://plainenglish.io/python/unleashing-llamas-power-crafting-a-flask-api-to-seamlessly-load-and-engage-with-language-models (MEDIUM confidence - community tutorial)
- **llama.cpp GitHub**: https://github.com/abetlen/llama-cpp-python (HIGH confidence - official repository, 10K+ stars)