"""
AI Service Module - Provides AI model management with provider abstraction.

This module provides:
- ModelManager singleton for lazy-loading GGUF models
- Provider abstraction between local (llama_cpp) and external APIs
- Graceful fallback when local AI fails
"""

import os
import logging
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============= Configuration Constants =============
# Read from environment variables with sensible defaults

AI_PROVIDER = os.environ.get('AI_PROVIDER', 'local')  # 'local', 'external', or 'gemini'
AI_MODEL_PATH = os.environ.get('AI_MODEL_PATH', 'models/ai-model.gguf')
AI_EXTERNAL_API_URL = os.environ.get('AI_EXTERNAL_API_URL', 'https://api.openai.com/v1/chat/completions')
AI_EXTERNAL_API_KEY = os.environ.get('AI_EXTERNAL_API_KEY', '')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
AI_TEMPERATURE = float(os.environ.get('AI_TEMPERATURE', '0.7'))
AI_MAX_TOKENS = int(os.environ.get('AI_MAX_TOKENS', '512'))
AI_N_CTX = int(os.environ.get('AI_N_CTX', '2048'))


class AIProvider(ABC):
    """Abstract base class for AI providers."""

    @property
    @abstractmethod
    def provider_type(self) -> str:
        """Return the type of provider ('local', 'external', or 'gemini')."""
        pass

    @property
    @abstractmethod
    def is_healthy(self) -> bool:
        """Return whether the provider is healthy and ready."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> Optional[str]:
        """Return the model name or identifier."""
        pass

    @abstractmethod
    def health_check(self) -> Dict[str, Any]:
        """Perform a health check and return status information."""
        pass

    @abstractmethod
    def generate(self, prompt: str, **kwargs) -> str:
        """
        Generate a response from the AI model.
        
        Args:
            prompt: The input prompt for the AI
            **kwargs: Additional parameters (temperature, max_tokens, etc.)
            
        Returns:
            The generated text response
        """
        pass


class ModelLoadingError(Exception):
    """Exception raised when model loading fails."""
    pass


class GeminiAIProvider(AIProvider):
    """
    Google Gemini AI provider using the google-generativeai library.
    
    Provides direct access to Gemini models via the official API.
    """

    def __init__(self):
        self._api_key = GEMINI_API_KEY
        self._is_healthy = True
        self._last_error: Optional[str] = None
        self._model = None
        logger.info(f"GeminiAIProvider initialized with API key: {'set' if self._api_key else 'NOT SET'}")

    @property
    def provider_type(self) -> str:
        return "gemini"

    @property
    def is_healthy(self) -> bool:
        return self._is_healthy

    @property
    def model_name(self) -> Optional[str]:
        return "gemini-2.0-flash"

    def _get_client(self):
        """Lazy initialization of the Gemini client."""
        if self._model is None:
            if not self._api_key:
                raise ModelLoadingError("GEMINI_API_KEY not configured")
            
            import google.generativeai as genai
            genai.configure(api_key=self._api_key)
            self._model = genai.GenerativeModel('gemini-2.0-flash')
        
        return self._model

    def generate(self, prompt: str, **kwargs) -> str:
        """Generate text using Google Gemini."""
        temperature = kwargs.get('temperature', AI_TEMPERATURE)
        max_tokens = kwargs.get('max_tokens', AI_MAX_TOKENS)

        try:
            client = self._get_client()
            
            generation_config = {
                'temperature': temperature,
                'max_output_tokens': max_tokens,
            }

            response = client.generate_content(
                prompt,
                generation_config=generation_config
            )

            if response and response.text:
                return response.text
            return ""

        except Exception as e:
            error_msg = f"Gemini API error: {str(e)}"
            logger.error(error_msg)
            self._is_healthy = False
            self._last_error = error_msg
            raise ModelLoadingError(error_msg)

    def health_check(self) -> Dict[str, Any]:
        """Perform health check on Gemini provider."""
        result = {
            "provider": "gemini",
            "is_healthy": self._is_healthy,
            "model_name": "gemini-2.0-flash",
            "api_configured": bool(self._api_key),
        }

        if self._last_error:
            result["error"] = self._last_error

        # Try to verify connectivity if configured
        if self._api_key and self._is_healthy:
            try:
                # Quick test - just verify we can configure
                import google.generativeai as genai
                genai.configure(api_key=self._api_key)
                result["api_reachable"] = True
            except Exception as e:
                result["api_reachable"] = False
                result["connection_error"] = str(e)

        return result


class LocalAIProvider(AIProvider):
    """
    Local AI provider using llama_cpp for GGUF model inference.
    
    Lazy loads the model on first generate() call, not at initialization.
    """

    def __init__(self):
        self._model = None
        self._model_path = AI_MODEL_PATH
        self._is_healthy = True
        self._load_error: Optional[str] = None
        logger.info(f"LocalAIProvider initialized with model path: {self._model_path}")

    @property
    def provider_type(self) -> str:
        return "local"

    @property
    def is_healthy(self) -> bool:
        return self._is_healthy

    @property
    def model_name(self) -> Optional[str]:
        """Return the model file name from the path."""
        if self._model_path:
            return os.path.basename(self._model_path)
        return None

    def _ensure_model_loaded(self):
        """Lazy load the model if not already loaded."""
        if self._model is not None:
            return  # Model already loaded

        logger.info(f"Lazy loading GGUF model from: {self._model_path}")

        try:
            # Try to import llama_cpp
            try:
                from llama_cpp import Llama
            except ImportError:
                raise ModelLoadingError(
                    "llama_cpp package not installed. "
                    "Install with: pip install llama-cpp-python"
                )

            # Check if model file exists
            if not os.path.exists(self._model_path):
                raise ModelLoadingError(
                    f"Model file not found: {self._model_path}. "
                    "Please download a GGUF model and set AI_MODEL_PATH."
                )

            # Load the GGUF model with lazy loading
            # Model is NOT loaded here - it's loaded on first use via ChatCompletion
            # For llama_cpp, we initialize but n_ctx limit helps with DoS (T-01-01)
            self._model = Llama(
                model_path=self._model_path,
                n_ctx=AI_N_CTX,  # Limit context size (mitigates T-01-01)
                n_threads=4,
                n_gpu_layers=0,  # Use CPU only
                verbose=False
            )

            logger.info("GGUF model loaded successfully")

        except ModelLoadingError:
            # Re-raise model loading errors
            raise
        except Exception as e:
            # Catch any other errors and set unhealthy status
            error_msg = str(e)
            logger.error(f"Failed to load model: {error_msg}")
            self._is_healthy = False
            self._load_error = error_msg
            raise ModelLoadingError(f"Model loading failed: {error_msg}")

    def generate(self, prompt: str, history: Optional[list] = None, **kwargs) -> str:
        """
        Generate text using the local GGUF model.
        
        Args:
            prompt: The input prompt for the AI
            history: Optional list of previous messages [{role: "user"|"assistant", content: "..."}]
            staff_id: Optional staff ID from session
            staff_email: Optional staff email from session
            **kwargs: Additional parameters (temperature, max_tokens, etc.)
            
        Returns:
            The generated text response
        """
        # Lazy load model on first generate call
        self._ensure_model_loaded()

        if not self._is_healthy:
            raise ModelLoadingError(f"Provider unhealthy: {self._load_error}")

        # Get generation parameters
        temperature = kwargs.get('temperature', AI_TEMPERATURE)
        max_tokens = kwargs.get('max_tokens', AI_MAX_TOKENS)
        
        # Get user context from session
        staff_id = kwargs.get('staff_id')
        staff_email = kwargs.get('staff_email')

        # Simplified system prompt for small/local models
        system_prompt = f"""You are a parking assistant. Keep responses short and friendly.

