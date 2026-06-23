"""
ingest.py
---------
CLI script to ingest data into the persona RAG pipeline.

Usage:
    python ingest.py [--repos owner/repo,...] [--resume path/to/resume.pdf]
                     [--skip-github] [--skip-resume] [--dry-run]
"""

import argparse
import os
import sys
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.documents import Document

# ---------------------------------------------------------------------------
# Hardcoded persona knowledge base — ensures RAG works without a PDF upload
# ---------------------------------------------------------------------------
PERSONA_DOCS: list[Document] = [
    Document(
        page_content=(
            "Name: Anupama Nair\n"
            "Email: anupamanairmail@gmail.com\n"
            "LinkedIn: https://www.linkedin.com/in/anupama-vinod-nair\n"
            "GitHub: https://github.com/anupama0307\n"
            "Interests: AI engineering, machine learning, and building intelligent systems\n"
            "I am a Computer Science student passionate about machine learning, "
            "AI engineering, and building intelligent systems."
        ),
        metadata={"source": "persona", "section": "CONTACT"},
    ),
    Document(
        page_content=(
            "Education:\n"
            "Institution: Amrita Vishwa Vidyapeetham\n"
            "Degree: B.Tech in Computer Science and Engineering\n"
            "Duration: 2023 – 2027\n"
            "CGPA: 8.47\n"
            "Anupama is currently pursuing her undergraduate degree at Amrita Vishwa Vidyapeetham, "
            "maintaining a strong academic record with a CGPA of 8.47."
        ),
        metadata={"source": "persona", "section": "EDUCATION"},
    ),
    Document(
        page_content=(
            "Publications:\n"
            "Title: Forest Fire Prediction using Machine Learning\n"
            "Conference: PEIS 2026, NIT Uttarakhand\n"
            "Publisher: Springer\n"
            "Anupama co-authored a research paper on forest fire prediction using machine learning "
            "techniques, presented at PEIS 2026 held at NIT Uttarakhand and published by Springer."
        ),
        metadata={"source": "persona", "section": "PUBLICATIONS"},
    ),
    Document(
        page_content=(
            "Technical Skills:\n"
            "Programming Languages: Java, Python, C, SQL\n"
            "Machine Learning / AI: Scikit-learn, XGBoost, TensorFlow, NumPy, Pandas\n"
            "DevOps / Tools: Docker, Git\n"
            "Anupama is proficient in Python and Java for backend development, has hands-on "
            "experience with ML frameworks including Scikit-learn, XGBoost, and TensorFlow, "
            "and uses Docker and Git for containerisation and version control."
        ),
        metadata={"source": "persona", "section": "SKILLS"},
    ),
    Document(
        page_content=(
            "Projects:\n\n"
            "1. RISKOFF\n"
            "RISKOFF is a risk assessment and decision-support tool built by Anupama. "
            "It leverages ML models to evaluate risk factors and provide actionable insights.\n\n"
            "2. LeafLift\n"
            "LeafLift is a plant health and agriculture AI project. "
            "It uses computer vision and deep learning to detect plant diseases from leaf images, "
            "helping farmers take early corrective action.\n\n"
            "3. GemChef\n"
            "GemChef is an AI-powered recipe recommendation system. "
            "It uses generative AI (Google Gemini) to suggest personalised recipes based on "
            "available ingredients and dietary preferences."
        ),
        metadata={"source": "persona", "section": "PROJECTS"},
    ),
    Document(
        page_content=(
            "Experience:\n"
            "Role: Visteon Scholar (Intern / Research Scholar)\n"
            "Organisation: Visteon Corporation\n"
            "Duration: January 2026 – Present\n"
            "Anupama has been working as a Visteon Scholar since January 2026, gaining industry "
            "exposure in automotive technology, embedded systems, and AI-driven solutions."
        ),
        metadata={"source": "persona", "section": "EXPERIENCE"},
    ),
    Document(
        page_content=(
            "Achievements:\n"
            "Flipkart GRID 7.0 — National Semi-Finalist\n"
            "Anupama reached the national semi-finals of Flipkart GRID 7.0, one of India's most "
            "prestigious engineering and technology competitions, demonstrating her ability to "
            "solve complex real-world problems under competitive conditions."
        ),
        metadata={"source": "persona", "section": "ACHIEVEMENTS"},
    ),
]


