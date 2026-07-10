"""
SAS CONTROL ROUTES — "Hands" for the dashboard.

Paste these routes into jacky_api.py (after existing routes).
Each route follows the same pattern as the existing /api/control endpoint.
"""

import json
import os
import subprocess
import threading
from flask import jsonify, request

# ---------------------------------------------------------------------------
# PASTE INTO jacky_api.py — these assume `app`, `core`, `squad_mgr`,
# `assessor`, `config`, and `CONFIG_PATH` are already in scope.
# ---------------------------------------------------------------------------


# ========================== BOT MANAGEMENT ==========================

@app.route('/api/bots/<name>/toggle', methods=['POST'])
def api_bot_toggle(name):
    """Enable or disable a specific bot."""
    if not squad_mgr:
        return jsonify({"error": "squad manager not loaded"}), 503
    bots = squad_mgr.get_bots()
    if name not in bots:
        return jsonify({"error": f"unknown bot: {name}"}), 404
    bots[name]["enabled"] = not bots[name].get("enabled", True)
    squad_mgr.save()
    return jsonify({"bot": name, "enabled": bots[name]["enabled"]})


@app.route('/api/bots/<name>/config', methods=['GET', 'POST'])
def api_bot_config(name):
    """Read or update a bot's configuration."""
    if not squad_mgr:
        return jsonify({"error": "squad manager not loaded"}), 503
    bots = squad_mgr.get_bots()
    if name not in bots:
        return jsonify({"error": f"unknown bot: {name}"}), 404
    if request.method == 'GET':
        return jsonify(bots[name])
    updates = request.get_json(silent=True) or {}
    for key in ("role", "model", "system_prompt", "temperature"):
        if key in updates:
            bots[name][key] = updates[key]
    squad_mgr.save()
    return jsonify({"bot": name, "updated": list(updates.keys())})


# ========================== MODEL CONTROL ==========================

@app.route('/api/models', methods=['GET'])
def api_models_list():
    """List all Ollama models available locally."""
    try:
        import urllib.request
        req = urllib.request.Request("http://localhost:11434/api/tags")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        models = []
        for m in data.get("models", []):
            models.append({
                "name": m["name"],
                "size": m.get("size", 0),
                "modified": m.get("modified_at", ""),
                "digest": m.get("digest", "")[:12],
            })
        return jsonify({"models": models})
    except Exception:
        return jsonify({"error": "model discovery failed", "models": []}), 503


@app.route('/api/models/select', methods=['POST'])
def api_models_select():
    """Force a specific model for the next N requests (or until cleared)."""
    body = request.get_json(silent=True) or {}
    model = body.get("model")
    duration = body.get("duration", 0)  # 0 = permanent until cleared
    if not model:
        return jsonify({"error": "model required"}), 400
    config = _load_config()
    config["forced_model"] = model
    config["forced_model_duration"] = duration
    _save_config(config)
    return jsonify({"forced_model": model, "duration": duration})


@app.route('/api/models/clear-force', methods=['POST'])
def api_models_clear_force():
    """Clear any forced model override."""
    config = _load_config()
    config.pop("forced_model", None)
    config.pop("forced_model_duration", None)
    _save_config(config)
    return jsonify({"forced_model": None})