User is logged in as: staff_id={staff_id}, email={staff_email}

IMPORTANT - Date handling:
- Parse natural dates like "today", "tomorrow", "next Monday", etc.
- Always include the actual date in YYYY-MM-DD format in your response
- Example: If user asks about "tomorrow", respond with "Available slots for tomorrow (2026-04-08):"

Understand these intents and respond with SHORT messages:
- "book" or "reserve" -> respond: "What date and slot number?"
- "cancel" -> respond: "What is your booking ID?"
- "available" or "slots" -> Ask for date, then respond with "ACTION:LIST_SLOTS:date=[YYYY-MM-DD]"
- "my booking" or "my bookings" -> respond: "ACTION:MY_BOOKINGS:staff_id=[staff_id]"
- "hello" or "hi" -> respond: "Hi! How can I help you with parking today?"

If user provides all needed info for booking (slot + date), respond:
"CONFIRM_ACTION:BOOK:slot=[X]:date=[YYYY-MM-DD]:staff_id=[staff_id]"
Example: "CONFIRM_ACTION:BOOK:slot=A1:date=2026-04-08:staff_id=123"

If user provides booking ID for cancel, respond:
"CONFIRM_ACTION:CANCEL:booking_id=[ID]:staff_id=[staff_id]"
Example: "CONFIRM_ACTION:CANCEL:booking_id=456:staff_id=123"

