"""
Main game state manager.

Orchestrates dungeon generation, entity placement, player actions,
enemy AI processing, FOV updates, and state serialization.
"""

import random

from game.dungeon import generate_dungeon, FLOOR, WALL, STAIRS_DOWN, STAIRS_UP, CORRIDOR, DOOR
from game.entities import Player, Enemy, Item
from game.fov import compute_fov
from game.ai import process_enemy_turns

# Passable tiles for player movement
_PLAYER_PASSABLE = {FLOOR, CORRIDOR, STAIRS_DOWN, STAIRS_UP, DOOR}

# Level population templates
# (enemy_type, min_count, max_count)
LEVEL_ENEMIES = {
    1: [('rat', 4, 6), ('skeleton', 2, 3)],
    2: [('skeleton', 3, 4), ('ghost', 3, 4), ('rat', 1, 2)],
    3: [('demon', 2, 3), ('ghost', 3, 4), ('skeleton', 2, 3)],
}

# (item_type, min_count, max_count)
LEVEL_ITEMS = {
    1: [('health_potion', 3, 4), ('attack_scroll', 1, 1), ('defense_scroll', 0, 1), ('gold_pile', 2, 3)],
    2: [('health_potion', 3, 3), ('attack_scroll', 1, 1), ('defense_scroll', 1, 1), ('gold_pile', 2, 4)],
    3: [('health_potion', 4, 4), ('attack_scroll', 1, 2), ('defense_scroll', 1, 1), ('gold_pile', 3, 5)],
}


