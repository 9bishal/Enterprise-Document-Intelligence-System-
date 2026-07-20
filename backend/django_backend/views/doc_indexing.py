import os
from django_backend.models import Document
from app.vector_store import index_document

# Helper function to classify and scan document risks
def analyze_document_classification_and_risks(filepath):
    try:
        from app.vector_store import extract_text_from_file
        pages_data = extract_text_from_file(filepath)
        if not pages_data:
            return "General", "Clean", "No text found to analyze."
        
        sample_text = ""
        for p in pages_data[:3]: # grab first 3 pages
            sample_text += p["text"] + "\n"
        
        sample_text = sample_text[:1500]
        
        prompt = f"""
        You are a corporate document security classifier and compliance screener. Analyze the document snippet below.
        
        Document Name: {os.path.basename(filepath)}
        Document Preview:
        {sample_text}
        
        Identify:
        1. The primary Classification of this document. It must be exactly one of: "Legal", "Financial", "Technical", "Human Resources", "General".
        2. Risk screening. Screen for confidentiality or regulatory compliance risks. Focus on:
           - Exposed API keys, secrets, private keys, passwords.
           - PII (Social Security Numbers, private phone numbers, home addresses).
           - Financial details (confidential salary charts, trade secrets).
         3. State if it is "Clean" or if a "Risk Detected" occurred.
        
        Format your output EXACTLY as a JSON object matching this schema:
        {{
            "classification": "Legal" | "Financial" | "Technical" | "Human Resources" | "General",
            "risk_status": "Clean" | "Risk Detected",
            "risk_details": "Explain in 1 sentence what risk was found, or leave empty if Clean."
        }}
        """
        
        from app.llm_helper import call_llm_json
        res = call_llm_json(
            prompt=prompt,
            system_prompt="You are a precise corporate security compliance assistant. Return valid JSON only.",
            provider="gemini", # default to gemini
            temperature=0.0
        )
        
        classification = res.get("classification", "General")
        risk_status = res.get("risk_status", "Clean")
        risk_details = res.get("risk_details", "")
        return classification, risk_status, risk_details
    except Exception as e:
        print(f"Error in analyze_document_classification_and_risks: {str(e)}")
        return "General", "Clean", f"Analysis error: {str(e)}"

# Background thread indexing worker with classification & risk analysis
def process_document_indexing(doc_id, filename, filepath, department='General'):
    try:
        print(f"Indexing background thread started for file: {filename} (Department: {department})")
        
        # 1. Run AI classification and risk screening
        classification, risk_status, risk_details = analyze_document_classification_and_risks(filepath)
        
        # 2. Map department to classification if needed
        # If AI classification doesn't match department type, use department-based classification
        dept_to_classification = {
            'HR': 'Human Resources',
            'Legal': 'Legal',
            'Finance': 'Financial',
            'Technical': 'Technical',
            'General': 'General'
        }
        
        # Use department-based classification as primary, AI classification as fallback
        mapped_classification = dept_to_classification.get(department, classification)
        if mapped_classification == 'General' and classification != 'General':
            # If mapped is General but AI found something specific, use AI classification
            mapped_classification = classification
        
        # 3. Ingest document text chunks into department-scoped vector store
        chunk_count = index_document(doc_id, filename, filepath, department=department)
        
        # 4. Save completed indices and AI metrics
        doc = Document.objects.get(id=doc_id)
        doc.status = "indexed"
        doc.chunk_count = chunk_count
        doc.classification = mapped_classification  # Use mapped classification
        doc.risk_status = risk_status
        doc.risk_details = risk_details
        doc.save()
        print(f"Indexing background thread completed successfully for: {filename} ({chunk_count} chunks, Class: {mapped_classification}, Risk: {risk_status}, Dept: {department})")
    except Exception as e:
        print(f"Indexing error in background thread for {filename}: {str(e)}")
        try:
            doc = Document.objects.get(id=doc_id)
            doc.status = "error"
            doc.error_message = str(e)
            doc.save()
        except Exception:
            pass
