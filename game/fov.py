"""
Field-of-View calculation using recursive shadowcasting.

Based on the classic 8-octant recursive shadowcasting algorithm for roguelikes.
Walls block vision, corridors have a slightly reduced vision radius.
"""

from game.dungeon import WALL, CORRIDOR

# Multiplier tables for the eight octants.
# Each octant has four multiplier values: (xx, xy, yx, yy)
_OCTANT_MULTIPLIERS = [
    (1, 0, 0, 1),
    (0, 1, 1, 0),
    (0, -1, 1, 0),
    (-1, 0, 0, 1),
    (-1, 0, 0, -1),
    (0, -1, -1, 0),
    (0, 1, -1, 0),
    (1, 0, 0, -1),
]


def _blocks_light(tiles: list[list[int]], x: int, y: int, width: int, height: int) -> bool:
    """Check if a tile blocks light (line of sight)."""
    if x < 0 or x >= width or y < 0 or y >= height:
        return True
    return tiles[y][x] == WALL


def _cast_light(
    tiles: list[list[int]],
    visible: set[tuple[int, int]],
    origin_x: int,
    origin_y: int,
    radius: int,
    width: int,
    height: int,
    row: int,
    start_slope: float,
    end_slope: float,
    xx: int,
    xy: int,
    yx: int,
    yy: int,
):
    """Recursively cast light in one octant."""
    if start_slope < end_slope:
        return

    radius_sq = radius * radius
    next_start_slope = start_slope

    for j in range(row, radius + 1):
        blocked = False
        dx = -j - 1
        dy = -j

        while dx <= 0:
            dx += 1
            map_x = origin_x + dx * xx + dy * xy
            map_y = origin_y + dx * yx + dy * yy

            l_slope = (dx - 0.5) / (dy + 0.5)
            r_slope = (dx + 0.5) / (dy - 0.5)

            if start_slope < r_slope:
                continue
            if end_slope > l_slope:
                break

            # Check if within radius
            if dx * dx + dy * dy <= radius_sq:
                if 0 <= map_x < width and 0 <= map_y < height:
                    visible.add((map_x, map_y))

            if blocked:
                if _blocks_light(tiles, map_x, map_y, width, height):
                    next_start_slope = r_slope
                    continue
                else:
                    blocked = False
                    start_slope = next_start_slope
            elif _blocks_light(tiles, map_x, map_y, width, height):
                blocked = True
                next_start_slope = r_slope
                _cast_light(
                    tiles, visible,
                    origin_x, origin_y,
                    radius, width, height,
                    j + 1,
                    start_slope, l_slope,
                    xx, xy, yx, yy,
                )

        if blocked:
            break


def compute_fov(
    tiles: list[list[int]],
    player_x: int,
    player_y: int,
    radius: int = 8,
) -> set[tuple[int, int]]:
    """
    Compute the set of (x, y) positions visible from (player_x, player_y).

    Uses recursive shadowcasting across 8 octants. Corridors have slightly
    reduced vision (radius - 2, min 4).
    """
    width = len(tiles[0]) if tiles else 0
    height = len(tiles)

    # Reduce radius if standing in a corridor
    effective_radius = radius
    if (0 <= player_x < width and 0 <= player_y < height
            and tiles[player_y][player_x] == CORRIDOR):
        effective_radius = max(4, radius - 2)

    visible: set[tuple[int, int]] = set()
    visible.add((player_x, player_y))

    for xx, xy, yx, yy in _OCTANT_MULTIPLIERS:
        _cast_light(
            tiles, visible,
            player_x, player_y,
            effective_radius, width, height,
            1, 1.0, 0.0,
            xx, xy, yx, yy,
        )

    return visible
