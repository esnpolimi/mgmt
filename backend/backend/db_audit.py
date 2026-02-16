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


def _serialize_instance(instance) -> dict:
    values = {}
    for field in instance._meta.concrete_fields:
        values[field.name] = getattr(instance, field.attname)
    return values


def _write_event(payload: dict) -> None:
    timezone_name = getattr(settings, "DB_AUDIT_TIMEZONE", "Europe/Rome")
    event_time = timezone.now().astimezone(ZoneInfo(timezone_name)).isoformat()

    entry = {
        "timestamp": event_time,
        "actor": get_audit_actor_context(),
        **payload,
    }
    _get_audit_logger().info(json.dumps(entry, cls=DjangoJSONEncoder, ensure_ascii=False))


def _on_pre_save(sender, instance, **kwargs):
    if kwargs.get("raw") or instance.pk is None or instance._state.adding:
        return

    previous = sender._default_manager.filter(pk=instance.pk).first()
    if previous is None:
        return

    _get_cache()[_cache_key(instance)] = _serialize_instance(previous)


def _on_post_save(sender, instance, created, **kwargs):
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
    _write_event(
        {
            "action": "delete",
            "model": instance._meta.label,
            "pk": instance.pk,
            "values": _serialize_instance(instance),
        }
    )


def _on_m2m_changed(sender, instance, action, reverse, model, pk_set, **kwargs):
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
