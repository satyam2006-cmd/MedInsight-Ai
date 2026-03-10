import os
import uvicorn
from app.main import app

# This file serves as a root-level entry point for Hugging Face Spaces
# that might be looking for an app.py file by default.

if __name__ == "__main__":
    # Hugging Face usually provides the port in the PORT environment variable
    # Defaulting to 7860 which is the standard Hugging Face port
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
else:
    # This allows the app to be imported by an external uvicorn/gunicorn runner
    # We expose it here so 'uvicorn app:app' works from the root
    main_app = app
