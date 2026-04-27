from presidio_analyzer import AnalyzerEngine
from presidio_analyzer.nlp_engine import NlpEngineProvider

# Initialize the analyzer
provider = NlpEngineProvider(nlp_configuration={
    "nlp_engine_name": "spacy",
    "models": [{"lang_code": "en", "model_name": "en_core_web_lg"}]
})
nlp_engine = provider.create_engine()
analyzer = AnalyzerEngine(nlp_engine=nlp_engine, supported_languages=["en"])

def scan_text_for_pii(text: str, file_name: str = ""):
    """Scan text for PII and sensitive information"""
    if not text or len(text.strip()) == 0:
        return []

    results = analyzer.analyze(
        text=text,
        language="en",
        entities=[
            "EMAIL_ADDRESS",
            "PHONE_NUMBER",
            "CREDIT_CARD",
            "IBAN_CODE",
            "IP_ADDRESS",
            "PERSON",
            "LOCATION",
            "NRP",
            "MEDICAL_LICENSE",
            "URL"
        ]
    )

    findings = []
    for result in results:
        findings.append({
            "entity_type": result.entity_type,
            "score": round(result.score, 2),
            "start": result.start,
            "end": result.end,
            "value": text[result.start:result.end],
            "file_name": file_name
        })

    return findings