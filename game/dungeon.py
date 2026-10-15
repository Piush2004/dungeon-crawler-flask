"""
Procedural dungeon generation using Binary Space Partition (BSP).

Generates connected multi-room dungeons with corridors, doors, and stairs.
Each level gets progressively more complex.
"""

import random

# Tile types
WALL = 0
FLOOR = 1
CORRIDOR = 2
STAIRS_DOWN = 3
DOOR = 4
STAIRS_UP = 5

# Dungeon dimensions
WIDTH = 60
HEIGHT = 40

# Room size constraints
MIN_ROOM_W = 5
MAX_ROOM_W = 12
MIN_ROOM_H = 4
MAX_ROOM_H = 8

# BSP split constraints
MIN_LEAF_SIZE = 8


class BSPNode:
    """A node in the BSP tree representing a rectangular region."""

    def __init__(self, x: int, y: int, w: int, h: int):
        self.x = x
        self.y = y
        self.w = w
        self.h = h
        self.left: BSPNode | None = None
        self.right: BSPNode | None = None
        self.room: dict | None = None

    def split(self) -> bool:
        """Attempt to split this node into two children. Returns True on success."""
        if self.left is not None or self.right is not None:
            return False

        # Decide split direction based on aspect ratio with some randomness
        if self.w > self.h and self.w / self.h >= 1.25:
            split_h = False
        elif self.h > self.w and self.h / self.w >= 1.25:
            split_h = True
        else:
            split_h = random.random() > 0.5

        max_split = (self.h if split_h else self.w) - MIN_LEAF_SIZE
        if max_split < MIN_LEAF_SIZE:
            return False

        split_pos = random.randint(MIN_LEAF_SIZE, max_split)

        if split_h:
            self.left = BSPNode(self.x, self.y, self.w, split_pos)
            self.right = BSPNode(self.x, self.y + split_pos, self.w, self.h - split_pos)
        else:
            self.left = BSPNode(self.x, self.y, split_pos, self.h)
            self.right = BSPNode(self.x + split_pos, self.y, self.w - split_pos, self.h)

        return True

    def create_rooms(self):
        """Recursively create rooms in leaf nodes."""
        if self.left is not None or self.right is not None:
            if self.left is not None:
                self.left.create_rooms()
            if self.right is not None:
                self.right.create_rooms()
            return

        # Leaf node — carve a room inside
        room_w = random.randint(MIN_ROOM_W, min(MAX_ROOM_W, self.w - 2))
        room_h = random.randint(MIN_ROOM_H, min(MAX_ROOM_H, self.h - 2))
        room_x = random.randint(self.x + 1, self.x + self.w - room_w - 1)
        room_y = random.randint(self.y + 1, self.y + self.h - room_h - 1)

        self.room = {'x': room_x, 'y': room_y, 'w': room_w, 'h': room_h}

    def get_rooms(self) -> list[dict]:
        """Collect all rooms from leaf nodes."""
        rooms = []
        if self.room is not None:
            rooms.append(self.room)
        if self.left is not None:
            rooms.extend(self.left.get_rooms())
        if self.right is not None:
            rooms.extend(self.right.get_rooms())
        return rooms

    def get_room_center(self) -> tuple[int, int] | None:
        """Get center of this node's room, or the center of a descendant's room."""
        if self.room is not None:
            cx = self.room['x'] + self.room['w'] // 2
            cy = self.room['y'] + self.room['h'] // 2
            return (cx, cy)
        if self.left is not None:
            left_center = self.left.get_room_center()
            if left_center is not None:
                return left_center
        if self.right is not None:
            right_center = self.right.get_room_center()
            if right_center is not None:
                return right_center
        return None


def _carve_room(tiles: list[list[int]], room: dict):
    """Carve a room into the tile grid."""
    for y in range(room['y'], room['y'] + room['h']):
        for x in range(room['x'], room['x'] + room['w']):
            if 0 <= x < WIDTH and 0 <= y < HEIGHT:
                tiles[y][x] = FLOOR


def _carve_corridor_h(tiles: list[list[int]], x1: int, x2: int, y: int):
    """Carve a horizontal corridor."""
    for x in range(min(x1, x2), max(x1, x2) + 1):
        if 0 <= x < WIDTH and 0 <= y < HEIGHT:
            if tiles[y][x] == WALL:
                tiles[y][x] = CORRIDOR


