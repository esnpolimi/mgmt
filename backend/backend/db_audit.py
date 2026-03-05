import json
import logging
from pathlib import Path
from threading import local
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models.signals import m2m_changed, post_delete, post_save, pre_save
from django.utils import timezone

from backend.middleware.db_audit_request import get_audit_actor_context


_state = local()
_signals_connected = False

# Placeholder written in place of redacted field values.
_REDACTED = "**REDACTED**"

# Default field names always replaced with _REDACTED.
# Override via settings.DB_AUDIT_REDACT_FIELDS.
_DEFAULT_REDACT_FIELDS: frozenset[str] = frozenset({
    "password", "token", "secret", "api_key", "access_token", "refresh_token",
})

# Default per-model field allowlists (empty = no allowlist filtering).
# Override via settings.DB_AUDIT_ALLOWLIST_BY_MODEL.
_DEFAULT_ALLOWLIST_BY_MODEL: dict = {}

# Default list of models to skip entirely (e.g. "app_label.ModelName").
# Override via settings.DB_AUDIT_SKIP_MODELS.
_DEFAULT_SKIP_MODELS: list[str] = []

# Only audit models belonging to these app labels; all others (sessions, tokens,
# content types, auth internals, etc.) are ignored to avoid spurious extra queries.
_AUDITED_APP_LABELS: frozenset[str] = frozenset({
    "content",
    "events",
    "profiles",
    "treasury",
    "users",
})


def _get_audit_logger() -> logging.Logger:
    logger = logging.getLogger("db_audit")
    if getattr(logger, "_db_audit_configured", False):
        return logger

    audit_file = getattr(settings, "DB_AUDIT_LOG_FILE", None)
    log_path = Path(audit_file) if audit_file else Path(settings.BASE_DIR) / "logs" / "db_audit.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    handler = logging.FileHandler(log_path, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(message)s"))

    logger.setLevel(logging.INFO)
    logger.propagate = False
    logger.addHandler(handler)
    logger._db_audit_configured = True
    return logger


def _get_cache() -> dict:
    cache = getattr(_state, "pre_save_cache", None)
    if cache is None:
        cache = {}
        _state.pre_save_cache = cache
    return cache


def _cache_key(instance) -> str:
    return f"{instance._meta.label}:{instance.pk}:{id(instance)}"


def _should_skip_model(sender) -> bool:
    """Return True if this model should be excluded from audit logging entirely."""
    # Model-level opt-out via class attribute
    if getattr(sender, "__audit_skip__", False):
        return True
    # Settings-level skip list (list/set of "app_label.ModelName" strings)
    skip_models: set[str] = set(getattr(settings, "DB_AUDIT_SKIP_MODELS", _DEFAULT_SKIP_MODELS))
    return sender._meta.label in skip_models


def _serialize_instance(instance) -> dict:
    """Serialize concrete fields, applying redaction rules from settings."""
    sender = type(instance)
    model_label = sender._meta.label

    # Fields whose values are always replaced with a placeholder
    redact_fields: set[str] = set(getattr(settings, "DB_AUDIT_REDACT_FIELDS", _DEFAULT_REDACT_FIELDS))

    # Per-model allowlist: if present, only listed fields are kept; all others are redacted
    allowlist_by_model: dict[str, list[str]] = getattr(settings, "DB_AUDIT_ALLOWLIST_BY_MODEL", _DEFAULT_ALLOWLIST_BY_MODEL)
    allowed_fields: set[str] | None = (
        set(allowlist_by_model[model_label]) if model_label in allowlist_by_model else None
    )

    values = {}
    for field in instance._meta.concrete_fields:
        name = field.name
        if name in redact_fields or (allowed_fields is not None and name not in allowed_fields):
            values[name] = _REDACTED
        else:
            values[name] = getattr(instance, field.attname)
    return values


def _write_event(payload: dict) -> None:
    try:
        timezone_name = getattr(settings, "DB_AUDIT_TIMEZONE", "Europe/Rome")
        try:
            tz = ZoneInfo(timezone_name)
        except Exception as e:
            logging.warning("Invalid DB_AUDIT_TIMEZONE '%s': %s. Falling back to UTC.", timezone_name, e)
            tz = timezone.utc
        event_time = timezone.now().astimezone(tz).isoformat()

        entry = {
            "timestamp": event_time,
            "actor": get_audit_actor_context(),
            **payload,
        }
        _get_audit_logger().info(json.dumps(entry, cls=DjangoJSONEncoder, ensure_ascii=False))
    except Exception:  # noqa: BLE001
        try:
            _get_audit_logger().exception("db_audit: _write_event failed; audit entry dropped")
        except Exception:  # noqa: BLE001
            logging.exception("db_audit: _write_event failed; audit entry dropped")


def _on_pre_save(sender, instance, **kwargs):
    if sender._meta.app_label not in _AUDITED_APP_LABELS or _should_skip_model(sender):
        return
    if kwargs.get("raw") or instance.pk is None or instance._state.adding:
        return

    previous = sender._default_manager.filter(pk=instance.pk).first()
    if previous is None:
        return

    _get_cache()[_cache_key(instance)] = _serialize_instance(previous)


def _on_post_save(sender, instance, created, **kwargs):
    if sender._meta.app_label not in _AUDITED_APP_LABELS or _should_skip_model(sender):
        return
    if kwargs.get("raw"):
        return

    current_values = _serialize_instance(instance)

    if created:
        _write_event(
            {
                "action": "create",
                "model": instance._meta.label,
                "pk": instance.pk,
                "values": current_values,
            }
        )
        return

    previous_values = _get_cache().pop(_cache_key(instance), None)
    if previous_values is None:
        return

    changes = {}
    for field_name, new_value in current_values.items():
        old_value = previous_values.get(field_name)
        if old_value != new_value:
            changes[field_name] = {
                "old": old_value,
                "new": new_value,
            }

    if not changes:
        return

    _write_event(
        {
            "action": "update",
            "model": instance._meta.label,
            "pk": instance.pk,
            "changes": changes,
        }
    )


def _on_post_delete(sender, instance, **kwargs):
    if sender._meta.app_label not in _AUDITED_APP_LABELS or _should_skip_model(sender):
        return
    _write_event(
        {
            "action": "delete",
            "model": instance._meta.label,
            "pk": instance.pk,
            "values": _serialize_instance(instance),
        }
    )


def _on_m2m_changed(sender, instance, action, reverse, model, pk_set, **kwargs):
    if instance._meta.app_label not in _AUDITED_APP_LABELS or _should_skip_model(type(instance)):
        return
    if action not in {"post_add", "post_remove", "post_clear"}:
        return

    _write_event(
        {
            "action": "m2m_change",
            "model": instance._meta.label,
            "pk": instance.pk,
            "relation": sender._meta.label,
            "operation": action,
            "reverse": reverse,
            "related_model": model._meta.label,
            "related_pks": sorted(list(pk_set)) if pk_set else [],
        }
    )


def setup_db_audit() -> None:
    global _signals_connected
    if _signals_connected:
        return

    pre_save.connect(_on_pre_save, dispatch_uid="db_audit_pre_save", weak=False)
    post_save.connect(_on_post_save, dispatch_uid="db_audit_post_save", weak=False)
    post_delete.connect(_on_post_delete, dispatch_uid="db_audit_post_delete", weak=False)
    m2m_changed.connect(_on_m2m_changed, dispatch_uid="db_audit_m2m_changed", weak=False)

    _signals_connected = True
