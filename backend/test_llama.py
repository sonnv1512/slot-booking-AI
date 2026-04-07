from llama_cpp import Llama

def test_llama_model():
    model_path = "models/qwen3-5.gguf"
    
    print(f"Loading model from {model_path}...")
    
    llm = Llama(
        model_path=model_path,
        n_ctx=512,
        n_threads=4,
        verbose=False
    )
    
    print("Model loaded successfully!")
    print("Running inference...")
    
    output = llm(
        "What is python?",
        max_tokens=50
    )
    
    print(f"Output: {output['choices'][0]['text']}")
    print("SUCCESS: llama-cpp-python is working with the model!")

if __name__ == "__main__":
    try:
        test_llama_model()
    except Exception as e:
        print(f"FAILURE: {e}")