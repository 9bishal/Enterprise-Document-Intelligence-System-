import os
import uuid
import docx2txt
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import chromadb


# Department list for multi-tenant vector isolation
DEPARTMENTS = ['HR', 'Legal', 'Finance', 'Technical', 'General']


# Local Embedding Class wrapper
class LocalSentenceTransformerEmbeddings:
    def __init__(self, model_name="all-MiniLM-L6-v2"):
        # Load the sentence transformer model locally
        self.model = SentenceTransformer(model_name)

    def embed_documents(self, texts):
        embeddings = self.model.encode(texts, show_progress_bar=False)
        return [list(map(float, e)) for e in embeddings]

    def embed_query(self, text):
        embedding = self.model.encode(text, show_progress_bar=False)
        return list(map(float, embedding))


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
    # 1. Extract text page-by-page
    pages_data = extract_text_from_file(filepath)
    if not pages_data:
        raise ValueError("No text could be extracted from the file.")

    # 2. Chunk text with metadata
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800, chunk_overlap=150, length_function=len
    )

    chunks = []
    chunk_metadatas = []
    chunk_ids = []

    chunk_index = 0
    for page_info in pages_data:
        page_text = page_info["text"]
        page_num = page_info["page"]

        split_texts = text_splitter.split_text(page_text)
        for text_chunk in split_texts:
            if not text_chunk.strip():
                continue
            chunks.append(text_chunk)
            chunk_metadatas.append(
                {
                    "doc_id": doc_id,
                    "filename": filename,
                    "page": page_num,
                    "chunk_index": chunk_index,
                    "department": department,
                }
            )
            chunk_ids.append(f"{doc_id}_chunk_{chunk_index}")
            chunk_index += 1

    if not chunks:
        raise ValueError("No text chunks generated.")

    # 3. Generate embeddings and upload to department-specific Chroma collection
    chunk_embeddings = embeddings_model.embed_documents(chunks)

    target_collection = get_department_collection(department)
    target_collection.add(
        ids=chunk_ids,
        embeddings=chunk_embeddings,
        metadatas=chunk_metadatas,
        documents=chunks,
    )

    return chunk_index


def query_vector_store(query_text, n_results=4, doc_ids=None, department=None, admin_all=False):
    """
    Query the vector store with department scoping.
    - admin_all=True: query ALL department collections, merge and sort results
    - department specified: query only that department's collection
    - neither: fall back to default collection (backward compat)
    """
    # Security filter: if the user has no documents uploaded, return empty list immediately
    if doc_ids is not None and len(doc_ids) == 0:
        return []

    query_embedding = embeddings_model.embed_query(query_text)

    # Construct Chroma DB filter clause
    where_clause = None
    if doc_ids is not None:
        if len(doc_ids) == 1:
            where_clause = {"doc_id": doc_ids[0]}
        else:
            where_clause = {"doc_id": {"$in": doc_ids}}

    if admin_all:
        # Admin Knowledge Graph: query ALL department collections and merge
        all_chunks = []
        for dept in DEPARTMENTS:
            try:
                dept_collection = get_department_collection(dept)
                count = dept_collection.count()
                if count == 0:
                    continue
                results = dept_collection.query(
                    query_embeddings=[query_embedding],
                    n_results=min(n_results, count),
                    where=where_clause
                )
                if results and results["ids"] and len(results["ids"][0]) > 0:
                    ids = results["ids"][0]
                    documents = results["documents"][0]
                    metadatas = results["metadatas"][0]
                    distances = results["distances"][0]
                    for i in range(len(ids)):
                        dist = distances[i]
                        similarity = round((1 / (1 + dist)) * 100, 1)
                        all_chunks.append({
                            "id": ids[i],
                            "text": documents[i],
                            "filename": metadatas[i]["filename"],
                            "doc_id": metadatas[i]["doc_id"],
                            "page": metadatas[i]["page"],
                            "chunk_index": metadatas[i]["chunk_index"],
                            "department": metadatas[i].get("department", dept),
                            "similarity": similarity,
                        })
            except Exception as e:
                print(f"Error querying department {dept}: {str(e)}")
                continue

        # Also query the legacy default collection for backward compat
        try:
            legacy_count = collection.count()
            if legacy_count > 0:
                results = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=min(n_results, legacy_count),
                    where=where_clause
                )
                if results and results["ids"] and len(results["ids"][0]) > 0:
                    ids = results["ids"][0]
                    documents = results["documents"][0]
                    metadatas = results["metadatas"][0]
                    distances = results["distances"][0]
                    for i in range(len(ids)):
                        dist = distances[i]
                        similarity = round((1 / (1 + dist)) * 100, 1)
                        all_chunks.append({
                            "id": ids[i],
                            "text": documents[i],
                            "filename": metadatas[i]["filename"],
                            "doc_id": metadatas[i]["doc_id"],
                            "page": metadatas[i]["page"],
                            "chunk_index": metadatas[i]["chunk_index"],
                            "department": metadatas[i].get("department", "General"),
                            "similarity": similarity,
                        })
        except Exception:
            pass

        # Deduplicate by chunk ID, sort by similarity descending, return top n
        seen_ids = set()
        unique_chunks = []
        for chunk in all_chunks:
            if chunk["id"] not in seen_ids:
                seen_ids.add(chunk["id"])
                unique_chunks.append(chunk)

        unique_chunks.sort(key=lambda x: x["similarity"], reverse=True)
        return unique_chunks[:n_results]

    elif department:
        # Department-scoped query
        target_collection = get_department_collection(department)
        count = target_collection.count()
        if count == 0:
            return []
        results = target_collection.query(
            query_embeddings=[query_embedding],
            n_results=min(n_results, count),
            where=where_clause
        )
    else:
        # Backward compatibility: query default collection
        count = collection.count()
        if count == 0:
            return []
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(n_results, count),
            where=where_clause
        )

    retrieved_chunks = []
    if not results or not results["ids"] or len(results["ids"][0]) == 0:
        return retrieved_chunks

    ids = results["ids"][0]
    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]

    for i in range(len(ids)):
        # Chroma returns L2 distances. Convert to similarity score
        # Cosine similarity approximation: 1 / (1 + distance)
        dist = distances[i]
        similarity = round((1 / (1 + dist)) * 100, 1)

        retrieved_chunks.append(
            {
                "id": ids[i],
                "text": documents[i],
                "filename": metadatas[i]["filename"],
                "doc_id": metadatas[i]["doc_id"],
                "page": metadatas[i]["page"],
                "chunk_index": metadatas[i]["chunk_index"],
                "department": metadatas[i].get("department", department or "General"),
                "similarity": similarity,
            }
        )

    return retrieved_chunks


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