Keep all responses under 2 sentences."""

        try:
            # Build messages array with history if provided
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add conversation history if available
            if history and len(history) > 0:
                for msg in history:
                    # Validate and add each history message
                    if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                        messages.append({
                            "role": msg["role"],
                            "content": msg["content"]
                        })
            
            # Add current user message
            messages.append({"role": "user", "content": prompt})

            # Use llama_cpp ChatCompletion for text generation
            # This actually triggers the model to load if not loaded
            response = self._model.create_chat_completion(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )

            # Extract the response text
            if response and response.get('choices'):
                return response['choices'][0]['message']['content']

            return ""

        except Exception as e:
            logger.error(f"Generation failed: {str(e)}")
            self._is_healthy = False
            self._load_error = str(e)
            raise ModelLoadingError(f"Generation failed: {str(e)}")

    def health_check(self) -> Dict[str, Any]:
        """Perform health check on local provider."""
        result = {
            "provider": "local",
            "is_healthy": self._is_healthy,
            "model_path": self._model_path,
            "model_name": self.model_name,
            "is_loaded": self._model is not None,
        }

        if self._load_error:
            result["error"] = self._load_error

        # Try to check if model can be loaded
        if not self._is_healthy:
            try:
                self._ensure_model_loaded()
                # If we get here, model can now be loaded
                self._is_healthy = True
                result["is_healthy"] = True
                result["is_loaded"] = self._model is not None
            except Exception as e:
                result["error"] = str(e)

        return result


class ExternalAIProvider(AIProvider):
    """
    External AI provider for API-based inference.
    
    Used as fallback when local provider fails.
    """

    def __init__(self):
        self._api_url = AI_EXTERNAL_API_URL
        self._api_key = AI_EXTERNAL_API_KEY
        self._is_healthy = True
        self._last_error: Optional[str] = None
        logger.info(f"ExternalAIProvider initialized with URL: {self._api_url}")

    @property
    def provider_type(self) -> str:
        return "external"

    @property
    def is_healthy(self) -> bool:
        return self._is_healthy

    @property
    def model_name(self) -> Optional[str]:
        return "external-api"

    def generate(self, prompt: str, history: Optional[list] = None, **kwargs) -> str:
        """Generate text using external API."""
        import requests

        temperature = kwargs.get('temperature', AI_TEMPERATURE)
        max_tokens = kwargs.get('max_tokens', AI_MAX_TOKENS)
        
        # Get user context from session
        staff_id = kwargs.get('staff_id')
        staff_email = kwargs.get('staff_email')

        # Simplified system prompt for small/local models
        system_prompt = f"""You are a parking assistant. Keep responses short and friendly.

