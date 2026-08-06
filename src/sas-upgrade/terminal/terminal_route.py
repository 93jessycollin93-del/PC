"""
SAS WORKSTATION TERMINAL — Flask route.

Paste this into jacky_api.py, next to wherever /dashboard is currently served.
It assumes `app` is already in scope (same assumption control_routes.py makes).

WHY THIS SHAPE: dashboard.html is almost certainly served either via
send_from_directory(SAS_UI_DIR, 'dashboard.html') or via a static folder mapped
to /sas_ui. Find that exact line in jacky_api.py and mirror it here — the two
implementations below cover both common cases. Delete whichever one doesn't
match, keep the one that does.
"""

import os
from flask import send_from_directory

# Adjust this if jacky_api.py already defines a directory constant for sas_ui
# (e.g. SAS_UI_DIR) — reuse that instead of redefining it here.
SAS_UI_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sas_ui')


# ---- OPTION A: matches `send_from_directory(SAS_UI_DIR, 'dashboard.html')` ----
@app.route('/terminal')
def serve_terminal():
    """Serve the SAS Workstation terminal page."""
    return send_from_directory(SAS_UI_DIR, 'terminal.html')


# ---- OPTION B: matches `render_template('dashboard.html')` (Jinja templates) ----
# If jacky_api.py uses render_template instead, replace the route above with:
#
# from flask import render_template
#
# @app.route('/terminal')
# def serve_terminal():
#     return render_template('terminal.html')
#
# ...and place terminal.html in the templates/ folder instead of sas_ui/.