def _carve_corridor_v(tiles: list[list[int]], y1: int, y2: int, x: int):
    """Carve a vertical corridor."""
    for y in range(min(y1, y2), max(y1, y2) + 1):
        if 0 <= x < WIDTH and 0 <= y < HEIGHT:
            if tiles[y][x] == WALL:
                tiles[y][x] = CORRIDOR


def _connect_rooms(tiles: list[list[int]], node: BSPNode):
    """Recursively connect sibling rooms with L-shaped corridors."""
    if node.left is None or node.right is None:
        return

    _connect_rooms(tiles, node.left)
    _connect_rooms(tiles, node.right)

    left_center = node.left.get_room_center()
    right_center = node.right.get_room_center()

    if left_center is None or right_center is None:
        return

    x1, y1 = left_center
    x2, y2 = right_center

    # L-shaped corridor: go horizontal first, then vertical (or vice versa)
    if random.random() > 0.5:
        _carve_corridor_h(tiles, x1, x2, y1)
        _carve_corridor_v(tiles, y1, y2, x2)
    else:
        _carve_corridor_v(tiles, y1, y2, x1)
        _carve_corridor_h(tiles, x1, x2, y2)


def _place_doors(tiles: list[list[int]], rooms: list[dict]):
    """Place doors where corridors meet room edges."""
    for y in range(1, HEIGHT - 1):
        for x in range(1, WIDTH - 1):
            if tiles[y][x] != CORRIDOR:
                continue

            # Check if this corridor tile is adjacent to a room floor tile
            # and forms a natural doorway (narrow passage into room)
            for dx, dy in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < WIDTH and 0 <= ny < HEIGHT and tiles[ny][nx] == FLOOR:
                    # Check if perpendicular tiles are walls (doorway shape)
                    if dx == 0:  # vertical adjacency — check horizontal walls
                        if (tiles[y][x - 1] == WALL and tiles[y][x + 1] == WALL):
                            tiles[y][x] = DOOR
                    else:  # horizontal adjacency — check vertical walls
                        if (tiles[y - 1][x] == WALL and tiles[y + 1][x] == WALL):
                            tiles[y][x] = DOOR


def _validate_connectivity(tiles: list[list[int]], rooms: list[dict]) -> bool:
    """Ensure all rooms are reachable via flood fill."""
    if not rooms:
        return False

    passable = {FLOOR, CORRIDOR, STAIRS_DOWN, STAIRS_UP, DOOR}
    start_room = rooms[0]
    start_x = start_room['x'] + start_room['w'] // 2
    start_y = start_room['y'] + start_room['h'] // 2

    visited = set()
    stack = [(start_x, start_y)]

    while stack:
        cx, cy = stack.pop()
        if (cx, cy) in visited:
            continue
        if not (0 <= cx < WIDTH and 0 <= cy < HEIGHT):
            continue
        if tiles[cy][cx] not in passable:
            continue
        visited.add((cx, cy))
        stack.extend([(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)])

    # Check that every room has at least one visited tile
    for room in rooms:
        rcx = room['x'] + room['w'] // 2
        rcy = room['y'] + room['h'] // 2
        if (rcx, rcy) not in visited:
            return False

    return True


