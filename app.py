"""
Flask application for the roguelike game backend.

Provides a JSON API for game creation, player actions, and state retrieval.
Serves a static frontend from the 'static' folder.
"""

import uuid

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from game.game_state import GameState

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

# In-memory game store: game_id -> GameState
games: dict[str, GameState] = {}


# ---------------------------------------------------------------------------
# Static file serving
# ---------------------------------------------------------------------------

@app.route('/')
def index():
    """Serve the static index.html."""
    return send_from_directory(app.static_folder, 'index.html')


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.route('/api/new-game', methods=['POST'])
def new_game():
    """Create a new game session and return the initial state."""
    game_id = str(uuid.uuid4())
    gs = GameState()
    state = gs.new_game()
    games[game_id] = gs
    return jsonify({'game_id': game_id, **state})


@app.route('/api/action', methods=['POST'])
def action():
    """
    Perform a game action.

    Expects JSON body:
      {
        "game_id": "<uuid>",
        "action": "move" | "wait" | "use_item" | "pickup" | "descend",
        "params": { ... }   // optional, depends on action
      }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400

    game_id = data.get('game_id')
    action_name = data.get('action')
    params = data.get('params', {})

    if not game_id or game_id not in games:
        return jsonify({'error': 'Game not found. Start a new game first.'}), 404

    gs = games[game_id]

    if action_name == 'move':
        dx = int(params.get('dx', 0))
        dy = int(params.get('dy', 0))
        # Clamp to single-tile movement
        dx = max(-1, min(1, dx))
        dy = max(-1, min(1, dy))
        state = gs.move_player(dx, dy)

    elif action_name == 'wait':
        state = gs.wait_turn()

    elif action_name == 'use_item':
        idx = int(params.get('index', 0))
        state = gs.use_item(idx)

    elif action_name == 'pickup':
        state = gs.pickup_item()

    elif action_name == 'descend':
        state = gs.descend()

    else:
        return jsonify({'error': f"Unknown action: {action_name}"}), 400

    return jsonify({'game_id': game_id, **state})


@app.route('/api/state/<game_id>', methods=['GET'])
def get_state(game_id: str):
    """Return the current game state for the given game_id."""
    if game_id not in games:
        return jsonify({'error': 'Game not found.'}), 404

    gs = games[game_id]
    return jsonify({'game_id': game_id, **gs.get_state()})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    app.run(debug=True, port=5000)
