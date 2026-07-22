import os
import uuid
import docx2txt
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import chromadb


# Department list for multi-tenant vector isolation
DEPARTMENTS = ['HR', 'Legal', 'Finance', 'Technical', 'General']


# Cache integration (lazy initialized)
_cache_enabled = False
_vector_cache = {}

def _init_vector_cache():
    global _cache_enabled, _vector_cache
    if _cache_enabled:
        return
    try:
        from django_backend.cache.embedding_cache import EmbeddingCache
        from django_backend.cache.domain_caches import RetrievalCache
        _vector_cache["embedding"] = EmbeddingCache()
        _vector_cache["retrieval"] = RetrievalCache()
        _cache_enabled = True
    except Exception:
        _cache_enabled = False

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

class LocalSentenceTransformerEmbeddings:
    def __init__(self, model_name=EMBEDDING_MODEL_NAME):
        self.model = SentenceTransformer(model_name)

    def embed_documents(self, texts):
        embeddings = self.model.encode(texts, show_progress_bar=False)
        return [list(map(float, e)) for e in embeddings]

    def embed_query(self, text):
        _init_vector_cache()
        if _cache_enabled:
            ec = _vector_cache["embedding"]
            cached = ec.get_embedding(text, EMBEDDING_MODEL_NAME)
            if cached is not None:
                return cached
        embedding = self.model.encode(text, show_progress_bar=False)
        result = list(map(float, embedding))
        if _cache_enabled:
            ec = _vector_cache["embedding"]
            ec.set_embedding(text, EMBEDDING_MODEL_NAME, result)
        return result


# Initialize ChromaDB client and local embeddings
DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data"
)
CHROMA_PATH = os.path.join(DATA_DIR, "chroma")

chroma_client = chromadb.PersistentClient(
    path=CHROMA_PATH, settings=chromadb.Settings(anonymized_telemetry=False)
)

# Default fallback collection for backward compatibility
collection = chroma_client.get_or_create_collection("intradoc_rag")

embeddings_model = LocalSentenceTransformerEmbeddings()


def get_department_collection(department_name):
    """Get or create a department-specific ChromaDB collection."""
    safe_name = department_name.strip().lower()
    return chroma_client.get_or_create_collection(f"intradoc_{safe_name}")


