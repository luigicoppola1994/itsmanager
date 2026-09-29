import os
import sys

# Make the backend modules importable when Vercel loads api/index.py.
backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from main import app

__all__ = ["app"]