def _force_connect(tiles: list[list[int]], rooms: list[dict]):
    """Brute-force connect any unreachable rooms directly to the first room."""
    passable = {FLOOR, CORRIDOR, STAIRS_DOWN, STAIRS_UP, DOOR}
    start_room = rooms[0]
    start_x = start_room['x'] + start_room['w'] // 2
    start_y = start_room['y'] + start_room['h'] // 2

    visited = set()
    stack = [(start_x, start_y)]
    while stack:
        cx, cy = stack.pop()
        if (cx, cy) in visited:
            continue
        if not (0 <= cx < WIDTH and 0 <= cy < HEIGHT):
            continue
        if tiles[cy][cx] not in passable:
            continue
        visited.add((cx, cy))
        stack.extend([(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)])

    for room in rooms[1:]:
        rcx = room['x'] + room['w'] // 2
        rcy = room['y'] + room['h'] // 2
        if (rcx, rcy) not in visited:
            # Directly carve corridor from first room center to this room
            if random.random() > 0.5:
                _carve_corridor_h(tiles, start_x, rcx, start_y)
                _carve_corridor_v(tiles, start_y, rcy, rcx)
            else:
                _carve_corridor_v(tiles, start_y, rcy, start_x)
                _carve_corridor_h(tiles, start_x, rcx, rcy)

            # Re-flood to update visited set
            stack2 = [(rcx, rcy)]
            while stack2:
                cx2, cy2 = stack2.pop()
                if (cx2, cy2) in visited:
                    continue
                if not (0 <= cx2 < WIDTH and 0 <= cy2 < HEIGHT):
                    continue
                if tiles[cy2][cx2] not in passable:
                    continue
                visited.add((cx2, cy2))
                stack2.extend([(cx2 + 1, cy2), (cx2 - 1, cy2), (cx2, cy2 + 1), (cx2, cy2 - 1)])


def generate_dungeon(level: int) -> dict:
    """
    Generate a dungeon for the given level (1-based).

    Higher levels produce more rooms and tighter corridors.
    Returns a dict with 'tiles', 'rooms', 'width', and 'height'.
    """
    # Scale room count with level
    min_rooms = min(5 + level, 8)
    max_rooms = min(5 + level * 2, 12)
    target_rooms = random.randint(min_rooms, max_rooms)

    # Keep trying until we get a connected dungeon with enough rooms
    for _attempt in range(50):
        tiles = [[WALL for _ in range(WIDTH)] for _ in range(HEIGHT)]

        root = BSPNode(0, 0, WIDTH, HEIGHT)

        # Build BSP tree — split until we have enough leaves
        leaves = [root]
        did_split = True
        while did_split:
            did_split = False
            new_leaves = []
            for leaf in leaves:
                if leaf.left is None and leaf.right is None:
                    # Should we split?
                    if leaf.w > MIN_LEAF_SIZE * 2 or leaf.h > MIN_LEAF_SIZE * 2:
                        if leaf.split():
                            new_leaves.append(leaf.left)
                            new_leaves.append(leaf.right)
                            did_split = True
                            continue
                new_leaves.append(leaf)
            leaves = new_leaves

        root.create_rooms()
        rooms = root.get_rooms()

        if len(rooms) < 3:
            continue

        # Carve rooms
        for room in rooms:
            _carve_room(tiles, room)

        # Connect rooms via BSP tree
        _connect_rooms(tiles, root)

        # Validate and force-connect if needed
        if not _validate_connectivity(tiles, rooms):
            _force_connect(tiles, rooms)

        if not _validate_connectivity(tiles, rooms):
            continue

        # Place doors
        _place_doors(tiles, rooms)

        # Place stairs
        first_room = rooms[0]
        last_room = rooms[-1]

        up_x = first_room['x'] + first_room['w'] // 2
        up_y = first_room['y'] + first_room['h'] // 2 + 1
        if tiles[up_y][up_x] == FLOOR:
            tiles[up_y][up_x] = STAIRS_UP

        down_x = last_room['x'] + last_room['w'] // 2
        down_y = last_room['y'] + last_room['h'] // 2
        tiles[down_y][down_x] = STAIRS_DOWN

        return {
            'tiles': tiles,
            'rooms': rooms,
            'width': WIDTH,
            'height': HEIGHT,
        }

    # Ultimate fallback — simple two-room dungeon
    tiles = [[WALL for _ in range(WIDTH)] for _ in range(HEIGHT)]
    rooms = [
        {'x': 5, 'y': 5, 'w': 10, 'h': 8},
        {'x': 30, 'y': 20, 'w': 10, 'h': 8},
    ]
    for room in rooms:
        _carve_room(tiles, room)
    _carve_corridor_h(tiles, 10, 35, 9)
    _carve_corridor_v(tiles, 9, 24, 35)

    tiles[6][10] = STAIRS_UP
    tiles[24][35] = STAIRS_DOWN

    return {
        'tiles': tiles,
        'rooms': rooms,
        'width': WIDTH,
        'height': HEIGHT,
    }
