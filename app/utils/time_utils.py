"""Utilities for presenting UTC database timestamps in the host timezone."""

from datetime import datetime, timezone
from typing import Optional


def utc_to_host_datetime(value: Optional[datetime]) -> Optional[datetime]:
    """Convert a database UTC datetime to a naive host-local datetime."""
    if value is None:
        return None

    aware_value = value
    if aware_value.tzinfo is None:
        aware_value = aware_value.replace(tzinfo=timezone.utc)

    return aware_value.astimezone().replace(tzinfo=None)


def utc_to_host_iso(value: Optional[datetime]) -> Optional[str]:
    """Return host-local ISO text without an offset so the UI shows host clock time."""
    local_value = utc_to_host_datetime(value)
    return local_value.isoformat() if local_value else None


def format_utc_as_host(value: Optional[datetime], fmt: str = '%Y-%m-%d %H:%M:%S') -> Optional[str]:
    """Format a database UTC datetime using the host's timezone."""
    local_value = utc_to_host_datetime(value)
    return local_value.strftime(fmt) if local_value else None
