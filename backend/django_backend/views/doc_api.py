import os
import uuid
import time
from functools import partial

# DRF Imports
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

# Custom imports
from django_backend.models import Document
from django_backend.permissions import IsViewerOrAbove, IsEditorOrAbove
from django_backend.serializers import DocumentSerializer
from app.vector_store import delete_document_from_index
from .doc_indexing import process_document_indexing

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

_REDIS_URL = os.getenv("INTRADOC_REDIS_URL", "redis://localhost:6379/0")

def _get_queue():
    try:
        import redis as _redis
        from rq import Queue
        _conn = _redis.from_url(_REDIS_URL)
        _conn.ping()
        return Queue("ingestion", connection=_conn, default_timeout=600)
    except Exception:
        return None

def _schedule_indexing(doc_id, filename, filepath, department):
    q = _get_queue()
    if q is not None:
        from rq import Retry
        q.enqueue(process_document_indexing, doc_id, filename, filepath, department,
                  retry=Retry(max=3, interval=[10, 30, 60]),
                  job_timeout=600)
    else:
        from concurrent.futures import ThreadPoolExecutor
        pool = ThreadPoolExecutor(max_workers=4)
        pool.submit(process_document_indexing, doc_id, filename, filepath, department)

def _save_uploaded_file(file, doc_id, filename):
    filepath = os.path.join(UPLOADS_DIR, f"{doc_id}_{filename}")
    with open(filepath, "wb") as destination:
        for chunk in file.chunks():
            destination.write(chunk)
    return filepath

def _get_user_context(request):
    try:
        return request.user.profile.department, request.user.profile.role
    except Exception:
        return 'General', 'Viewer'

def _resolve_department(user_role, user_department, request):
    if user_role == 'Admin':
        requested_dept = request.data.get("department")
        if requested_dept and requested_dept != "All Departments":
            return requested_dept
    return user_department

@api_view(['POST'])
@permission_classes([IsEditorOrAbove])
def upload_document(request):
    if 'file' not in request.FILES:
        return Response({"detail": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

    file = request.FILES['file']
    doc_id = str(uuid.uuid4())
    filename = file.name
    user_department, user_role = _get_user_context(request)
    user_department = _resolve_department(user_role, user_department, request)

    try:
        filepath = _save_uploaded_file(file, doc_id, filename)
    except Exception as e:
        return Response({"detail": f"Failed to save file: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    file_size = os.path.getsize(filepath)

    Document.objects.create(
        id=doc_id,
        user=request.user,
        filename=filename,
        path=filepath,
        file_size=file_size,
        status="ingesting",
        classification="General",
        risk_status="Clean",
        department=user_department
    )

    _schedule_indexing(doc_id, filename, filepath, user_department)

    return Response({
        "id": doc_id,
        "filename": filename,
        "status": "ingesting",
        "department": user_department,
        "message": f"File upload complete. Background parsing and vector indexing started for {user_department} department."
    })

@api_view(['POST'])
@permission_classes([IsEditorOrAbove])
def upload_documents_batch(request):
    files = request.FILES.getlist("files")
    if not files:
        return Response({"detail": "No files uploaded. Send as form-data with key 'files' (multiple)."}, status=status.HTTP_400_BAD_REQUEST)

    user_department, user_role = _get_user_context(request)
    user_department = _resolve_department(user_role, user_department, request)

    if len(files) > 1000:
        return Response({"detail": "Batch size limited to 1000 files per request."}, status=status.HTTP_400_BAD_REQUEST)

    results = []
    errors = []
    for file in files:
        doc_id = str(uuid.uuid4())
        filename = file.name
        try:
            filepath = _save_uploaded_file(file, doc_id, filename)
            file_size = os.path.getsize(filepath)
            Document.objects.create(
                id=doc_id,
                user=request.user,
                filename=filename,
                path=filepath,
                file_size=file_size,
                status="ingesting",
                classification="General",
                risk_status="Clean",
                department=user_department
            )
            _schedule_indexing(doc_id, filename, filepath, user_department)
            results.append({"id": doc_id, "filename": filename, "status": "ingesting"})
        except Exception as e:
            errors.append({"filename": filename, "error": str(e)})

    return Response({
        "dispatched": len(results),
        "errors": len(errors),
        "documents": results,
        "error_details": errors,
        "department": user_department,
        "message": f"{len(results)} files queued for indexing (concurrency={_MAX_CONCURRENT_INDEXING})."
    })

@api_view(['GET'])
@permission_classes([IsViewerOrAbove])
def get_documents_list(request):
    try:
        profile = request.user.profile
        user_role = profile.role
        user_department = profile.department
    except Exception:
        user_role = 'Viewer'
        user_department = 'General'

    # Admins see ALL documents, others see only their department
    if user_role == 'Admin':
        requested_dept = request.GET.get('department')
        if requested_dept and requested_dept != "All Departments":
            docs = Document.objects.filter(department=requested_dept).order_by("-created_at")
        else:
            docs = Document.objects.all().order_by("-created_at")
    else:
        docs = Document.objects.filter(department=user_department).order_by("-created_at")

    serializer = DocumentSerializer(docs, many=True)
    return Response(serializer.data)

@api_view(['DELETE'])
@permission_classes([IsEditorOrAbove])
def delete_document(request, doc_id):
    try:
        user_role = request.user.profile.role
        user_department = request.user.profile.department
    except Exception:
        user_role = 'Viewer'
        user_department = 'General'

    # Admins can delete any document, others only their department
    if user_role == 'Admin':
        doc = Document.objects.filter(id=doc_id).first()
    else:
        doc = Document.objects.filter(id=doc_id, department=user_department).first()

    if not doc:
        return Response({"detail": "Document not found or unauthorized."}, status=status.HTTP_404_NOT_FOUND)

    doc_department = doc.department

    # Delete from file system
    try:
        if os.path.exists(doc.path):
            os.remove(doc.path)
    except Exception as e:
        print(f"Error removing file from disk: {str(e)}")

    # Delete from ChromaDB vector store (department-scoped)
    try:
        delete_document_from_index(doc_id, department=doc_department)
    except Exception as e:
        print(f"Error removing vector embeddings: {str(e)}")

    # Delete SQLite metadata record
    doc.delete()
    return Response({"status": "success", "message": f"Document '{doc.filename}' deleted successfully."})
