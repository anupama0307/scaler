"""
embedder.py
-----------
Uses Google Gemini API for embeddings.
Model: models/text-embedding-004
Dimension: 768
Requires: GEMINI_API_KEY in environment
"""

from math import ceil
from typing import List
import os
import time
import google.generativeai as genai
from dotenv import load_dotenv

# Load env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env.local'))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../.env.local'))
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_GENERATIVE_AI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

MODEL_NAME = "models/gemini-embedding-001"
EMBEDDING_DIM = 768
BATCH_SIZE = 20  # Gemini allows up to 100 per batch
COST_PER_MILLION_TOKENS = 0.0  # free tier


def _encode_batch(texts: List[str]) -> List[List[float]]:
    """Embed a single batch using Gemini embed_content."""
    result = genai.embed_content(
        model=MODEL_NAME,
        content=texts,
        task_type="retrieval_document",
    )
    return result["embedding"] if len(texts) == 1 else result["embedding"]


def embed_documents(texts: List[str]) -> List[List[float]]:
    if not texts:
        return []

    n_batches = ceil(len(texts) / BATCH_SIZE)
    total_tokens = sum(len(t) // 4 for t in texts)

    print(
        f"[Embedder] Embedding {len(texts)} document(s) in {n_batches} batch(es). "
        f"~{total_tokens:,} tokens | Gemini text-embedding-004."
    )

    all_embeddings: List[List[float]] = []
    for i in range(n_batches):
        batch = texts[i * BATCH_SIZE: (i + 1) * BATCH_SIZE]
        print(f"  Batch {i + 1}/{n_batches}: {len(batch)} text(s)...")
        try:
            if len(batch) == 1:
                result = genai.embed_content(
                    model=MODEL_NAME,
                    content=batch[0],
                    task_type="retrieval_document",
                )
                all_embeddings.append(result["embedding"])
            else:
                for text in batch:
                    result = genai.embed_content(
                        model=MODEL_NAME,
                        content=text,
                        task_type="retrieval_document",
                    )
                    all_embeddings.append(result["embedding"])
                    time.sleep(0.1)  # avoid rate limit
        except Exception as e:
            print(f"  [ERROR] Batch {i+1} failed: {e}")
            raise

    print(f"[Embedder] Done. {len(all_embeddings)} embedding(s) (dim={EMBEDDING_DIM}).")
    return all_embeddings


def embed_query(text: str) -> List[float]:
    print(f"[Embedder] Embedding query with Gemini...")
    result = genai.embed_content(
        model=MODEL_NAME,
        content=text,
        task_type="retrieval_query",
    )
    return result["embedding"]


if __name__ == "__main__":
    sample_texts = ["Hello, I am Anupama Nair.", "I am a CS student at Amrita."]
    vecs = embed_documents(sample_texts)
    print(f"Produced {len(vecs)} vectors of dimension {len(vecs[0])}.")