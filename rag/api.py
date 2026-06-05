"""
api.py
------
FastAPI application exposing the persona RAG pipeline over HTTP.

Endpoints:
    GET  /health    — health check + document count
    POST /retrieve  — retrieve relevant context chunks for a query

Run with:
    uvicorn api:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Load environment variables before any module-level imports that need them
# ---------------------------------------------------------------------------
_root = Path(__file__).parent.parent
for _env_name in (".env.local", ".env"):
    _env_path = _root / _env_name
    if _env_path.exists():
        load_dotenv(str(_env_path))
        print(f"[API] Loaded env from: {_env_path}")
        break
else:
    print("[API] No .env.local or .env found. Using existing env vars.")


# Lazy imports so env vars are available when these modules initialise
import chroma_store
import retriever


# ---------------------------------------------------------------------------
# Lifespan: warm up the Chroma collection on startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        count = chroma_store.get_collection_count()
        print(f"[API] Chroma collection ready — {count} document(s).")
    except Exception as exc:
        print(f"[API] Warning: Could not connect to Chroma on startup: {exc}")
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Anupama Nair — Persona RAG API",
    description=(
        "Retrieval-Augmented Generation API for the Anupama Nair AI persona. "
        "Backs the Scaler AI Engineer Intern application chatbot."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins (required for Vercel frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------
class RetrieveRequest(BaseModel):
    query: str = Field(..., min_length=1, description="The search query or question.")
    top_k: int = Field(5, ge=1, le=20, description="Number of chunks to return (1–20).")


class ChunkResponse(BaseModel):
    content: str
    metadata: dict
    score: float


class RetrieveResponse(BaseModel):
    chunks: list[ChunkResponse]


class HealthResponse(BaseModel):
    status: str
    doc_count: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse, summary="Health check")
async def health() -> HealthResponse:
    """
    Return API status and the number of documents currently in the Chroma store.
    """
    try:
        doc_count = chroma_store.get_collection_count()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Chroma unavailable: {exc}")
    return HealthResponse(status="ok", doc_count=doc_count)


@app.post("/retrieve", response_model=RetrieveResponse, summary="Retrieve context chunks")
async def retrieve_endpoint(body: RetrieveRequest) -> RetrieveResponse:
    """
    Embed the query and return the top-k most relevant chunks from the vector store.
    """
    try:
        chunks = retriever.retrieve(query=body.query, top_k=body.top_k)
    except EnvironmentError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Retrieval error: {exc}")

    return RetrieveResponse(
        chunks=[
            ChunkResponse(
                content=c["content"],
                metadata=c["metadata"],
                score=c["score"],
            )
            for c in chunks
        ]
    )


# ---------------------------------------------------------------------------
# Dev entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
