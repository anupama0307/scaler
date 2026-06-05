"""
resume_parser.py
----------------
Parses a PDF resume into LangChain Document objects, one per section.
Sections are detected by keyword scanning. Each section is split into
chunks using RecursiveCharacterTextSplitter.
"""

import os
import re
from typing import Optional

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

try:
    from pypdf import PdfReader
except ImportError:
    raise ImportError("pypdf is required: pip install pypdf")

# Section heading keywords to detect (case-insensitive)
SECTION_KEYWORDS = [
    "SUMMARY",
    "EDUCATION",
    "PUBLICATIONS",
    "SKILLS",
    "PROJECTS",
    "EXPERIENCE",
    "ACHIEVEMENTS",
]

SECTION_PATTERN = re.compile(
    r"^\s*(" + "|".join(SECTION_KEYWORDS) + r")\s*$",
    re.IGNORECASE | re.MULTILINE,
)

CHUNK_SIZE = 600
CHUNK_OVERLAP = 80


def _extract_text_from_pdf(pdf_path: str) -> Optional[str]:
    """Extract full text from a PDF file using pypdf."""
    reader = PdfReader(pdf_path)
    pages_text = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages_text.append(text)
    return "\n".join(pages_text)


def _detect_contact_header(lines: list[str]) -> tuple[str, int]:
    """
    Extract the contact header block from the top of the resume.
    Returns (header_text, last_line_index) — the header spans from
    the first line up to (but not including) the first section keyword.
    """
    header_lines = []
    end_idx = 0
    for i, line in enumerate(lines):
        if SECTION_PATTERN.match(line):
            end_idx = i
            break
        header_lines.append(line)
    else:
        end_idx = len(lines)

    return "\n".join(header_lines).strip(), end_idx


def _split_into_sections(lines: list[str], header_end: int) -> list[tuple[str, str]]:
    """
    Split remaining lines into (section_name, section_text) tuples.
    Returns a list in order of appearance.
    """
    sections: list[tuple[str, str]] = []
    current_section: Optional[str] = None
    current_lines: list[str] = []

    for line in lines[header_end:]:
        match = SECTION_PATTERN.match(line)
        if match:
            if current_section is not None:
                sections.append((current_section, "\n".join(current_lines).strip()))
            current_section = match.group(1).upper()
            current_lines = []
        else:
            current_lines.append(line)

    # Flush the last section
    if current_section is not None:
        sections.append((current_section, "\n".join(current_lines).strip()))

    return sections


def parse_resume(pdf_path: str) -> list[Document]:
    """
    Parse a PDF resume into a list of LangChain Documents.

    - One Document for the contact header.
    - One or more Documents per detected section (chunked at 600 chars / 80 overlap).

    Returns an empty list if the file is not found or cannot be parsed.
    """
    if not os.path.isfile(pdf_path):
        print(f"[WARN] Resume PDF not found: {pdf_path}. Skipping resume parsing.")
        return []

    print(f"[Resume] Parsing PDF: {pdf_path}")
    raw_text = _extract_text_from_pdf(pdf_path)
    if not raw_text:
        print(f"[WARN] No text extracted from PDF: {pdf_path}")
        return []

    lines = raw_text.splitlines()

    # Extract contact header
    header_text, header_end = _detect_contact_header(lines)
    all_docs: list[Document] = []

    if header_text:
        all_docs.append(
            Document(
                page_content=header_text,
                metadata={"source": "resume", "section": "CONTACT"},
            )
        )
        print(f"  Added CONTACT header doc ({len(header_text)} chars).")

    # Split into sections
    sections = _split_into_sections(lines, header_end)
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )

    for section_name, section_text in sections:
        if not section_text:
            continue

        # Create a top-level section document first, then chunk it
        section_doc = Document(
            page_content=f"[{section_name}]\n{section_text}",
            metadata={"source": "resume", "section": section_name},
        )

        chunks = splitter.split_documents([section_doc])
        # Preserve metadata on each chunk
        for chunk in chunks:
            chunk.metadata["source"] = "resume"
            chunk.metadata["section"] = section_name

        all_docs.extend(chunks)
        print(f"  Section '{section_name}': {len(chunks)} chunk(s).")

    print(f"[Resume] Total documents produced: {len(all_docs)}")
    return all_docs


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv("../.env.local")
    docs = parse_resume("data/resume.pdf")
    for d in docs:
        print(f"  [{d.metadata['section']}] {len(d.page_content)} chars")
