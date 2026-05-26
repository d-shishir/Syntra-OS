import uvicorn
import sys
import os

if __name__ == "__main__":
    # Add root folder to sys.path to allow imports from /modules
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    
    # Run uvicorn and watch backend and modules directories
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["app", "../modules"]
    )