@app.route('/api/models/pull', methods=['POST'])
def api_models_pull():
    """Pull a new Ollama model (runs in background)."""
    body = request.get_json(silent=True) or {}
    model = body.get("model")
    if not model:
        return jsonify({"error": "model required"}), 400

    def _pull():
        try:
            import urllib.request
            payload = json.dumps({"name": model}).encode()
            req = urllib.request.Request(
                "http://localhost:11434/api/pull",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            urllib.request.urlopen(req, timeout=600)
        except Exception:
            pass

    threading.Thread(target=_pull, daemon=True).start()
    return jsonify({"status": "pulling", "model": model})


# ========================== CLOUD PROVIDER CONTROL ==========================

@app.route('/api/cloud/priority', methods=['GET', 'POST'])
def api_cloud_priority():
    """Read or reorder the cloud provider priority list."""
    config = _load_config()
    if request.method == 'GET':
        return jsonify({
            "priority": config.get("ai_tier_order", []),
            "providers": config.get("integrations", {}).get("cloud_bots", {}),
        })
    body = request.get_json(silent=True) or {}
    new_order = body.get("priority")
    if new_order and isinstance(new_order, list):
        config["ai_tier_order"] = new_order
        _save_config(config)
    return jsonify({"priority": config["ai_tier_order"]})


@app.route('/api/cloud/<provider>/toggle', methods=['POST'])
def api_cloud_toggle(provider):
    """Enable or disable a specific cloud provider."""
    config = _load_config()
    cloud = config.get("integrations", {}).get("cloud_bots", {})
    if provider not in cloud:
        return jsonify({"error": f"unknown provider: {provider}"}), 404
    cloud[provider]["enabled"] = not cloud[provider].get("enabled", True)
    _save_config(config)
    return jsonify({"provider": provider, "enabled": cloud[provider]["enabled"]})


@app.route('/api/cloud/<provider>/test', methods=['POST'])
def api_cloud_test(provider):
    """Send a test ping to a cloud provider to check connectivity."""
    try:
        from cloud_client import CloudClient
        client = CloudClient(provider)
        result = client.query("Reply with just 'ok'.", max_tokens=5)
        return jsonify({"provider": provider, "status": "ok", "response": result})
    except Exception:
        return jsonify({"provider": provider, "status": "error", "error": "provider test failed"}), 503


# ========================== RESOURCE CONTROLS ==========================

@app.route('/api/resources/limits', methods=['GET', 'POST'])
def api_resource_limits():
    """Read or update CPU/GPU resource limits."""
    config = _load_config()
    limits = config.get("resource_limits", {
        "cpu_cap_percent": 75,
        "gpu_temp_max": 80,
        "burst_enabled": True,
        "burst_cap_percent": 90,
    })
    if request.method == 'GET':
        return jsonify(limits)
    body = request.get_json(silent=True) or {}
    for key in ("cpu_cap_percent", "gpu_temp_max", "burst_enabled", "burst_cap_percent"):
        if key in body:
            limits[key] = body[key]
    config["resource_limits"] = limits
    _save_config(config)
    return jsonify(limits)


# ========================== INTEGRATION TOGGLES ==========================

@app.route('/api/integrations', methods=['GET'])
def api_integrations_list():
    """List all integrations and their status."""
    config = _load_config()
    integrations = config.get("integrations", {})
    result = {}
    for name, cfg in integrations.items():
        result[name] = {
            "enabled": cfg.get("enabled", False),
            "description": cfg.get("description", ""),
        }
    return jsonify(result)


@app.route('/api/integrations/<name>/toggle', methods=['POST'])
def api_integration_toggle(name):
    """Enable or disable an integration."""
    config = _load_config()
    integrations = config.get("integrations", {})
    if name not in integrations:
        return jsonify({"error": f"unknown integration: {name}"}), 404
    integrations[name]["enabled"] = not integrations[name].get("enabled", False)
    _save_config(config)
    return jsonify({"integration": name, "enabled": integrations[name]["enabled"]})


@app.route('/api/integrations/<name>/test', methods=['POST'])
def api_integration_test(name):
    """Test an integration's connectivity."""
    config = _load_config()
    integrations = config.get("integrations", {})
    if name not in integrations:
        return jsonify({"error": f"unknown integration: {name}"}), 404
    cfg = integrations[name]
    if name == "slack":
        try:
            import urllib.request
            webhook = cfg.get("config", {}).get("webhook_url", "")
            if not webhook or "YOUR" in webhook:
                return jsonify({"status": "not_configured"}), 400
            payload = json.dumps({"text": "SAS test ping"}).encode()
            req = urllib.request.Request(webhook, data=payload,
                                         headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=10)
            return jsonify({"status": "ok", "integration": name})
        except Exception:
            return jsonify({"status": "error", "error": "integration test failed"}), 503
    return jsonify({"status": "no_test_available", "integration": name})


# ========================== ROUTING OVERRIDE ==========================

@app.route('/api/routing/override', methods=['GET', 'POST'])
def api_routing_override():
    """Force all requests to go local-only or cloud-only."""
    config = _load_config()
    if request.method == 'GET':
        return jsonify({"override": config.get("routing_override", "auto")})
    body = request.get_json(silent=True) or {}
    mode = body.get("mode", "auto")
    if mode not in ("auto", "local_only", "cloud_only"):
        return jsonify({"error": "mode must be auto, local_only, or cloud_only"}), 400
    config["routing_override"] = mode
    _save_config(config)
    return jsonify({"override": mode})


# ========================== LOG VIEWER ==========================

_LOG_BUFFER = []
_LOG_LOCK = threading.Lock()
_MAX_LOG_ENTRIES = 500


def log_api_call(endpoint, method, status, detail=""):
    """Call this from other routes to record API activity."""
    import time
    entry = {
        "ts": time.strftime("%Y-%m-%d %H:%M:%S"),
        "endpoint": endpoint,
        "method": method,
        "status": status,
        "detail": detail[:200],
    }
    with _LOG_LOCK:
        _LOG_BUFFER.append(entry)
        if len(_LOG_BUFFER) > _MAX_LOG_ENTRIES:
            _LOG_BUFFER.pop(0)


@app.route('/api/logs', methods=['GET'])
def api_logs():
    """Return recent API activity log."""
    severity = request.args.get("severity", "all")
    limit = int(request.args.get("limit", 100))
    with _LOG_LOCK:
        logs = list(_LOG_BUFFER)
    if severity == "error":
        logs = [l for l in logs if l["status"] >= 400]
    return jsonify({"logs": logs[-limit:]})


# ========================== HELPERS ==========================

def _load_config():
    """Load config.json (same pattern as existing code)."""
    try:
        with open(CONFIG_PATH, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_config(config):
    """Write config.json atomically."""
    tmp = CONFIG_PATH + ".tmp"
    with open(tmp, "w") as f:
        json.dump(config, f, indent=2)
    os.replace(tmp, CONFIG_PATH)
