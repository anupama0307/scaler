"""
retriever.py
------------
Retrieves relevant context chunks from the Chroma vector store.
Exports `retrieve` and `format_context` for use by the API and other modules.
"""

from __future__ import annotations

import embedder
import chroma_store


def retrieve(query: str, top_k: int = 5) -> list[dict]:
    """
    Embed the query and return the top-k most similar chunks from the store.

    Parameters
    ----------
    query : str
        The natural-language question or search query.
    top_k : int
        Number of chunks to return (default 5).

    Returns
    -------
    list[dict]
        Each dict contains: content (str), metadata (dict), score (float).
    """
    print(f"[Retriever] Retrieving top-{top_k} chunks for query: {query!r}")
    query_embedding = embedder.embed_query(query)
    chunks = chroma_store.search(query_embedding, top_k=top_k)
    print(f"[Retriever] Retrieved {len(chunks)} chunk(s).")
    return chunks


def format_context(chunks: list[dict]) -> str:
    """
    Format retrieved chunks into a numbered context block string.

    Each chunk is labelled with its source (resume section / GitHub repo + path).

    Parameters
    ----------
    chunks : list[dict]
        Output from `retrieve()` — each has content, metadata, score.

    Returns
    -------
    str
        A formatted multi-line string ready for injection into a prompt.
    """
    if not chunks:
        return "(No relevant context found.)"

    parts: list[str] = []
    for i, chunk in enumerate(chunks, start=1):
        meta = chunk.get("metadata", {})
        source = meta.get("source", "unknown")

        if source == "resume":
            label = f"[Resume — {meta.get('section', 'unknown section')}]"
        elif source == "github":
            repo = meta.get("repo", "unknown repo")
            file_path = meta.get("file_path", "")
            label = f"[GitHub — {repo}/{file_path}]" if file_path else f"[GitHub — {repo}]"
        elif source == "persona":
            label = f"[Persona KB — {meta.get('section', 'info')}]"
        else:
            label = f"[{source}]"

        score = chunk.get("score", 0.0)
        content = chunk.get("content", "").strip()

        parts.append(
            f"--- Context {i} {label} (score: {score:.4f}) ---\n{content}"
        )

    return "\n\n".join(parts)


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv("../.env.local")

    test_query = "What projects has Anupama worked on?"
    results = retrieve(test_query, top_k=3)
    print("\n" + format_context(results))
