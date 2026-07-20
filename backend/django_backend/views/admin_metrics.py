from django.db import models
from django.contrib.auth.models import User

# DRF Imports
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

# Custom imports
from django_backend.models import Document, ChatSession, ChatMessage, UserProfile
from django_backend.permissions import IsAdminUser

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
