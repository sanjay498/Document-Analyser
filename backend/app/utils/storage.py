import os
import shutil
from pathlib import Path
from typing import Union
from app.config import settings

class StorageService:
    def __init__(self, base_dir: str = settings.STORAGE_DIR):
        self.base_dir = Path(base_dir)
        self.templates_dir = self.base_dir / "templates"
        self.sources_dir = self.base_dir / "sources"
        self.generated_dir = self.base_dir / "generated"

        for directory in [self.templates_dir, self.sources_dir, self.generated_dir]:
            directory.mkdir(parents=True, exist_ok=True)

    def save_file(self, content: bytes, category: str, filename: str) -> str:
        target_dir = self.base_dir / category
        target_dir.mkdir(parents=True, exist_ok=True)
        
        # Sanitize filename
        safe_name = Path(filename).name
        target_path = target_dir / safe_name
        
        with open(target_path, "wb") as f:
            f.write(content)
            
        return str(target_path.resolve())

    def get_file_path(self, category: str, filename: str) -> Path:
        return self.base_dir / category / Path(filename).name

    def delete_file(self, file_path: str) -> bool:
        try:
            path = Path(file_path)
            if path.exists():
                path.unlink()
                return True
        except Exception:
            pass
        return False

storage_service = StorageService()
