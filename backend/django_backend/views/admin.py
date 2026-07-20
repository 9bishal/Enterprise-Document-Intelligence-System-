import random
from django.db import models
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import os

# DRF Imports
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

# Custom imports
from django_backend.models import Document, ChatSession, ChatMessage, UserProfile, UserInvitation, LLMConfig
from django_backend.permissions import IsAdminUser

# --- LLM Config Endpoints ---

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

# --- Admin Monitoring Endpoint ---

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_metrics(request):
    # Counts
    total_users = User.objects.count()
    total_documents = Document.objects.count()
    total_chunks = Document.objects.aggregate(models.Sum('chunk_count'))['chunk_count__sum'] or 0
    total_file_size = Document.objects.aggregate(models.Sum('file_size'))['file_size__sum'] or 0
    total_sessions = ChatSession.objects.count()
    
    # User lists with role and department
    users_list = []
    for u in User.objects.all():
        profile, _ = UserProfile.objects.get_or_create(user=u, defaults={'role': 'Viewer', 'department': 'General'})
        users_list.append({
            "username": u.username,
            "role": profile.role,
            "department": profile.department,
            "date_joined": u.date_joined.isoformat()
        })
        
    # Classification distributions
    class_dist = list(Document.objects.values('classification').annotate(count=models.Count('id')))
    class_dist_map = {c['classification']: c['count'] for c in class_dist}
    for cat in ["Legal", "Financial", "Technical", "Human Resources", "General"]:
        if cat not in class_dist_map:
            class_dist_map[cat] = 0
            
    # Risk flagged documents
    flagged_docs = Document.objects.filter(risk_status="Risk Detected").order_by("-created_at")
    flagged_docs_list = [{
        "id": d.id,
        "filename": d.filename,
        "owner": d.user.username,
        "classification": d.classification,
        "risk_status": d.risk_status,
        "risk_details": d.risk_details,
        "department": d.department,
        "created_at": d.created_at.isoformat()
    } for d in flagged_docs]
    
    # Estimated tokens based on character counts / 4
    total_chars_agg = ChatMessage.objects.aggregate(total=models.Sum(models.functions.Length('content')))
    total_chars = total_chars_agg['total'] or 0
    estimated_tokens = int(total_chars / 4)
    
    # Recent activities
    recent_activity_list = []
    
    recent_docs = Document.objects.order_by("-created_at")[:5]
    for d in recent_docs:
        recent_activity_list.append({
            "type": "upload",
            "username": d.user.username,
            "filename": d.filename,
            "department": d.department,
            "timestamp": d.created_at.isoformat()
        })
        
    recent_msgs = ChatMessage.objects.filter(role="user").order_by("-created_at")[:5]
    for m in recent_msgs:
        recent_activity_list.append({
            "type": "chat",
            "username": m.session.user.username,
            "content": m.content[:40] + ("..." if len(m.content) > 40 else ""),
            "timestamp": m.created_at.isoformat()
        })
        
    # Sort recent activity by timestamp descending
    recent_activity_list = sorted(recent_activity_list, key=lambda x: x['timestamp'], reverse=True)[:8]
    
    return Response({
        "metrics": {
            "total_users": total_users,
            "total_documents": total_documents,
            "total_chunks": total_chunks,
            "total_file_size": total_file_size,
            "total_sessions": total_sessions,
            "estimated_tokens": estimated_tokens
        },
        "users": users_list,
        "classification_distribution": class_dist_map,
        "flagged_documents": flagged_docs_list,
        "recent_activities": recent_activity_list
    })

# --- Admin Invite Endpoint ---

