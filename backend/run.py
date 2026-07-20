import os
import sys
import subprocess

if __name__ == "__main__":
    # Ensure current dir is on path
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    
    print("Starting Intradoc AI Django Backend Server on http://localhost:8001 ...")
    
    # Get the absolute path to the venv Python executable
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    venv_python = os.path.join(backend_dir, "venv", "bin", "python")
    
    # Start Django using the venv Python
    os.system(f"{venv_python} manage.py runserver 0.0.0.0:8001")
