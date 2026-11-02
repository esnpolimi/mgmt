def safe_text(value):
    """Prefix an apostrophe to strings Excel/Sheets would run as a formula (OWASP CSV injection)."""
    if isinstance(value, str) and value[:1] in ('=', '+', '-', '@', '\t', '\r'):
        return "'" + value
    return value
