#!/usr/bin/env python3
"""
Document Generation Utilities
Helper functions for generating development automation documents
"""

import os
import re
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime


def ensure_docs_dir(project_root: str) -> Path:
    """Ensure docs directory structure exists"""
    docs_dir = Path(project_root) / "docs"
    docs_dir.mkdir(exist_ok=True)
    
    # Create subdirectories
    (docs_dir / "plans").mkdir(exist_ok=True)
    (docs_dir / "specs").mkdir(exist_ok=True)
    (docs_dir / "statements").mkdir(exist_ok=True)
    
    return docs_dir


def read_requirements(project_root: str) -> str:
    """Read requirements.md file"""
    req_path = Path(project_root) / "docs" / "requirements.md"
    if not req_path.exists():
        raise FileNotFoundError(f"requirements.md not found at {req_path}")
    
    return req_path.read_text()


def write_document(content: str, output_path: str) -> None:
    """Write content to document file"""
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(content)
    print(f"✅ Generated: {output_path}")


def extract_pages_from_prd(prd_content: str) -> List[str]:
    """
    Extract page names from PRD content
    This is a simple heuristic - look for patterns like:
    - ### Page: HomePage
    - ## HomePage
    - Route: /home
    """
    pages = []
    
    # Look for common patterns
    patterns = [
        r'###\s+Page:\s+(\w+)',
        r'##\s+(\w+)\s+Page',
        r'Route:\s+/(\w+)',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, prd_content, re.IGNORECASE)
        pages.extend(matches)
    
    # Remove duplicates and clean up
    pages = list(set([p.strip() for p in pages if p.strip()]))
    
    return pages


def generate_filename(page_name: str, doc_type: str) -> str:
    """
    Generate standardized filename
    
    Args:
        page_name: Name of the page (e.g., "HomePage" or "Home")
        doc_type: Type of document ("plan", "spec", "statement")
    
    Returns:
        Filename like "home-page-plan.md"
    """
    # Convert CamelCase to kebab-case
    name = re.sub('(.)([A-Z][a-z]+)', r'\1-\2', page_name)
    name = re.sub('([a-z0-9])([A-Z])', r'\1-\2', name).lower()
    
    return f"{name}-{doc_type}.md"


def get_timestamp() -> str:
    """Get current timestamp for documentation"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def list_implementation_files(src_dir: str, page_name: str) -> List[str]:
    """
    List implementation files for a page
    
    Args:
        src_dir: Source directory (e.g., "app" or "src")
        page_name: Page name to search for
    
    Returns:
        List of file paths
    """
    files = []
    src_path = Path(src_dir)
    
    if not src_path.exists():
        return files
    
    # Search for files related to page
    page_pattern = page_name.lower().replace(' ', '-')
    
    for file_path in src_path.rglob("*"):
        if file_path.is_file():
            if page_pattern in str(file_path).lower():
                files.append(str(file_path))
    
    return files


def check_file_exists(file_path: str) -> bool:
    """Check if a file exists"""
    return Path(file_path).exists()


def read_template(template_name: str, skill_dir: str) -> str:
    """Read a template file from references directory"""
    template_path = Path(skill_dir) / "references" / f"{template_name}_template.md"
    
    if not template_path.exists():
        raise FileNotFoundError(f"Template not found: {template_path}")
    
    return template_path.read_text()


# Example usage functions that Claude can reference

def example_generate_prd():
    """Example of how to generate PRD"""
    print("""
    To generate a PRD:
    1. Read requirements.md
    2. Use the prd_template.md as structure
    3. Fill in:
       - Product overview from requirements
       - Extract user goals and features
       - Define success metrics
       - Map features to priorities
       - Document technical constraints
    4. Save to docs/prd.md
    """)


def example_generate_database():
    """Example of how to generate database design"""
    print("""
    To generate database design:
    1. Read requirements.md and prd.md
    2. Use the database_template.md as structure
    3. Identify entities from features
    4. Define relationships
    5. Create ERD with Mermaid syntax
    6. Define schemas with TypeScript interfaces
    7. Add indexes and constraints
    8. Save to docs/database.md
    """)


def example_generate_userflow():
    """Example of how to generate user flow"""
    print("""
    To generate user flow:
    1. Read requirements.md and prd.md
    2. Use the userflow_template.md as structure
    3. Map user stories to flows
    4. Create flow diagrams with Mermaid
    5. Document decision points
    6. Add error handling flows
    7. Save to docs/userflow.md
    """)


if __name__ == "__main__":
    print("Dev Automation Document Utilities")
    print("==================================")
    print("")
    print("This module provides utility functions for document generation.")
    print("Import these functions in your automation scripts.")
    print("")
    print("Example functions:")
    example_generate_prd()
    example_generate_database()
    example_generate_userflow()
