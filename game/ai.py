"""
Enemy AI system with multiple behavior patterns and A* pathfinding.

Behaviors:
  - aggressive: always chase and attack
  - patrol: patrol between rooms, chase on sight
  - phasing: random movement weighted toward player, can pass through walls
  - smart: A* pathfinding, ranged fireball, retreats when low HP
"""

import random
import heapq

from game.dungeon import WALL, FLOOR, CORRIDOR, DOOR, STAIRS_DOWN, STAIRS_UP

# Passable tiles for normal movement
_PASSABLE = {FLOOR, CORRIDOR, DOOR, STAIRS_DOWN, STAIRS_UP}
# Passable tiles for phasing enemies (everything)
_PASSABLE_PHASE = {WALL, FLOOR, CORRIDOR, DOOR, STAIRS_DOWN, STAIRS_UP}


# ---------------------------------------------------------------------------
# Bresenham line-of-sight
# ---------------------------------------------------------------------------

def _bresenham(x0: int, y0: int, x1: int, y1: int) -> list[tuple[int, int]]:
    """Return all (x, y) points on the Bresenham line from (x0,y0) to (x1,y1)."""
    points = []
    dx = abs(x1 - x0)
    dy = abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy

    while True:
        points.append((x0, y0))
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x0 += sx
        if e2 < dx:
            err += dx
            y0 += sy

    return points


def _has_line_of_sight(
    tiles: list[list[int]], x0: int, y0: int, x1: int, y1: int
) -> bool:
    """Check unobstructed line of sight between two points."""
    width = len(tiles[0])
    height = len(tiles)
    for px, py in _bresenham(x0, y0, x1, y1):
        if px < 0 or px >= width or py < 0 or py >= height:
            return False
        if (px, py) != (x0, y0) and (px, py) != (x1, y1):
            if tiles[py][px] == WALL:
                return False
    return True


def _distance(x0: int, y0: int, x1: int, y1: int) -> float:
    """Chebyshev distance."""
    return max(abs(x1 - x0), abs(y1 - y0))


def _manhattan(x0: int, y0: int, x1: int, y1: int) -> int:
    return abs(x1 - x0) + abs(y1 - y0)


# ---------------------------------------------------------------------------
# A* pathfinding
# ---------------------------------------------------------------------------

def a_star_pathfind(
    start: tuple[int, int],
    goal: tuple[int, int],
    tiles: list[list[int]],
    can_phase: bool = False,
    occupied: set[tuple[int, int]] | None = None,
) -> list[tuple[int, int]]:
    """
    A* pathfinding from start to goal.

    Returns the list of (x, y) waypoints from start (exclusive) to goal (inclusive).
    Returns an empty list if no path is found.
    """
    width = len(tiles[0])
    height = len(tiles)
    passable = _PASSABLE_PHASE if can_phase else _PASSABLE
    if occupied is None:
        occupied = set()

    open_set: list[tuple[float, int, int]] = []
    heapq.heappush(open_set, (0.0, start[0], start[1]))
    came_from: dict[tuple[int, int], tuple[int, int]] = {}
    g_score: dict[tuple[int, int], float] = {start: 0.0}
    closed: set[tuple[int, int]] = set()

    while open_set:
        _, cx, cy = heapq.heappop(open_set)
        current = (cx, cy)

        if current == goal:
            # Reconstruct path
            path = []
            node = goal
            while node != start:
                path.append(node)
                node = came_from[node]
            path.reverse()
            return path

        if current in closed:
            continue
        closed.add(current)

        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = cx + dx, cy + dy
            neighbor = (nx, ny)
            if nx < 0 or nx >= width or ny < 0 or ny >= height:
                continue
            if tiles[ny][nx] not in passable:
                continue
            if neighbor in closed:
                continue
            # Don't path through other enemies (except the goal which might be the player)
            if neighbor != goal and neighbor in occupied:
                continue

            tentative_g = g_score[current] + 1.0
            if tentative_g < g_score.get(neighbor, float('inf')):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f = tentative_g + _manhattan(nx, ny, goal[0], goal[1])
                heapq.heappush(open_set, (f, nx, ny))

    return []


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def get_enemies_in_fov(
    enemies: list, player_x: int, player_y: int, fov_radius: int = 8
) -> list:
    """Return enemies that are within fov_radius Chebyshev distance of the player."""
    result = []
    for e in enemies:
        if not e.alive:
            continue
        if _distance(e.x, e.y, player_x, player_y) <= fov_radius:
            result.append(e)
    return result


# ---------------------------------------------------------------------------
# Individual AI behaviors
# ---------------------------------------------------------------------------

def _sign(n: int) -> int:
    if n > 0:
        return 1
    if n < 0:
        return -1
    return 0