def extract_text_from_file(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    pages_text = []  # list of dicts: {"text": str, "page": int}

    if ext == ".pdf":
        reader = PdfReader(filepath)
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text and text.strip():
                pages_text.append({"text": text, "page": i + 1})
    elif ext == ".docx":
        text = docx2txt.process(filepath)
        if text and text.strip():
            pages_text.append({"text": text, "page": 1})
    elif ext in [".txt", ".md", ".markdown"]:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
        if text and text.strip():
            pages_text.append({"text": text, "page": 1})
    else:
        raise ValueError(f"Unsupported file format: {ext}")

    return pages_text


def index_document(doc_id, filename, filepath, department='General'):
    """Index document chunks into the department-specific ChromaDB collection."""
    from app.semantic_chunk import semantic_chunk

    pages_data = extract_text_from_file(filepath)
    if not pages_data:
        raise ValueError("No text could be extracted from the file.")

    full_text = "\n\n".join(p["text"] for p in pages_data)
    raw_chunks = semantic_chunk(full_text, target_tokens=300, overlap_sentences=2)

    chunks = []
    chunk_metadatas = []
    chunk_ids = []

    for chunk_index, text_chunk in enumerate(raw_chunks):
        stripped = text_chunk.strip()
        if not stripped:
            continue
        first_sentence = stripped[:80].lower()
        page = 1
        for p in pages_data:
            if first_sentence in p["text"].lower():
                page = p["page"]
                break
        chunks.append(stripped)
        chunk_metadatas.append({
            "doc_id": doc_id,
            "filename": filename,
            "page": page,
            "chunk_index": chunk_index,
            "department": department,
        })
        chunk_ids.append(f"{doc_id}_chunk_{chunk_index}")

    if not chunks:
        raise ValueError("No text chunks generated.")

    chunk_embeddings = embeddings_model.embed_documents(chunks)

    target_collection = get_department_collection(department)
    target_collection.add(
        ids=chunk_ids,
        embeddings=chunk_embeddings,
        metadatas=chunk_metadatas,
        documents=chunks,
    )

    return len(chunks)


def query_vector_store(query_text, n_results=4, doc_ids=None, department=None, admin_all=False, use_hybrid=True):
    """
    Query the vector store with department scoping.
    - admin_all=True: query ALL department collections, merge and sort results
    - department specified: query only that department's collection
    - neither: fall back to default collection (backward compat)
    - use_hybrid=True: fuse dense + BM25 via Reciprocal Rank Fusion
    """
    if doc_ids is not None and len(doc_ids) == 0:
        return []

    _init_vector_cache()
    cache_filters = {"n_results": n_results, "doc_ids": doc_ids, "department": department, "admin_all": admin_all}
    if _cache_enabled:
        rc = _vector_cache["retrieval"]
        cached = rc.get_results(query_text, cache_filters)
        if cached is not None:
            return cached

    query_embedding = embeddings_model.embed_query(query_text)

    where_clause = None
    if doc_ids is not None:
        if len(doc_ids) == 1:
            where_clause = {"doc_id": doc_ids[0]}
        else:
            where_clause = {"doc_id": {"$in": doc_ids}}

    dense_n = max(n_results * 3, 20) if use_hybrid else n_results

    def _query_single(coll, n):
        c = coll.count()
        if c == 0:
            return []
        r = coll.query(query_embeddings=[query_embedding], n_results=min(n, c), where=where_clause)
        out = []
        if r and r["ids"] and len(r["ids"][0]) > 0:
            for i in range(len(r["ids"][0])):
                dist = r["distances"][0][i]
                out.append({
                    "id": r["ids"][0][i],
                    "text": r["documents"][0][i],
                    "filename": r["metadatas"][0][i]["filename"],
                    "doc_id": r["metadatas"][0][i]["doc_id"],
                    "page": r["metadatas"][0][i]["page"],
                    "chunk_index": r["metadatas"][0][i]["chunk_index"],
                    "department": r["metadatas"][0][i].get("department", department or "General"),
                    "similarity": round((1 / (1 + dist)) * 100, 1),
                })
        return out

    dense_results = []
    if admin_all:
        seen = set()
        for dept in DEPARTMENTS:
            try:
                for c in _query_single(get_department_collection(dept), dense_n):
                    if c["id"] not in seen:
                        seen.add(c["id"])
                        dense_results.append(c)
            except Exception:
                continue
        try:
            for c in _query_single(collection, dense_n):
                if c["id"] not in seen:
                    seen.add(c["id"])
                    dense_results.append(c)
        except Exception:
            pass
    elif department:
        dense_results = _query_single(get_department_collection(department), dense_n)
    else:
        dense_results = _query_single(collection, dense_n)

    if not dense_results:
        return []

    if use_hybrid and len(dense_results) > 1:
        from app.retrieval.bm25 import bm25_search
        from app.retrieval.hybrid import reciprocal_rank_fusion
        bm25_results = bm25_search(dense_results, query_text, top_k=len(dense_results))
        fused = reciprocal_rank_fusion(dense_results, bm25_results)
        result = fused[:n_results]
    else:
        dense_results.sort(key=lambda x: x["similarity"], reverse=True)
        result = dense_results[:n_results]

    if _cache_enabled and result:
        doc_ids_for_cache = list(set(c["doc_id"] for c in result))
        rc = _vector_cache["retrieval"]
        rc.set_results(query_text, cache_filters, result, doc_ids=doc_ids_for_cache)

    return result


def delete_document_from_index(doc_id, department=None):
    """Delete document chunks from the vector store.
    If department is specified, delete from that department's collection.
    Otherwise, try all collections including the legacy default.
    """
    if department:
        try:
            target_collection = get_department_collection(department)
            target_collection.delete(where={"doc_id": doc_id})
        except Exception as e:
            print(f"Error deleting from department {department}: {str(e)}")
    else:
        # Try all department collections and the legacy default
        for dept in DEPARTMENTS:
            try:
                dept_collection = get_department_collection(dept)
                dept_collection.delete(where={"doc_id": doc_id})
            except Exception:
                pass
        try:
            collection.delete(where={"doc_id": doc_id})
        except Exception:
            pass


def delete_from_vector_store(doc_id, department=None):
    """Alias for delete_document_from_index for consistency."""
    return delete_document_from_index(doc_id, department)