User is logged in as: staff_id={staff_id}, email={staff_email}

IMPORTANT - Date handling:
- Parse natural dates like "today", "tomorrow", "next Monday", etc.
- Always include the actual date in YYYY-MM-DD format in your response
- Example: If user asks about "tomorrow", respond with "Available slots for tomorrow (2026-04-08):"

Understand these intents and respond with SHORT messages:
- "book" or "reserve" -> respond: "What date and slot number?"
- "cancel" -> respond: "What is your booking ID?"
- "available" or "slots" -> Ask for date, then respond with "ACTION:LIST_SLOTS:date=[YYYY-MM-DD]"
- "my booking" or "my bookings" -> respond: "ACTION:MY_BOOKINGS:staff_id=[staff_id]"
- "hello" or "hi" -> respond: "Hi! How can I help you with parking today?"

If user provides all needed info for booking (slot + date), respond:
"CONFIRM_ACTION:BOOK:slot=[X]:date=[YYYY-MM-DD]:staff_id=[staff_id]"
Example: "CONFIRM_ACTION:BOOK:slot=A1:date=2026-04-08:staff_id=123"

If user provides booking ID for cancel, respond:
"CONFIRM_ACTION:CANCEL:booking_id=[ID]:staff_id=[staff_id]"
Example: "CONFIRM_ACTION:CANCEL:booking_id=456:staff_id=123"

