import hashlib
import uuid

_NAMESPACE = uuid.UUID("6f1d4c1e-2b7a-4d8e-9a51-3c0f5e7b9d20")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def document_id_for(sha256: str) -> str:
    """Deterministic id: re-ingesting the same file replaces it instead of duplicating it."""
    return f"doc_{sha256[:16]}"


def chunk_id_for(document_id: str, index: int) -> str:
    return f"{document_id}_c{index:04d}"


def point_id_for(chunk_id: str) -> str:
    """Qdrant point ids must be UUIDs or integers."""
    return str(uuid.uuid5(_NAMESPACE, chunk_id))
