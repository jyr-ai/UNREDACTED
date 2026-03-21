"""
LLM factory for UNREDACTED agents.

Reads AI_PROVIDER env var and returns the appropriate LangChain chat model.
All returned models share the same .ainvoke() / .invoke() interface so
agents don't need to know which provider is active.

Supported providers (set AI_PROVIDER env var):
  anthropic  — Claude via Anthropic API (default)
  deepseek   — DeepSeek-V3 / R1 via OpenAI-compatible API
  openai     — OpenAI GPT-4o
  groq       — Groq (llama-3.3-70b, mixtral, etc.)
"""

import os


def get_llm(temperature: float = 0.1):
    """Return a LangChain chat model for the configured provider."""
    provider = os.getenv("AI_PROVIDER", "anthropic").lower().strip()

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=os.getenv("AI_MODEL", "claude-sonnet-4-6"),
            temperature=temperature,
            api_key=os.getenv("ANTHROPIC_API_KEY"),
        )

    if provider == "deepseek":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=os.getenv("AI_MODEL", "deepseek-chat"),
            temperature=temperature,
            api_key=os.getenv("DEEPSEEK_API_KEY"),
            base_url="https://api.deepseek.com",
        )

    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=os.getenv("AI_MODEL", "gpt-4o"),
            temperature=temperature,
            api_key=os.getenv("OPENAI_API_KEY"),
        )

    if provider == "groq":
        from langchain_groq import ChatGroq
        return ChatGroq(
            model=os.getenv("AI_MODEL", "llama-3.3-70b-versatile"),
            temperature=temperature,
            api_key=os.getenv("GROQ_API_KEY"),
        )

    raise ValueError(
        f"Unknown AI_PROVIDER '{provider}'. "
        "Valid options: anthropic, deepseek, openai, groq"
    )
