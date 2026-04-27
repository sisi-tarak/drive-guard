import os

_api_key = os.getenv("GEMINI_API_KEY", "")
_model = None


def _get_model():
    global _model
    if _model is not None:
        return _model
    if not _api_key:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=_api_key)
        _model = genai.GenerativeModel("gemini-1.5-flash")
        return _model
    except Exception:
        return None


def enhance_search_query(query: str) -> str:
    """
    Use Gemini to expand a short search phrase into a rich visual description
    so CLIP embeddings can match images more accurately.

    Falls back to the original query if GEMINI_API_KEY is not set or the call fails.
    """
    model = _get_model()
    if model is None:
        return query

    prompt = (
        f'A user is searching for a photo described as: "{query}"\n\n'
        "Write a detailed visual description (2–3 sentences) of what this photo likely "
        "looks like. Include the setting, people, colors, objects, lighting, and atmosphere. "
        "Return only the description — no preamble, no explanation."
    )
    try:
        response = model.generate_content(prompt)
        enhanced = response.text.strip()
        return enhanced if enhanced else query
    except Exception:
        return query
