# Feature Landscape: Local AI in Parking Booking Systems

**Domain:** Parking slot booking with local AI integration
**Researched:** 2026-04-06
**Confidence:** MEDIUM (WebSearch + Official Documentation)

---

## Executive Summary

This research identifies the feature landscape for integrating local AI (via llama_cpp with GGUF models) into a parking booking system. Local AI can provide conversational customer support, booking assistance, and FAQ responses without relying on external APIs like Gemini. Key configuration options include temperature, max_tokens, top_p, and top_k for controlling response behavior. Fallback mechanisms are essential to handle model loading failures, memory constraints, and version incompatibilities.

---

## Table Stakes

Features that users expect. Missing these makes the product feel incomplete.

| Feature | Why Expected | Complexity | Implementation Notes |
|---------|--------------|------------|----------------------|
| **Conversational Query Response** | Users ask questions about availability, rates, location | Medium | Core use case - local LLM handles natural language queries about parking |
| **Availability Information** | Users want to know slot availability in natural language | Low | Query database and respond conversationally |
| **Rate/Rricing Inquiry** | Users ask about pricing plans, discounts, subscriptions | Low | Static information that LLM can retrieve and present |
| **Basic Booking Assistance** | Help users complete bookings via chat | Medium | Guide users through booking flow conversationally |
| **FAQ Responses** | Common questions about hours, location, policies | Low | Pre-loaded knowledge base the LLM can access |

---

## Differentiators

Features that set the product apart from basic booking systems. Not expected, but highly valued.

| Feature | Value Proposition | Complexity | Implementation Notes |
|---------|------------------|------------|----------------------|
| **Multilingual Support** | Serve users in their preferred language | Medium | Gemma model supports multiple languages; configure system prompt |
| **Personalized Recommendations** | Suggest slots based on user history/preferences | Medium | Requires user preference storage and context passing |
| **Proactive Assistance** | AI initiates conversation based on time/location | High | Complex - requires event triggers and user context |
| **Voice Input Support** | Users speak instead of type | High | Requires speech-to-text integration |
| **Smart Routing** | Direct users to best slots based on duration/destination | High | Requires integration with mapping/geolocation |

---

## Configuration Options

The llama_cpp library provides extensive parameters for controlling model behavior.

### Core Generation Parameters

| Parameter | Range | Default | Purpose |
|-----------|-------|---------|---------|
| **temperature** | 0.0 - 2.0 | 0.7 | Controls randomness. Lower = more deterministic, Higher = more creative |
| **max_tokens** | 1 - 8192 | Model dependent | Maximum tokens to generate in response |
| **top_p** | 0.0 - 1.0 | 0.95 | Nucleus sampling - considers top % of probability mass |
| **top_k** | 1 - 100 | 40 | Limits sampling to top K tokens |
| **repeat_penalty** | 0.0 - 2.0 | 1.1 | Penalizes repeated tokens |
| **presence_penalty** | -2.0 - 2.0 | 0.0 | Penalizes tokens already in prompt |
| **frequency_penalty** | -2.0 - 2.0 | 0.0 | Penalizes token frequency |
| **stop** | Array of strings | [] | Sequences that stop generation |

### Context and Model Parameters

| Parameter | Purpose | Recommendation for Parking Booking |
|-----------|---------|-----------------------------------|
| **n_ctx** | Context window size | 2048-4096 (sufficient for chat history) |
| **n_gpu_layers** | Layers offloaded to GPU | Set based on available VRAM |
| **verbose** | Enable verbose logging | False in production |

### Recommended Configuration for Parking Bot

```python
llm = Llama(
    model_path="models/gemma-4-E2B-it-UD-IQ2_M.gguf",
    temperature=0.3,        # Lower for factual responses about parking info
    max_tokens=512,         # Sufficient for most responses
    top_p=0.9,             # Moderate nucleus sampling
    top_k=30,              # Focus on relevant tokens
    repeat_penalty=1.15,   # Reduce repetitive responses
    n_ctx=2048,            # Adequate for conversation history
    verbose=False,
)
```

**Rationale:**
- **temperature=0.3**: Parking information should be accurate and consistent, not creative
- **max_tokens=512**: Long enough for detailed responses, short enough for fast responses
- **top_p=0.9**: Balance between quality and diversity

---

## Anti-Features

Features to explicitly NOT build in the initial version.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Real-time Slot Detection via Vision** | Requires camera integration, complex ML pipeline | Use existing database availability |
| **Dynamic Pricing Negotiation** | Too complex for v1, legal/ethical concerns | Show static pricing tiers |
| **Autonomous Booking Execution** | Security risks, user trust concerns | Guide users to complete booking themselves |
| **Fine-tuned Model Training** | Out of scope per PROJECT.md | Use pre-trained GGUF models |
| **Multi-GPU Inference** | Single GPU/CPU only for v1 | Scale vertically later if needed |

---

## Feature Dependencies