def _try_move(enemy, dx, dy, tiles, occupied):
    """Try to move the enemy by (dx, dy). Returns True if moved."""
    nx, ny = enemy.x + dx, enemy.y + dy
    width = len(tiles[0])
    height = len(tiles)
    if nx < 0 or nx >= width or ny < 0 or ny >= height:
        return False
    passable = _PASSABLE_PHASE if enemy.behavior == 'phasing' else _PASSABLE
    if tiles[ny][nx] not in passable:
        return False
    if (nx, ny) in occupied:
        return False
    occupied.discard((enemy.x, enemy.y))
    enemy.x = nx
    enemy.y = ny
    occupied.add((nx, ny))
    return True


def _ai_aggressive(enemy, player, tiles, occupied, messages):
    """Aggressive AI: always move toward and attack the player."""
    dx = player.x - enemy.x
    dy = player.y - enemy.y

    # Adjacent? Attack.
    if abs(dx) <= 1 and abs(dy) <= 1:
        _melee_attack(enemy, player, messages)
        return

    # Move toward player using simple direction
    move_dx = _sign(dx)
    move_dy = _sign(dy)

    # Try diagonal, then cardinal
    if move_dx != 0 and move_dy != 0:
        if not _try_move(enemy, move_dx, move_dy, tiles, occupied):
            if not _try_move(enemy, move_dx, 0, tiles, occupied):
                _try_move(enemy, 0, move_dy, tiles, occupied)
    elif move_dx != 0:
        if not _try_move(enemy, move_dx, 0, tiles, occupied):
            _try_move(enemy, 0, random.choice([-1, 1]), tiles, occupied)
    elif move_dy != 0:
        if not _try_move(enemy, 0, move_dy, tiles, occupied):
            _try_move(enemy, random.choice([-1, 1]), 0, tiles, occupied)


