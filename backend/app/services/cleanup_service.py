"""Cleanup service for temporary artifacts."""

import logging
import os
import time

logger = logging.getLogger(__name__)

def purge_old_exports(export_dir: str, max_age_seconds: int = 3600) -> int:
    """Delete files older than max_age_seconds in export_dir.
    
    Returns the number of deleted files.
    """
    if not os.path.exists(export_dir):
        return 0
    
    count = 0
    now = time.time()
    
    try:
        for filename in os.listdir(export_dir):
            filepath = os.path.join(export_dir, filename)
            if not os.path.isfile(filepath):
                continue
            
            # Check file age
            file_mtime = os.path.getmtime(filepath)
            if now - file_mtime > max_age_seconds:
                try:
                    os.remove(filepath)
                    count += 1
                except OSError as e:
                    logger.warning("Failed to delete old export file %s: %s", filepath, e)
    except Exception as e:
        logger.error("Error during export directory purge: %s", e)
        
    if count > 0:
        logger.info("Purged %d old export file(s) from %s", count, export_dir)
    return count
