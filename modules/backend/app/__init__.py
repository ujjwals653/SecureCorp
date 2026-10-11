"""
SecureCorp Backend — Flask application factory.
"""

from flask import Flask
from flask_cors import CORS

from .database import init_db
from .routes.auth_routes import auth_bp
from .routes.keys_routes import keys_bp
from .routes.files_routes import files_bp
from .routes.ids_routes import ids_bp


def create_app():
    app = Flask(__name__)
    CORS(app)

    # Initialise the SQLite database
    init_db()

    # Register blueprints under /api prefix
    app.register_blueprint(auth_bp,   url_prefix="/api/auth")
    app.register_blueprint(keys_bp,   url_prefix="/api/keys")
    app.register_blueprint(files_bp,  url_prefix="/api/files")
    app.register_blueprint(ids_bp,    url_prefix="/api/ids")

    return app
