from django.db import models

# DRF Imports
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

# Custom imports
from django_backend.models import Document
from django_backend.permissions import IsAdminUser

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
