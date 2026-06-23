"""
github_scraper.py
-----------------
Scrapes GitHub repositories and returns LangChain Document objects for RAG ingestion.
Reads GITHUB_REPOS env var (comma-separated owner/repo strings).
"""

import base64
import os
from typing import Optional

import requests
from langchain_core.documents import Document

# Default repos for Anupama Nair (used only if GITHUB_REPOS env var is unset)
DEFAULT_REPOS = [
    "anupama0307/cheff",
    "anupama0307/LeafLift",
    "anupama0307/Debuggers",
    "anupama0307/Gemini_hackathon",
    "anupama0307/axiom",
    "anupama0307/AIntStopping",
]

GITHUB_API_BASE = "https://api.github.com"
ALLOWED_EXTENSIONS = {".py", ".ts", ".js", ".md"}
MAX_FILE_SIZE_BYTES = 50 * 1024  # 50 KB


def _get_headers() -> dict:
    """Build request headers, using auth token if available."""
    headers = {"Accept": "application/vnd.github+json"}
    token = os.environ.get("GITHUB_TOKEN", "")
    # Skip if token is empty or still the placeholder value
    if token and not token.startswith("ghp_...") and token != "ghp_...":
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _get(url: str, headers: dict) -> Optional[requests.Response]:
    """Perform a GET request, returning None on 404."""
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code == 404:
            print(f"  [SKIP] 404 Not Found: {url}")
            return None
        resp.raise_for_status()
        return resp
    except requests.exceptions.RequestException as exc:
        print(f"  [ERROR] Request failed for {url}: {exc}")
        return None


def _decode_base64_content(encoded: str) -> str:
    """Decode base64-encoded GitHub file content."""
    return base64.b64decode(encoded).decode("utf-8", errors="replace")


def _fetch_repo_metadata(owner: str, repo: str, headers: dict) -> Optional[dict]:
    """Fetch repository metadata from GitHub API."""
    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}"
    resp = _get(url, headers)
    if resp is None:
        return None
    data = resp.json()
    return {
        "name": data.get("name", repo),
        "description": data.get("description") or "",
        "topics": ", ".join(data.get("topics", [])),
        "homepage": data.get("homepage") or "",
        "language": data.get("language") or "",
        "html_url": data.get("html_url", f"https://github.com/{owner}/{repo}"),
    }


def _fetch_readme(owner: str, repo: str, headers: dict) -> Optional[Document]:
    """Fetch and decode the repository README."""
    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/readme"
    resp = _get(url, headers)
    if resp is None:
        return None
    data = resp.json()
    content = _decode_base64_content(data.get("content", ""))
    file_path = data.get("path", "README.md")
    html_url = data.get("html_url", f"https://github.com/{owner}/{repo}/blob/main/{file_path}")
    return Document(
        page_content=content,
        metadata={
            "source": "github",
            "repo": f"{owner}/{repo}",
            "file_type": "readme",
            "file_path": file_path,
            "url": html_url,
        },
    )


def _fetch_top_level_files(owner: str, repo: str, headers: dict) -> list[Document]:
    """Fetch top-level .py/.ts/.js/.md files under 50 KB."""
    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/contents"
    resp = _get(url, headers)
    if resp is None:
        return []

    docs: list[Document] = []
    items = resp.json()
    if not isinstance(items, list):
        print(f"  [WARN] Unexpected contents response for {owner}/{repo}")
        return []

    for item in items:
        if item.get("type") != "file":
            continue

        name: str = item.get("name", "")
        _, ext = os.path.splitext(name.lower())
        if ext not in ALLOWED_EXTENSIONS:
            continue

        size: int = item.get("size", 0)
        if size > MAX_FILE_SIZE_BYTES:
            print(f"  [SKIP] File too large ({size} bytes): {name}")
            continue

        file_url: str = item.get("url", "")
        html_url: str = item.get("html_url", "")
        print(f"    Fetching file: {name} ({size} bytes)")

        file_resp = _get(file_url, headers)
        if file_resp is None:
            continue

        file_data = file_resp.json()
        raw_content = file_data.get("content", "")
        if not raw_content:
            continue

        content = _decode_base64_content(raw_content)
        docs.append(
            Document(
                page_content=content,
                metadata={
                    "source": "github",
                    "repo": f"{owner}/{repo}",
                    "file_type": ext.lstrip("."),
                    "file_path": item.get("path", name),
                    "url": html_url,
                },
            )
        )

    return docs


def scrape_github_repos() -> list[Document]:
    """
    Scrape GitHub repositories and return a list of LangChain Documents.

    Reads GITHUB_REPOS env var (comma-separated owner/repo strings).
    Falls back to DEFAULT_REPOS if not set.
    """
    raw = os.environ.get("GITHUB_REPOS", "")
    if raw.strip():
        repo_list = [r.strip() for r in raw.split(",") if r.strip()]
    else:
        repo_list = DEFAULT_REPOS

    headers = _get_headers()
    all_docs: list[Document] = []

    for repo_slug in repo_list:
        parts = repo_slug.split("/")
        if len(parts) != 2:
            print(f"[WARN] Invalid repo format (expected owner/repo): {repo_slug}")
            continue

        owner, repo = parts[0], parts[1]
        print(f"\n[GitHub] Scraping repo: {owner}/{repo}")

        # Fetch metadata
        meta = _fetch_repo_metadata(owner, repo, headers)
        if meta is None:
            print(f"  [SKIP] Could not fetch metadata for {owner}/{repo}")
            continue

        # Create a metadata summary document
        meta_text = (
            f"Repository: {owner}/{repo}\n"
            f"Name: {meta['name']}\n"
            f"Description: {meta['description']}\n"
            f"Topics: {meta['topics']}\n"
            f"Homepage: {meta['homepage']}\n"
            f"Primary Language: {meta['language']}\n"
            f"URL: {meta['html_url']}"
        )
        all_docs.append(
            Document(
                page_content=meta_text,
                metadata={
                    "source": "github",
                    "repo": f"{owner}/{repo}",
                    "file_type": "metadata",
                    "file_path": "",
                    "url": meta["html_url"],
                },
            )
        )
        print(f"  Added repo metadata doc.")

        # Fetch README
        readme_doc = _fetch_readme(owner, repo, headers)
        if readme_doc:
            all_docs.append(readme_doc)
            print(f"  Added README doc ({len(readme_doc.page_content)} chars).")
        else:
            print(f"  No README found.")

        # Fetch top-level source files
        file_docs = _fetch_top_level_files(owner, repo, headers)
        all_docs.extend(file_docs)
        print(f"  Added {len(file_docs)} source file doc(s).")

    print(f"\n[GitHub] Total documents scraped: {len(all_docs)}")
    return all_docs


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv("../.env.local")
    docs = scrape_github_repos()
    for d in docs:
        print(f"  [{d.metadata['repo']}] {d.metadata['file_path']} — {len(d.page_content)} chars")