@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_invite(request):
    """Send an OTP invitation email to a new employee."""
    email = request.data.get("email", "").strip()
    role = request.data.get("role", "Viewer")
    department = request.data.get("department", "General")

    if not email:
        return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

    # Validate role and department
    valid_roles = ['Viewer', 'Editor', 'Admin']
    valid_departments = ['HR', 'Legal', 'Finance', 'Technical', 'General']

    if role not in valid_roles:
        return Response({"detail": f"Invalid role. Must be one of: {', '.join(valid_roles)}"}, status=status.HTTP_400_BAD_REQUEST)
    if department not in valid_departments:
        return Response({"detail": f"Invalid department. Must be one of: {', '.join(valid_departments)}"}, status=status.HTTP_400_BAD_REQUEST)

    # Check if user with this email already exists
    if User.objects.filter(email=email).exists():
        return Response({"detail": "A user with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    expires_at = timezone.now() + timedelta(minutes=15)

    # Create or update invitation (re-invite invalidates previous OTP)
    invitation, created = UserInvitation.objects.update_or_create(
        email=email,
        defaults={
            "otp": otp,
            "role": role,
            "department": department,
            "expires_at": expires_at,
            "is_verified": False,
        }
    )

    # Send email via Django SMTP
    try:
        from django.core.mail import send_mail
        subject = "Intradoc AI — Your Corporate Workspace Invitation"
        message = (
            f"Hello,\n\n"
            f"You have been invited to join Intradoc AI as a {role} in the {department} department.\n\n"
            f"Your one-time registration code is:\n\n"
            f"    {otp}\n\n"
            f"This code expires in 15 minutes.\n\n"
            f"To complete your registration:\n"
            f"1. Go to http://localhost:5173\n"
            f"2. Click 'Register now'\n"
            f"3. Enter your username, password, this email, and the code above\n\n"
            f"— Intradoc AI Administration"
        )
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )
        return Response({
            "detail": f"Invitation sent successfully to {email}.",
            "role": role,
            "department": department
        })
    except Exception as e:
        # Even if email fails, the OTP is saved so admin can relay it manually
        print(f"SMTP email send error: {str(e)}")
        return Response({
            "detail": f"Invitation created but email delivery failed. OTP: {otp}. Error: {str(e)}",
            "otp": otp,
            "role": role,
            "department": department
        }, status=status.HTTP_207_MULTI_STATUS)

# --- Admin User Management Endpoints ---

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_users_list(request):
    """Get all users with their profiles for the corporate roster."""
    users_data = []
    for u in User.objects.all().order_by('-date_joined'):
        profile, _ = UserProfile.objects.get_or_create(user=u, defaults={'role': 'Viewer', 'department': 'General'})
        users_data.append({
            "id": u.id,
            "username": u.username,
            "email": u.email or "",
            "role": profile.role,
            "department": profile.department,
            "date_joined": u.date_joined.isoformat()
        })
    return Response(users_data)

@api_view(['PATCH'])
@permission_classes([IsAdminUser])
def admin_update_user(request, user_id):
    """Update a user's role and/or department."""
    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    profile, _ = UserProfile.objects.get_or_create(user=target_user, defaults={'role': 'Viewer', 'department': 'General'})

    # Prevent admin from demoting themselves
    if target_user.id == request.user.id:
        new_role = request.data.get("role", profile.role)
        if new_role != 'Admin':
            return Response({"detail": "You cannot demote yourself. Ask another admin to change your role."}, status=status.HTTP_400_BAD_REQUEST)

    new_role = request.data.get("role", None)
    new_department = request.data.get("department", None)

    if new_role:
        valid_roles = ['Viewer', 'Editor', 'Admin']
        if new_role not in valid_roles:
            return Response({"detail": f"Invalid role. Must be one of: {', '.join(valid_roles)}"}, status=status.HTTP_400_BAD_REQUEST)
        profile.role = new_role

    if new_department:
        valid_departments = ['HR', 'Legal', 'Finance', 'Technical', 'General']
        if new_department not in valid_departments:
            return Response({"detail": f"Invalid department. Must be one of: {', '.join(valid_departments)}"}, status=status.HTTP_400_BAD_REQUEST)
        profile.department = new_department

    profile.save()

    return Response({
        "detail": f"User '{target_user.username}' updated successfully.",
        "id": target_user.id,
        "username": target_user.username,
        "role": profile.role,
        "department": profile.department
    })

# --- Admin Knowledge Graph Data Endpoint ---

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_knowledge_graph_data(request):
    """Return department and document graph data for the Enterprise Knowledge Graph visualization."""
    departments_data = []
    documents_data = []
    connections = []

    valid_departments = ['HR', 'Legal', 'Finance', 'Technical', 'General']

    for dept in valid_departments:
        dept_docs = Document.objects.filter(department=dept)
        doc_count = dept_docs.count()
        chunk_sum = dept_docs.aggregate(models.Sum('chunk_count'))['chunk_count__sum'] or 0

        departments_data.append({
            "name": dept,
            "document_count": doc_count,
            "chunk_count": chunk_sum
        })

        for d in dept_docs:
            documents_data.append({
                "id": d.id,
                "filename": d.filename,
                "department": d.department,
                "status": d.status,
                "chunk_count": d.chunk_count,
                "classification": d.classification,
                "risk_status": d.risk_status,
                "file_size": d.file_size,
                "owner": d.user.username
            })
            connections.append({
                "from_department": dept,
                "to_document": d.id
            })

    return Response({
        "departments": departments_data,
        "documents": documents_data,
        "connections": connections
    })


# --- Admin Delete Document Endpoint ---

@api_view(['DELETE'])
@permission_classes([IsAdminUser])
def admin_delete_document(request, doc_id):
    """Delete a document from the system and vector database."""
    try:
        doc = Document.objects.filter(id=doc_id).first()
        if not doc:
            return Response(
                {"detail": "Document not found."}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Delete from vector store (Chroma)
        try:
            from app.vector_store import delete_from_vector_store
            delete_from_vector_store(doc_id)
        except Exception as e:
            print(f"Warning: Could not delete from vector store: {str(e)}")
        
        # Delete the file from disk if it exists
        if doc.path and os.path.exists(doc.path):
            try:
                os.remove(doc.path)
            except Exception as e:
                print(f"Warning: Could not delete file from disk: {str(e)}")
        
        # Delete from database
        doc.delete()
        
        return Response({
            "status": "success",
            "message": f"Document '{doc.filename}' deleted successfully."
        })
    
    except Exception as e:
        return Response(
            {"detail": f"Error deleting document: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