Keep all responses under 2 sentences."""

        headers = {
            "Content-Type": "application/json"
        }

        # Add API key if provided (mitigates T-01-02)
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"

        # Build messages array with history if provided
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history if available
        if history and len(history) > 0:
            for msg in history:
                # Validate and add each history message
                if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                    messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
        
        # Add current user message
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": "gpt-3.5-turbo",
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        try:
            # Add timeout to prevent DoS (T-01-01)
            response = requests.post(
                self._api_url,
                headers=headers,
                json=payload,
                timeout=30  # 30 second timeout
            )

            if response.status_code == 200:
                result = response.json()
                if result.get('choices'):
                    return result['choices'][0]['message']['content']
                return ""
            else:
                error_msg = f"API returned status {response.status_code}: {response.text}"
                logger.error(error_msg)
                self._is_healthy = False
                self._last_error = error_msg
                raise ModelLoadingError(error_msg)

        except requests.exceptions.Timeout:
            error_msg = "External API request timed out"
            logger.error(error_msg)
            self._is_healthy = False
            self._last_error = error_msg
            raise ModelLoadingError(error_msg)
        except requests.exceptions.RequestException as e:
            error_msg = f"External API request failed: {str(e)}"
            logger.error(error_msg)
            self._is_healthy = False
            self._last_error = error_msg
            raise ModelLoadingError(error_msg)

    def health_check(self) -> Dict[str, Any]:
        """Perform health check on external provider."""
        result = {
            "provider": "external",
            "is_healthy": self._is_healthy,
            "api_url": self._api_url,
            "configured": bool(self._api_key),
        }

        if self._last_error:
            result["error"] = self._last_error

        # Test API connectivity if configured
        if self._is_healthy and self._api_key:
            try:
                import requests
                # Simple connectivity check
                test_response = requests.get(
                    self._api_url.replace('/chat/completions', ''),
                    timeout=5
                )
                result["api_reachable"] = test_response.status_code < 400
            except Exception as e:
                result["api_reachable"] = False
                result["connection_error"] = str(e)

        return result


class ModelManager:
    """
    Singleton manager for AI model providers.
    
    Provides lazy loading and automatic fallback to external provider
    when local provider fails.
    """

    _instance: Optional['ModelManager'] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelManager, cls).__new__(cls)
            # Initialize instance variables on first creation
            cls._instance._local_provider = None
            cls._instance._external_provider = None
            cls._instance._gemini_provider = None
            cls._instance._current_provider = None
            cls._instance._provider_fallback_occurred = False
            logger.info("ModelManager singleton created")
        return cls._instance

    def _create_local_provider(self) -> LocalAIProvider:
        """Create and return local provider instance."""
        if self._local_provider is None:
            self._local_provider = LocalAIProvider()
        return self._local_provider

    def _create_external_provider(self) -> ExternalAIProvider:
        """Create and return external provider instance."""
        if self._external_provider is None:
            self._external_provider = ExternalAIProvider()
        return self._external_provider

    def _create_gemini_provider(self) -> GeminiAIProvider:
        """Create and return Gemini provider instance."""
        if self._gemini_provider is None:
            self._gemini_provider = GeminiAIProvider()
        return self._gemini_provider

    def get_provider(self) -> AIProvider:
        """
        Get the current active provider.
        
        Returns local provider by default. If local provider fails,
        automatically falls back to external or Gemini provider.
        """
        # Return cached provider if already determined
        if self._current_provider is not None:
            return self._current_provider

        # Try Gemini provider first if configured
        if AI_PROVIDER == 'gemini':
            try:
                gemini_provider = self._create_gemini_provider()
                health = gemini_provider.health_check()
                if health.get('is_healthy') and health.get('api_configured'):
                    self._current_provider = gemini_provider
                    logger.info("Using Google Gemini AI provider")
                    return gemini_provider
                else:
                    logger.warning("Gemini provider unhealthy or not configured")
            except Exception as e:
                logger.warning(f"Gemini provider initialization failed: {str(e)}")

        # Try local provider
        if AI_PROVIDER == 'local':
            try:
                local_provider = self._create_local_provider()
                # Test if local provider is healthy
                health = local_provider.health_check()
                if health.get('is_healthy'):
                    self._current_provider = local_provider
                    logger.info("Using local AI provider")
                    return local_provider
                else:
                    logger.warning("Local provider unhealthy, will try external fallback")
            except Exception as e:
                logger.warning(f"Local provider initialization failed: {str(e)}")

        # Fall back to external provider (OpenAI-compatible or Gemini)
        if AI_PROVIDER == 'external' or not self._current_provider:
            if not self._current_provider or self._provider_fallback_occurred:
                external_provider = self._create_external_provider()
                self._current_provider = external_provider
                self._provider_fallback_occurred = True
                logger.info("Using external AI provider (fallback)")
                return external_provider

        # Last resort - try external
        external_provider = self._create_external_provider()
        self._current_provider = external_provider
        self._provider_fallback_occurred = True
        return external_provider

    def generate(self, prompt: str, **kwargs) -> str:
        """
        Generate text using the current provider.
        
        Automatically handles provider fallback if local fails.
        """
        provider = self.get_provider()

        try:
            return provider.generate(prompt, **kwargs)
        except ModelLoadingError as e:
            # If local failed and we haven't tried external yet, try fallback
            if not self._provider_fallback_occurred and provider.provider_type == 'local':
                logger.warning(f"Local provider failed: {str(e)}, trying external fallback")
                self._provider_fallback_occurred = True

                # Switch to external provider
                external = self._create_external_provider()
                self._current_provider = external

                # Retry with external
                try:
                    return external.generate(prompt, **kwargs)
                except Exception as external_error:
                    logger.error(f"External provider also failed: {str(external_error)}")
                    raise ModelLoadingError(
                        f"Both local and external providers failed. "
                        f"Local: {str(e)}, External: {str(external_error)}"
                    )
            else:
                # Already tried fallback or already using external
                raise

    def health_check(self) -> Dict[str, Any]:
        """Get health status of the current provider."""
        provider = self.get_provider()

        result = {
            "provider": provider.provider_type,
            "is_healthy": provider.is_healthy,
            "fallback_occurred": self._provider_fallback_occurred,
            "config": {
                "AI_PROVIDER": AI_PROVIDER,
                "AI_MODEL_PATH": AI_MODEL_PATH,
                "AI_EXTERNAL_API_URL": AI_EXTERNAL_API_URL,
                "AI_TEMPERATURE": AI_TEMPERATURE,
                "AI_MAX_TOKENS": AI_MAX_TOKENS,
                "AI_N_CTX": AI_N_CTX,
            }
        }

        # Add provider-specific details
        try:
            if provider.provider_type == 'local':
                result["model_name"] = provider.model_name
                result["is_loaded"] = hasattr(provider, '_model') and provider._model is not None
            elif provider.provider_type == 'external':
                result["api_configured"] = bool(AI_EXTERNAL_API_KEY)
            elif provider.provider_type == 'gemini':
                result["model_name"] = provider.model_name
                result["api_configured"] = bool(GEMINI_API_KEY)
        except Exception:
            pass

        return result

    @property
    def provider_type(self) -> str:
        """Return the current provider type."""
        return self.get_provider().provider_type


# Export public API
__all__ = [
    'ModelManager',
    'AIProvider',
    'LocalAIProvider',
    'ExternalAIProvider',
    'ModelLoadingError',
    'parse_natural_date',
]


def parse_natural_date(date_str: str) -> Optional[str]:
    """Convert natural language dates to YYYY-MM-DD format.
    
    Supports: today, tomorrow, next week, next Monday, etc.
    
    Args:
        date_str: Natural language date string (e.g., "today", "tomorrow", "next Monday")
        
    Returns:
        Date string in YYYY-MM-DD format, or None if parsing fails
    """
    from datetime import datetime, timedelta
    
    date_str = date_str.lower().strip()
    today = datetime.now()
    
    # Handle simple keywords
    if date_str in ['today', 'todays']:
        return today.strftime('%Y-%m-%d')
    elif date_str in ['tomorrow', 'tmr', 'tmrw']:
        return (today + timedelta(days=1)).strftime('%Y-%m-%d')
    elif date_str in ['yesterday']:
        return (today - timedelta(days=1)).strftime('%Y-%m-%d')
    
    # Handle "next week" (7 days from now)
    if date_str in ['next week']:
        return (today + timedelta(days=7)).strftime('%Y-%m-%d')
    
    # Handle day names (next Monday, next Tuesday, etc.)
    day_names = {
        'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
        'friday': 4, 'saturday': 5, 'sunday': 6
    }
    
    if 'next ' in date_str:
        for day_name, day_num in day_names.items():
            if day_name in date_str:
                # Find next occurrence of this day
                days_ahead = day_num - today.weekday()
                if days_ahead <= 0:  # Target day already happened this week
                    days_ahead += 7
                return (today + timedelta(days=days_ahead)).strftime('%Y-%m-%d')
    
    # Handle "this Monday" (same logic but this week)
    if 'this ' in date_str:
        for day_name, day_num in day_names.items():
            if day_name in date_str:
                days_ahead = day_num - today.weekday()
                if days_ahead < 0:  # Target day already happened this week
                    days_ahead += 7
                return (today + timedelta(days=days_ahead)).strftime('%Y-%m-%d')
    
    # Try to parse as regular date formats
    date_formats = [
        '%Y-%m-%d',      # 2026-04-08
        '%d/%m/%Y',      # 08/04/2026
        '%m/%d/%Y',      # 04/08/2026
        '%d-%m-%Y',      # 08-04-2026
        '%Y/%m/%d',      # 2026/04/08
    ]
    
    for fmt in date_formats:
        try:
            parsed_date = datetime.strptime(date_str, fmt)
            return parsed_date.strftime('%Y-%m-%d')
        except ValueError:
            continue
    
    # Can't parse
    return None