```
Conversational Query Response
    ├── Base LLM (llama_cpp + GGUF model)
    ├── System prompt (parking-specific instructions)
    └── Fallback mechanism (if model unavailable)
        
Availability Information
    ├── Database query capability
    └── Conversational Query Response

Rate/Pricing Inquiry
    ├── Static pricing data
    └── Conversational Query Response

Booking Assistance
    ├── Availability Information
    └── API access to booking endpoints

FAQ Responses
    ├── Knowledge base (static documents)
    └── Conversational Query Response
```

---

## Use Cases in Detail

### 1. Natural Language Query Response

Users type or speak questions in natural language. The AI processes the query and returns helpful responses.

**Example interactions:**
- "What parking slots are available near the downtown area?"
- "How much is hourly parking at the airport?"
- "Do you offer monthly subscriptions?"
- "What's your operating hours?"

**Implementation:** Pass user message to local LLM with system prompt containing parking domain knowledge. LLM generates conversational response.

### 2. Availability Checking

AI retrieves real-time availability from database and presents it conversationally.

**Implementation:** 
- Query database for available slots
- Format results as natural language
- Optionally pass raw data to LLM for conversational presentation

### 3. Booking Flow Assistance

Guide users through booking process step-by-step.

**Implementation:**
- Ask for required information (date, time, slot type)
- Validate input
- Provide confirmation summary
- Offer to initiate booking API call

### 4. FAQ Automation

Handle common questions without human intervention.

**Topics:**
- Location and directions
- Operating hours
- Payment methods accepted
- Lost ticket policy
- EV charging availability
- Accessibility options
- Cancellation policy

### 5. Multilingual Support

Serve users in their preferred language without external translation APIs.

**Implementation:** Set appropriate system prompt or use model fine-tuned for target languages. Gemma models have multilingual capabilities.

---

## Fallback Strategies

Critical for production systems where local AI may fail.

### Strategy 1: External API Fallback

When local AI unavailable, switch to external API (e.g., Gemini).

```python
def generate_response(prompt: str) -> str:
    try:
        # Try local AI first
        return local_llm.generate(prompt)
    except (ModelLoadError, RuntimeError) as e:
        # Fallback to external API
        logger.warning(f"Local AI failed: {e}, falling back to external API")
        return external_api.generate(prompt)
```

### Strategy 2: Canned Responses

For critical queries, maintain fallback responses when AI fails.

```python
FALLBACK_RESPONSES = {
    "availability": "I'd be happy to check our availability. Please visit our booking page or call support.",
    "rates": "Our rates start at $5/hour. Visit our pricing page for details.",
    "default": "I'm experiencing technical difficulties. Please try again or contact support.",
}
```

### Strategy 3: Health Check and Graceful Degradation

Check model availability at startup and periodically.

```python
def check_ai_health() -> dict:
    try:
        # Quick generation test
        test_response = llm("test", max_tokens=5)
        return {"status": "healthy", "provider": "local"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e), "provider": "fallback"}
```

### Strategy 4: Version Compatibility Fallback

Handle GGUF model version mismatches.

```python
def load_model_with_fallback():
    try:
        return Llama(model_path=model_path, n_ctx=2048)
    except ValueError as e:
        if "unknown model architecture" in str(e):
            # Try loading with different parameters
            return Llama(model_path=model_path, n_ctx=1024, kv_overrides=...)
        raise
```

### Strategy 5: Memory-aware Loading

Handle systems with insufficient memory.

```python
def load_model():
    # Try with GPU first
    try:
        return Llama(model_path=model_path, n_gpu_layers=99)
    except MemoryError:
        # Fall back to CPU only
        logger.warning("GPU memory insufficient, falling back to CPU")
        return Llama(model_path=model_path, n_gpu_layers=0)
```

---

## MVP Recommendation

Prioritize for initial implementation:

1. **Conversational Query Response** - Core value proposition
2. **FAQ Responses** - High impact, low complexity
3. **Availability Information** - Essential for booking context

Defer:
- **Multilingual Support**: Requires testing and potential model swap
- **Personalized Recommendations**: Requires user preference storage
- **Voice Input**: Requires additional infrastructure

---

## Sources

- [llama-cpp-python API Reference](https://llama-cpp-python.readthedocs.io/en/latest/api-reference/) - HIGH confidence
- [llama-cpp-python GitHub](https://github.com/abetlen/llama-cpp-python) - HIGH confidence
- [MyPark AI Parking Assistant](https://www.usemypark.com/post/the-rise-of-ai-in-parking) - MEDIUM confidence
- [Tolk.ai Parking Chatbot](https://www.tolk.ai/en/chatbot-reservation-parking) - MEDIUM confidence
- [GetMyParking AVA](https://blog.getmyparking.com/2025/09/17/meet-ava-ai-customer-support-for-parking/) - MEDIUM confidence

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Configuration options | HIGH | Official llama-cpp-python documentation |
| Use cases | MEDIUM | Industry examples + reasonable inference |
| Fallback strategies | HIGH | Standard error handling patterns |
| Feature dependencies | MEDIUM | Architectural inference |
| Anti-features | MEDIUM | Aligned with PROJECT.md constraints |
