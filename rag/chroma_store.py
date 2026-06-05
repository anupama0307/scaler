"""
chroma_store.py
---------------
Manages a persistent ChromaDB collection for the RAG persona pipeline.
Collection name: persona_rag
Stored at: ./chroma_db (relative to this file's directory)
"""

import hashlib
import os
from pathlib import Path
from typing import Any

import chromadb
from chromadb.config import Settings

# Resolve the chroma_db path relative to this file's directory
_THIS_DIR = Path(__file__).parent.resolve()
CHROMA_DB_PATH = str(_THIS_DIR / "chroma_db")
COLLECTION_NAME = "persona_rag"

_client: chromadb.ClientAPI | None = None
_collection: Any = None


def _get_collection() -> Any:
    """Return (creating if necessary) the persistent Chroma collection."""
    global _client, _collection
    if _collection is not None:
        return _collection

    _client = chromadb.PersistentClient(
        path=CHROMA_DB_PATH,
        settings=Settings(anonymized_telemetry=False),
    )

    try:
        _collection = _client.get_collection(name=COLLECTION_NAME)
        print(f"[Chroma] Opened existing collection '{COLLECTION_NAME}'.")
    except Exception:
        # Collection does not yet exist — create it
        _collection = _client.create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        print(f"[Chroma] Created new collection '{COLLECTION_NAME}'.")

    return _collection


def _doc_id(content: str) -> str:
    """Generate a stable MD5-based ID from document content."""
    return hashlib.md5(content.encode("utf-8")).hexdigest()


def upsert_documents(docs: list, embeddings: list[list[float]]) -> None:
    """
    Upsert documents into the Chroma collection.

    Parameters
    ----------
    docs : list[Document]
        LangChain Document objects.
    embeddings : list[list[float]]
        Pre-computed embeddings aligned with docs.
    """
    if len(docs) != len(embeddings):
        raise ValueError(
            f"Mismatch: {len(docs)} docs vs {len(embeddings)} embeddings."
        )

    collection = _get_collection()

    ids = [_doc_id(doc.page_content) for doc in docs]
    contents = [doc.page_content for doc in docs]
    metadatas = [
        {k: (str(v) if v is not None else "") for k, v in doc.metadata.items()}
        for doc in docs
    ]

    # ChromaDB upsert handles duplicates gracefully
    collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=contents,
        metadatas=metadatas,
    )
    print(f"[Chroma] Upserted {len(ids)} document(s) into '{COLLECTION_NAME}'.")


def search(query_embedding: list[float], top_k: int = 5) -> list[dict]:
    """
    Search the collection for the nearest neighbours of query_embedding.

    Returns
    -------
    list[dict]
        Each dict has keys: content, metadata, score (cosine distance).
    """
    collection = _get_collection()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count() or 1),
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    docs_list = results.get("documents", [[]])[0]
    metas_list = results.get("metadatas", [[]])[0]
    dists_list = results.get("distances", [[]])[0]

    for content, metadata, score in zip(docs_list, metas_list, dists_list):
        chunks.append({"content": content, "metadata": metadata, "score": score})

    return chunks


def get_collection_count() -> int:
    """Return the number of documents currently stored in the collection."""
    collection = _get_collection()
    return collection.count()


if __name__ == "__main__":
    count = get_collection_count()
    print(f"Collection '{COLLECTION_NAME}' has {count} document(s).")
