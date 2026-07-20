# DRF Imports
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

# Custom imports
from django_backend.models import LLMConfig
from django_backend.permissions import IsAdminUser

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_public_llm_config(request):
    config = LLMConfig.objects.first()
    if not config:
        config = LLMConfig.objects.create()
    
    return Response({
        "enforce_globally": config.enforce_globally,
        "config": {
            "provider": config.provider,
            "model": config.model,
            "temperature": config.temperature,
            "k": config.k
        }
    })

@api_view(['GET'])
@permission_classes([IsAdminUser])
def get_admin_llm_config(request):
    config = LLMConfig.objects.first()
    if not config:
        config = LLMConfig.objects.create()
        
    return Response({
        "enforce_globally": config.enforce_globally,
        "config": {
            "provider": config.provider,
            "model": config.model,
            "temperature": config.temperature,
            "k": config.k
        },
        "api_keys": {
            "groq": config.groq_api_key,
            "gemini": config.gemini_api_key,
            "openai": config.openai_api_key
        }
    })

@api_view(['PUT'])
@permission_classes([IsAdminUser])
def update_admin_llm_config(request):
    config = LLMConfig.objects.first()
    if not config:
        config = LLMConfig.objects.create()
        
    data = request.data
    config.enforce_globally = data.get("enforce_globally", config.enforce_globally)
    
    cfg = data.get("config", {})
    if 'provider' in cfg: config.provider = cfg['provider']
    if 'model' in cfg: config.model = cfg['model']
    if 'temperature' in cfg: config.temperature = cfg['temperature']
    if 'k' in cfg: config.k = cfg['k']
    
    keys = data.get("api_keys", {})
    if "groq" in keys: config.groq_api_key = keys["groq"]
    if "gemini" in keys: config.gemini_api_key = keys["gemini"]
    if "openai" in keys: config.openai_api_key = keys["openai"]
        
    config.save()
    
    return Response({"message": "System LLM configuration updated."})
