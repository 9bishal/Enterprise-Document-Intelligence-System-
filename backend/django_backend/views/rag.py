import os
import uuid
import json

# DRF Imports
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

# Custom imports
from django_backend.models import Document, ChatSession, ChatMessage, LLMConfig
from django_backend.permissions import IsViewerOrAbove
from django_backend.serializers import ChatSessionSerializer, ChatMessageSerializer
from app.rag_graph import run_rag_pipeline

API_KEY_PREFIXES = {
    "groq": "gsk_",
    "gemini": "AIza",
    "openai": "sk-",
}

def _valid_key(provider: str, key: str) -> bool:
    if not key:
        return False
    prefix = API_KEY_PREFIXES.get(provider)
    if prefix and key.startswith(prefix):
        return True
    return False

@api_view(['GET', 'POST'])
@permission_classes([IsViewerOrAbove])
def chat_sessions_api(request):
    if request.method == "POST":
        name = request.data.get("name")
        if not name:
            return Response({"detail": "Session name is required"}, status=status.HTTP_400_BAD_REQUEST)

        session_id = str(uuid.uuid4())
        session = ChatSession.objects.create(
            id=session_id,
            user=request.user,
            name=name
        )
        serializer = ChatSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    else:
        sessions = ChatSession.objects.filter(user=request.user).order_by("-created_at")
        serializer = ChatSessionSerializer(sessions, many=True)
        return Response(serializer.data)

@api_view(['DELETE'])
@permission_classes([IsViewerOrAbove])
def delete_chat_session(request, session_id):
    session = ChatSession.objects.filter(user=request.user, id=session_id).first()
    if not session:
        return Response({"detail": "Session not found or unauthorized."}, status=status.HTTP_404_NOT_FOUND)

    session.delete()
    return Response({"status": "success", "message": "Session deleted successfully."})

@api_view(['GET'])
@permission_classes([IsViewerOrAbove])
def get_messages(request, session_id):
    session = ChatSession.objects.filter(user=request.user, id=session_id).first()
    if not session:
        return Response({"detail": "Session not found or unauthorized."}, status=status.HTTP_404_NOT_FOUND)

    messages = ChatMessage.objects.filter(session=session).order_by("created_at")
    serializer = ChatMessageSerializer(messages, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsViewerOrAbove])
def query_rag(request):
    session_id = request.data.get("session_id")
    question = request.data.get("question")
    api_keys = request.data.get("api_keys", {})
    config_payload = request.data.get("config", {})

    if not session_id or not question:
        return Response({"detail": "session_id and question are required."}, status=status.HTTP_400_BAD_REQUEST)

    session = ChatSession.objects.filter(user=request.user, id=session_id).first()
    if not session:
        return Response({"detail": "Session not found or unauthorized."}, status=status.HTTP_404_NOT_FOUND)

    # 1. Save User Message in database
    user_msg_id = str(uuid.uuid4())
    ChatMessage.objects.create(
        id=user_msg_id,
        session=session,
        role="user",
        content=question
    )

    # 2. Get user's department and role for scoping
    try:
        profile = request.user.profile
        user_role = profile.role
        user_department = profile.department
    except Exception:
        user_role = 'Viewer'
        user_department = 'General'

    is_admin = user_role == 'Admin'

    requested_dept = request.data.get("department")
    
    admin_all = is_admin
    target_dept = user_department
    
    if is_admin:
        if requested_dept and requested_dept != "All Departments":
            admin_all = False
            target_dept = requested_dept
        else:
            target_dept = None

    # 3. Collect user's indexed document IDs for vector query isolation
    if admin_all:
        user_docs = Document.objects.filter(status="indexed")
    elif is_admin:
        user_docs = Document.objects.filter(department=target_dept, status="indexed")
    else:
        user_docs = Document.objects.filter(department=user_department, status="indexed")
    user_doc_ids = [str(d.id) for d in user_docs]

    # Check Global Settings Enforcements
    llm_config = LLMConfig.objects.first()
    if llm_config and llm_config.enforce_globally:
        api_keys = {
            "groq": llm_config.get_groq_key() if _valid_key("groq", llm_config.get_groq_key()) else "",
            "gemini": llm_config.get_gemini_key() if _valid_key("gemini", llm_config.get_gemini_key()) else "",
            "openai": llm_config.get_openai_key() if _valid_key("openai", llm_config.get_openai_key()) else "",
        }
        p = llm_config.provider
        model_config = {
            "provider": p,
            "model": llm_config.model,
            "temperature": llm_config.temperature,
            "k": llm_config.k,
            "fallback_provider": "groq" if p != "groq" else "gemini",
            "fallback_model": "llama-3.3-70b-versatile" if p != "groq" else "gemini-1.5-flash",
            "max_context_tokens": 3000,
        }
    else:
        p = config_payload.get("provider", "groq")
        model_config = {
            "provider": p,
            "model": config_payload.get("model", "llama-3.3-70b-versatile" if p == "groq" else "gemini-1.5-flash"),
            "temperature": config_payload.get("temperature", 0.3),
            "k": config_payload.get("k", 4),
            "fallback_provider": "groq" if p != "groq" else "gemini",
            "fallback_model": "llama-3.3-70b-versatile" if p != "groq" else "gemini-1.5-flash",
            "max_context_tokens": 3000,
        }

    # 4. Execute the stateful LangGraph pipeline with department scoping
    result = run_rag_pipeline(
        question, api_keys, model_config,
        user_doc_ids=user_doc_ids,
        department=target_dept,
        admin_all=admin_all
    )

    # 5. Save Assistant Response in database
    assistant_msg_id = str(uuid.uuid4())
    ChatMessage.objects.create(
        id=assistant_msg_id,
        session=session,
        role="assistant",
        content=result["generation"],
        sources=json.dumps(result["documents"]),
        steps=json.dumps(result["steps"]),
        model_used=result.get("model_used", ""),
        input_tokens=result.get("input_tokens", 0),
        output_tokens=result.get("output_tokens", 0),
        estimated_cost_usd=result.get("estimated_cost_usd", 0.0),
        latency_ms=result.get("latency_ms", 0),
        cache_hit=result.get("cache_hit", False),
    )

    return Response({
        "id": assistant_msg_id,
        "role": "assistant",
        "content": result["generation"],
        "sources": result["documents"],
        "steps": result["steps"],
        "success": result["success"],
        "cache_hit": result.get("cache_hit", False),
        "model_used": result.get("model_used", ""),
        "estimated_cost_usd": result.get("estimated_cost_usd", 0.0),
        "latency_ms": result.get("latency_ms", 0),
        "input_tokens": result.get("input_tokens", 0),
        "output_tokens": result.get("output_tokens", 0),
        "evaluation": result.get("evaluation"),
    })