class GameState:
    """Manages the full game state for a single play session."""

    def __init__(self):
        self.player = Player()
        self.enemies: list[Enemy] = []
        self.items: list[Item] = []
        self.dungeon: dict = {}
        self.current_level: int = 0
        self.messages: list[str] = []
        self.turn_count: int = 0
        self.game_over: bool = False
        self.victory: bool = False
        self.explored: set[tuple[int, int]] = set()
        self.visible: set[tuple[int, int]] = set()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_floor_positions(self) -> list[tuple[int, int]]:
        """Return all walkable floor positions in the dungeon."""
        tiles = self.dungeon['tiles']
        positions = []
        for y in range(self.dungeon['height']):
            for x in range(self.dungeon['width']):
                if tiles[y][x] in (FLOOR, CORRIDOR):
                    positions.append((x, y))
        return positions

    def _get_room_floor_positions(self, room: dict) -> list[tuple[int, int]]:
        """Return floor positions inside a specific room."""
        tiles = self.dungeon['tiles']
        positions = []
        for y in range(room['y'], room['y'] + room['h']):
            for x in range(room['x'], room['x'] + room['w']):
                if 0 <= x < self.dungeon['width'] and 0 <= y < self.dungeon['height']:
                    if tiles[y][x] in _PLAYER_PASSABLE:
                        positions.append((x, y))
        return positions

    def _occupied_positions(self) -> set[tuple[int, int]]:
        """Set of positions occupied by the player or living enemies."""
        occupied = {(self.player.x, self.player.y)}
        for e in self.enemies:
            if e.alive:
                occupied.add((e.x, e.y))
        return occupied

    def _place_entity_in_rooms(
        self, rooms: list[dict], occupied: set[tuple[int, int]]
    ) -> tuple[int, int] | None:
        """Find a random unoccupied floor tile in any of the given rooms."""
        random.shuffle(rooms)
        for room in rooms:
            positions = self._get_room_floor_positions(room)
            free = [p for p in positions if p not in occupied]
            if free:
                pos = random.choice(free)
                occupied.add(pos)
                return pos
        return None

    def _populate_level(self):
        """Spawn enemies and items for the current level."""
        rooms = self.dungeon['rooms']
        occupied = self._occupied_positions()

        # Determine enemy / item templates for this level
        level_key = min(self.current_level, 3)
        enemy_specs = LEVEL_ENEMIES.get(level_key, LEVEL_ENEMIES[3])
        item_specs = LEVEL_ITEMS.get(level_key, LEVEL_ITEMS[3])

        # Spawn enemies (avoid room 0 where the player starts)
        spawn_rooms = rooms[1:] if len(rooms) > 1 else rooms
        for enemy_type, min_count, max_count in enemy_specs:
            count = random.randint(min_count, max_count)
            for _ in range(count):
                pos = self._place_entity_in_rooms(spawn_rooms, occupied)
                if pos:
                    enemy = Enemy(enemy_type, pos[0], pos[1])
                    # Give patrol enemies their waypoints
                    if enemy.behavior == 'patrol':
                        enemy.patrol_points = [
                            (r['x'] + r['w'] // 2, r['y'] + r['h'] // 2)
                            for r in random.sample(rooms, min(3, len(rooms)))
                        ]
                    self.enemies.append(enemy)

        # Spawn items (can be in any room)
        for item_type, min_count, max_count in item_specs:
            count = random.randint(min_count, max_count)
            for _ in range(count):
                pos = self._place_entity_in_rooms(rooms, occupied)
                if pos:
                    item = Item(item_type, pos[0], pos[1])
                    self.items.append(item)

    def _update_fov(self):
        """Recalculate visible tiles and update explored set."""
        self.visible = compute_fov(
            self.dungeon['tiles'],
            self.player.x,
            self.player.y,
            radius=8,
        )
        self.explored |= self.visible

    def _apply_gravity(self, entity) -> bool:
        """
        Apply gravity to an entity (player or enemy).
        Entity falls down until standing on a solid WALL tile or is on a ladder.
        """
        tiles = self.dungeon['tiles']
        height = self.dungeon['height']
        fell = False
        while entity.y + 1 < height:
            below = tiles[entity.y + 1][entity.x]
            current = tiles[entity.y][entity.x]
            # Stand if below is solid
            if below == WALL:
                break
            # Stand if on a ladder/stairs
            if current in (STAIRS_DOWN, STAIRS_UP) or below in (STAIRS_DOWN, STAIRS_UP):
                break
            entity.y += 1
            fell = True
        return fell

    def _add_message(self, msg: str):
        """Append a message, keeping only the last 50."""
        self.messages.append(msg)
        if len(self.messages) > 50:
            self.messages = self.messages[-50:]

    def _enemy_at(self, x: int, y: int) -> Enemy | None:
        """Return the living enemy at (x, y), if any."""
        for e in self.enemies:
            if e.alive and e.x == x and e.y == y:
                return e
        return None

    def _item_at(self, x: int, y: int) -> Item | None:
        """Return the first item at (x, y), if any."""
        for item in self.items:
            if item.x == x and item.y == y:
                return item
        return None

    def _process_enemies(self):
        """Run enemy AI and append resulting messages."""
        if self.game_over:
            return
        msgs = process_enemy_turns(self)
        for m in msgs:
            self._add_message(m)
            
        # Apply gravity to all enemies
        for e in self.enemies:
            if e.alive:
                self._apply_gravity(e)

        if self.player.hp <= 0:
            self.game_over = True

    def _tick_player_buffs(self):
        """Tick down player buffs and report expirations."""
        buff_msgs = self.player.tick_buffs()
        for m in buff_msgs:
            self._add_message(m)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def new_game(self) -> dict:
        """Start a brand-new game on level 1."""
        self.current_level = 1
        self.turn_count = 0
        self.game_over = False
        self.victory = False
        self.messages = []
        self.explored = set()
        self.enemies = []
        self.items = []
        self.player = Player()

        self.dungeon = generate_dungeon(self.current_level)
        rooms = self.dungeon['rooms']

        # Place player in the center of the first room
        first_room = rooms[0]
        self.player.x = first_room['x'] + first_room['w'] // 2
        self.player.y = first_room['y'] + first_room['h'] // 2

        self._populate_level()
        self._update_fov()

        self._add_message("You descend into the dungeon. The air is damp and cold...")
        self._add_message("Level 1 — Find the stairs down (>) to proceed deeper.")

        return self.get_state()

    def move_player(self, dx: int, dy: int) -> dict:
        """
        Move the player by (dx, dy). Handles wall collision and auto-attack.
        Processes enemy turns after the player acts.
        """
        if self.game_over or self.victory:
            return self.get_state()

        nx = self.player.x + dx
        ny = self.player.y + dy
        tiles = self.dungeon['tiles']
        width = self.dungeon['width']
        height = self.dungeon['height']

        # Bounds check
        if nx < 0 or nx >= width or ny < 0 or ny >= height:
            self._add_message("You bump into the edge of the world.")
            return self.get_state()

        # Wall check
        if tiles[ny][nx] == WALL:
            self._add_message("You bump into a cold stone wall.")
            return self.get_state()

        # Enemy collision → auto-attack
        target_enemy = self._enemy_at(nx, ny)
        if target_enemy:
            self._attack_enemy(target_enemy)
            self.turn_count += 1
            self._tick_player_buffs()
            self._process_enemies()
            self._update_fov()
            return self.get_state()

        # Move
        if tiles[ny][nx] not in _PLAYER_PASSABLE:
            self._add_message("You can't move there.")
            return self.get_state()

        self.player.x = nx
        self.player.y = ny
        
        # Apply gravity to player
        fell = self._apply_gravity(self.player)
        if fell:
            self._add_message("You fall down!")
            
        self.turn_count += 1

        # Check for items on the ground
        ground_item = self._item_at(nx, ny)
        if ground_item:
            self._add_message(f"You see a {ground_item.name} on the ground. Press 'g' to pick it up.")

        # Check for stairs
        if tiles[ny][nx] == STAIRS_DOWN:
            self._add_message("You see stairs leading deeper into the dungeon. Press '>' to descend.")
        elif tiles[ny][nx] == STAIRS_UP:
            self._add_message("You see stairs leading up, but there's no going back now.")

        self._tick_player_buffs()
        self._process_enemies()
        self._update_fov()

        return self.get_state()

    def wait_turn(self) -> dict:
        """Skip the player's turn. Enemies still act."""
        if self.game_over or self.victory:
            return self.get_state()

        self.turn_count += 1
        self._add_message("You wait and listen...")
        self._tick_player_buffs()
        self._process_enemies()
        self._update_fov()
        return self.get_state()

    def use_item(self, item_index: int) -> dict:
        """Use an item from the player's inventory."""
        if self.game_over or self.victory:
            return self.get_state()

        success, msgs = self.player.use_item(item_index)
        for m in msgs:
            self._add_message(m)

        if success:
            self.turn_count += 1
            self._tick_player_buffs()
            self._process_enemies()
            self._update_fov()

        return self.get_state()

    def pickup_item(self) -> dict:
        """Pick up an item at the player's position."""
        if self.game_over or self.victory:
            return self.get_state()

        item = self._item_at(self.player.x, self.player.y)
        if item is None:
            self._add_message("There's nothing here to pick up.")
            return self.get_state()

        # Gold is auto-consumed
        if item.item_type == 'gold_pile':
            self.player.gold += item.gold_value
            self._add_message(f"You pick up {item.gold_value} gold! (Total: {self.player.gold})")
            self.items.remove(item)
            self.turn_count += 1
            self._tick_player_buffs()
            self._process_enemies()
            self._update_fov()
            return self.get_state()

        # Inventory full check
        if len(self.player.inventory) >= 10:
            self._add_message("Your inventory is full! Use or drop something first.")
            return self.get_state()

        self.player.inventory.append(item)
        self.items.remove(item)
        self._add_message(f"You pick up the {item.name}.")
        self.turn_count += 1
        self._tick_player_buffs()
        self._process_enemies()
        self._update_fov()

        return self.get_state()

    def descend(self) -> dict:
        """Descend to the next dungeon level."""
        if self.game_over or self.victory:
            return self.get_state()

        tiles = self.dungeon['tiles']
        if tiles[self.player.y][self.player.x] != STAIRS_DOWN:
            self._add_message("There are no stairs here to descend.")
            return self.get_state()

        if self.current_level >= 3:
            # Victory!
            self.victory = True
            self._add_message("You ascend from the deepest floor of the dungeon, victorious!")
            self._add_message(
                f"*** VICTORY! *** You escaped with {self.player.gold} gold "
                f"at level {self.player.level} in {self.turn_count} turns!"
            )
            return self.get_state()

        self.current_level += 1
        self.enemies = []
        self.items = []
        self.explored = set()

        self.dungeon = generate_dungeon(self.current_level)
        rooms = self.dungeon['rooms']

        # Place player in the center of the first room
        first_room = rooms[0]
        self.player.x = first_room['x'] + first_room['w'] // 2
        self.player.y = first_room['y'] + first_room['h'] // 2

        self._populate_level()
        self._update_fov()

        self._add_message(f"You descend to level {self.current_level}. The darkness grows thicker...")
        if self.current_level == 2:
            self._add_message("You hear the rattling of bones and eerie whispers...")
        elif self.current_level == 3:
            self._add_message("An oppressive heat radiates from below. Demons dwell here.")

        return self.get_state()

    # ------------------------------------------------------------------
    # Combat helpers
    # ------------------------------------------------------------------

    def _attack_enemy(self, enemy: Enemy):
        """Player attacks an enemy."""
        # Ghost dodge
        if enemy.dodge_chance > 0 and random.random() < enemy.dodge_chance:
            self._add_message(
                f"You swing at the {enemy.name}, but your weapon passes right through it!"
            )
            return

        damage = max(1, self.player.buff_attack() - enemy.defense + random.randint(-2, 2))
        
        # Critical Hit check (15% chance)
        is_crit = random.random() < 0.15
        if is_crit:
            damage = int(damage * 1.7)
            
        # Deflect check (10% chance)
        is_deflected = random.random() < 0.10
        if is_deflected:
            damage = max(0, damage - int(enemy.defense * 1.5))
            damage = min(damage, 1) # Reduce to 0 or 1

        enemy.take_damage(damage)

        if is_deflected:
            self._add_message(f"The {enemy.name} deflects your attack! You deal only {damage} damage.")
        elif is_crit:
            self._add_message(f"⚡ CRITICAL HIT! You slash the {enemy.name} for {damage} damage!")
        else:
            verbs = ["slash", "strike", "hit", "smash", "stab"]
            verb = random.choice(verbs)
            self._add_message(f"You {verb} the {enemy.name} for {damage} damage.")

        if not enemy.alive:
            gold = enemy.gold_drop()
            self.player.gold += gold
            self._add_message(f"The {enemy.name} collapses! You find {gold} gold.")
            xp_msgs = self.player.gain_xp(enemy.xp_value)
            for m in xp_msgs:
                self._add_message(m)

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def get_state(self) -> dict:
        """Return the full game state as a JSON-serializable dict."""
        tiles = self.dungeon.get('tiles', [])
        width = self.dungeon.get('width', 0)
        height = self.dungeon.get('height', 0)

        # Build visible / explored 2D grids
        visible_grid = [[False] * width for _ in range(height)]
        explored_grid = [[False] * width for _ in range(height)]

        for x, y in self.visible:
            if 0 <= x < width and 0 <= y < height:
                visible_grid[y][x] = True
        for x, y in self.explored:
            if 0 <= x < width and 0 <= y < height:
                explored_grid[y][x] = True

        # Enemies — only include visibility flag
        enemies_out = []
        for e in self.enemies:
            if e.alive:
                is_visible = (e.x, e.y) in self.visible
                enemies_out.append(e.to_dict(visible=is_visible))

        # Items — only include visibility flag
        items_out = []
        for item in self.items:
            is_visible = (item.x, item.y) in self.visible
            d = item.to_dict()
            d['visible'] = is_visible
            items_out.append(d)

        # Can descend?
        can_descend = False
        if tiles and 0 <= self.player.y < height and 0 <= self.player.x < width:
            can_descend = tiles[self.player.y][self.player.x] == STAIRS_DOWN

        return {
            'player': self.player.to_dict(),
            'map': {
                'width': width,
                'height': height,
                'tiles': tiles,
                'visible': visible_grid,
                'explored': explored_grid,
            },
            'enemies': enemies_out,
            'items': items_out,
            'messages': self.messages[-20:],
            'current_level': self.current_level,
            'turn_count': self.turn_count,
            'game_over': self.game_over,
            'victory': self.victory,
            'can_descend': can_descend,
        }