def _build_argparser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Ingest data into the Anupama Nair persona RAG pipeline."
    )
    parser.add_argument(
        "--repos",
        type=str,
        default="",
        help="Comma-separated list of GitHub repos (owner/repo). Overrides GITHUB_REPOS env var.",
    )
    parser.add_argument(
        "--resume",
        type=str,
        default="data/resume.pdf",
        help="Path to resume PDF file (default: data/resume.pdf).",
    )
    parser.add_argument(
        "--skip-github",
        action="store_true",
        help="Skip GitHub scraping.",
    )
    parser.add_argument(
        "--skip-resume",
        action="store_true",
        help="Skip resume PDF parsing.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run everything except writing to Chroma.",
    )
    return parser


def _print_summary(all_docs: list[Document], cost: float, dry_run: bool) -> None:
    """Print ingestion summary."""
    source_counts: dict[str, int] = defaultdict(int)
    for doc in all_docs:
        src = doc.metadata.get("source", "unknown")
        source_counts[src] += 1

    print("\n" + "=" * 60)
    print("INGESTION SUMMARY")
    print("=" * 60)
    print(f"Total documents : {len(all_docs)}")
    for src, count in sorted(source_counts.items()):
        print(f"  {src:<15}: {count} chunk(s)")
    print(f"Estimated cost  : ${cost:.5f}")
    if dry_run:
        print("[DRY RUN] No data was written to Chroma.")
    else:
        print("Data successfully written to Chroma.")
    print("=" * 60)


def main() -> None:
    # Load environment variables — try .env.local first, then .env
    root = Path(__file__).parent.parent
    for env_name in (".env.local", ".env"):
        env_path = root / env_name
        if env_path.exists():
            load_dotenv(str(env_path))
            print(f"[Ingest] Loaded env from: {env_path}")
            break
    else:
        print("[Ingest] No .env.local or .env found, relying on existing env vars.")

    parser = _build_argparser()
    args = parser.parse_args()

    # Override GITHUB_REPOS if --repos provided
    if args.repos.strip():
        os.environ["GITHUB_REPOS"] = args.repos.strip()

    all_docs: list[Document] = []

    # 1. Hardcoded persona knowledge base (always included)
    print(f"\n[Ingest] Adding {len(PERSONA_DOCS)} hardcoded persona knowledge-base document(s).")
    all_docs.extend(PERSONA_DOCS)

    # 2. Scrape GitHub repos
    if not args.skip_github:
        print("\n[Ingest] Step 1: Scraping GitHub repos...")
        from github_scraper import scrape_github_repos
        github_docs = scrape_github_repos()
        all_docs.extend(github_docs)
    else:
        print("\n[Ingest] Skipping GitHub scraping (--skip-github).")

    # 3. Parse resume PDF
    if not args.skip_resume:
        print("\n[Ingest] Step 2: Parsing resume PDF...")
        from resume_parser import parse_resume
        resume_docs = parse_resume(args.resume)
        all_docs.extend(resume_docs)
    else:
        print("\n[Ingest] Skipping resume parsing (--skip-resume).")

    if not all_docs:
        print("[Ingest] No documents to ingest. Exiting.")
        sys.exit(0)

    # 4. Embed all documents
    print(f"\n[Ingest] Step 3: Embedding {len(all_docs)} document(s)...")
    from embedder import embed_documents, COST_PER_MILLION_TOKENS
    texts = [doc.page_content for doc in all_docs]
    total_tokens = sum(len(t) // 4 for t in texts)
    estimated_cost = (total_tokens / 1_000_000) * COST_PER_MILLION_TOKENS

    embeddings = embed_documents(texts)

    # 5. Upsert to Chroma (unless dry run)
    if not args.dry_run:
        print(f"\n[Ingest] Step 4: Upserting to Chroma...")
        from chroma_store import upsert_documents, get_collection_count
        upsert_documents(all_docs, embeddings)
        count = get_collection_count()
        print(f"[Ingest] Chroma collection now has {count} document(s).")
    else:
        print("\n[Ingest] Step 4: Skipping Chroma write (--dry-run).")

    _print_summary(all_docs, estimated_cost, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