def _ai_patrol(enemy, player, tiles, occupied, messages, rooms):
    """Patrol AI: patrol between rooms, chase on line of sight."""
    dx = player.x - enemy.x
    dy = player.y - enemy.y
    dist = _distance(enemy.x, enemy.y, player.x, player.y)

    # Check line of sight
    can_see = dist <= 8 and _has_line_of_sight(tiles, enemy.x, enemy.y, player.x, player.y)

    if can_see:
        enemy.chasing = True

    if enemy.chasing:
        # Adjacent? Attack.
        if abs(dx) <= 1 and abs(dy) <= 1:
            _melee_attack(enemy, player, messages)
            return
        # Chase player directly
        move_dx = _sign(dx)
        move_dy = _sign(dy)
        if not _try_move(enemy, move_dx, 0, tiles, occupied):
            _try_move(enemy, 0, move_dy, tiles, occupied)
        return

    # Patrol mode — set up patrol points from rooms if needed
    if not enemy.patrol_points and rooms:
        enemy.patrol_points = [
            (r['x'] + r['w'] // 2, r['y'] + r['h'] // 2)
            for r in random.sample(rooms, min(3, len(rooms)))
        ]
        enemy.patrol_index = 0

    if enemy.patrol_points:
        target = enemy.patrol_points[enemy.patrol_index]
        if (enemy.x, enemy.y) == target:
            enemy.patrol_index = (enemy.patrol_index + 1) % len(enemy.patrol_points)
            target = enemy.patrol_points[enemy.patrol_index]

        pdx = _sign(target[0] - enemy.x)
        pdy = _sign(target[1] - enemy.y)
        if not _try_move(enemy, pdx, 0, tiles, occupied):
            _try_move(enemy, 0, pdy, tiles, occupied)


def _ai_phasing(enemy, player, tiles, occupied, messages):
    """Phasing AI: erratic movement weighted toward the player, can phase through walls."""
    dx = player.x - enemy.x
    dy = player.y - enemy.y

    # Adjacent? Attack (with dodge message).
    if abs(dx) <= 1 and abs(dy) <= 1:
        _melee_attack(enemy, player, messages)
        return

    # Weighted random movement toward player
    choices = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    weights = []
    for cdx, cdy in choices:
        new_dist = _distance(enemy.x + cdx, enemy.y + cdy, player.x, player.y)
        old_dist = _distance(enemy.x, enemy.y, player.x, player.y)
        if new_dist < old_dist:
            weights.append(3)
        elif new_dist == old_dist:
            weights.append(1)
        else:
            weights.append(1)

    random.shuffle(choices)  # break ties randomly
    # Re-sort by weight preference
    move_order = sorted(range(len(choices)), key=lambda i: -weights[i])
    for i in move_order:
        cdx, cdy = choices[i]
        nx, ny = enemy.x + cdx, enemy.y + cdy
        width = len(tiles[0])
        height = len(tiles)
        if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in occupied:
            occupied.discard((enemy.x, enemy.y))
            enemy.x = nx
            enemy.y = ny
            occupied.add((nx, ny))
            break


def _ai_smart(enemy, player, tiles, occupied, messages):
    """Smart AI: A* pathfinding, retreats when low HP, ranged fireball."""
    dx = player.x - enemy.x
    dy = player.y - enemy.y
    dist = _distance(enemy.x, enemy.y, player.x, player.y)

    # Low HP retreat behavior
    if enemy.hp < enemy.max_hp * 0.3 and dist <= 3:
        # Move away from player
        away_dx = -_sign(dx)
        away_dy = -_sign(dy)
        if _try_move(enemy, away_dx, 0, tiles, occupied):
            messages.append(f"The {enemy.name} retreats, looking wounded!")
            return
        if _try_move(enemy, 0, away_dy, tiles, occupied):
            messages.append(f"The {enemy.name} retreats, looking wounded!")
            return
        # Can't retreat, fight to the death

    # Adjacent? Melee attack.
    if abs(dx) <= 1 and abs(dy) <= 1:
        _melee_attack(enemy, player, messages)
        return

    # Ranged fireball if in range and have LOS
    if (enemy.fireball_range > 0
            and dist <= enemy.fireball_range
            and _has_line_of_sight(tiles, enemy.x, enemy.y, player.x, player.y)):
        damage = enemy.fireball_damage - player.buff_defense() + random.randint(-2, 2)
        damage = max(1, damage)
        player.take_damage(damage)
        messages.append(
            f"The {enemy.name} hurls a fireball at you for {damage} damage! 🔥"
        )
        return

    # A* pathfinding toward player
    path = a_star_pathfind(
        (enemy.x, enemy.y),
        (player.x, player.y),
        tiles,
        can_phase=False,
        occupied=occupied - {(player.x, player.y)},
    )
    if path:
        next_pos = path[0]
        if next_pos != (player.x, player.y):
            occupied.discard((enemy.x, enemy.y))
            enemy.x = next_pos[0]
            enemy.y = next_pos[1]
            occupied.add((enemy.x, enemy.y))
        else:
            # Would step onto player — melee instead
            _melee_attack(enemy, player, messages)
    else:
        # Fallback: move toward player simply
        _ai_aggressive(enemy, player, tiles, occupied, messages)


# ---------------------------------------------------------------------------
# Combat
# ---------------------------------------------------------------------------

def _melee_attack(enemy, player, messages):
    """Enemy performs a melee attack on the player."""
    damage = max(1, enemy.attack - player.buff_defense() + random.randint(-2, 2))
    
    # Critical check (12% chance for enemies)
    is_crit = random.random() < 0.12
    if is_crit:
        damage = int(damage * 1.5)
        
    # Player Deflect check (10% chance)
    is_deflected = random.random() < 0.10
    if is_deflected:
        damage = max(0, damage - int(player.buff_defense() * 1.2))
        damage = min(damage, 1) # Reduce to 0 or 1

    player.take_damage(damage)

    if is_deflected:
        messages.append(f"🛡️ You deflect the {enemy.name}'s strike! You take only {damage} damage.")
    elif is_crit:
        messages.append(f"💥 Critical Strike! The {enemy.name} hits you for {damage} damage!")
    else:
        flavor = random.choice([
            f"The {enemy.name} slashes at you for {damage} damage!",
            f"The {enemy.name} strikes you for {damage} damage!",
            f"The {enemy.name} lunges at you for {damage} damage!",
        ])
        messages.append(flavor)

    if player.hp <= 0:
        messages.append(f"The {enemy.name} has slain you... Your samurai journey ends.")


# ---------------------------------------------------------------------------
# Main AI processor
# ---------------------------------------------------------------------------

def process_enemy_turns(game_state) -> list[str]:
    """
    Process all enemy turns for the current game state.

    Returns a list of message strings describing what happened.
    """
    messages: list[str] = []
    player = game_state.player
    tiles = game_state.dungeon['tiles']
    enemies = game_state.enemies
    rooms = game_state.dungeon['rooms']

    if player.hp <= 0:
        return messages

    # Build occupied set (enemy positions, excluding dead enemies)
    occupied: set[tuple[int, int]] = set()
    for e in enemies:
        if e.alive:
            occupied.add((e.x, e.y))

    for enemy in enemies:
        if not enemy.alive:
            continue
        if player.hp <= 0:
            break

        behavior = enemy.behavior

        if behavior == 'aggressive':
            _ai_aggressive(enemy, player, tiles, occupied, messages)
        elif behavior == 'patrol':
            _ai_patrol(enemy, player, tiles, occupied, messages, rooms)
        elif behavior == 'phasing':
            _ai_phasing(enemy, player, tiles, occupied, messages)
        elif behavior == 'smart':
            _ai_smart(enemy, player, tiles, occupied, messages)

    return messages
