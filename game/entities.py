"""
Player, Enemy, and Item entity classes for the roguelike.

All entities support JSON serialization via to_dict().
"""

import random

# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------

ITEM_DEFINITIONS = {
    'health_potion': {
        'name': 'Gourd of Sake',
        'type': 'health_potion',
        'description': 'A decorative gourd filled with healing sake. Restores 40 HP.',
        'heal': 40,
    },
    'attack_scroll': {
        'name': 'Kenjutsu Scroll',
        'type': 'attack_scroll',
        'description': 'Imbues you with +6 attack for 10 turns.',
        'buff': 'attack',
        'buff_amount': 6,
        'buff_duration': 10,
    },
    'defense_scroll': {
        'name': 'Yoroi Scroll',
        'type': 'defense_scroll',
        'description': 'Surrounds you with +6 defense for 10 turns.',
        'buff': 'defense',
        'buff_amount': 6,
        'buff_duration': 10,
    },
    'gold_pile': {
        'name': 'Koban Gold Coins',
        'type': 'gold_pile',
        'description': 'A pile of traditional Japanese oval gold coins.',
    },
    'key': {
        'name': 'Ornate Temple Key',
        'type': 'key',
        'description': 'An old iron key with a cherry blossom bow.',
    },
}


class Item:
    """An item that can exist on the dungeon floor or in the player inventory."""

    _next_id = 1

    def __init__(self, item_type: str, x: int = 0, y: int = 0):
        defn = ITEM_DEFINITIONS[item_type]
        self.id = Item._next_id
        Item._next_id += 1
        self.item_type = item_type
        self.name = defn['name']
        self.description = defn['description']
        self.x = x
        self.y = y

        # Gold amount (randomized when created)
        if item_type == 'gold_pile':
            self.gold_value = random.randint(5, 20)
        else:
            self.gold_value = 0

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'type': self.item_type,
            'name': self.name,
            'description': self.description,
            'x': self.x,
            'y': self.y,
        }

    def inventory_dict(self) -> dict:
        return {
            'name': self.name,
            'type': self.item_type,
            'description': self.description,
        }


# ---------------------------------------------------------------------------
# Player
# ---------------------------------------------------------------------------

class Player:
    """The player character."""

    def __init__(self):
        self.x: int = 0
        self.y: int = 0
        self.hp: int = 120
        self.max_hp: int = 120
        self.attack: int = 16
        self.defense: int = 6
        self.level: int = 1
        self.xp: int = 0
        self.xp_to_next: int = 60
        self.gold: int = 0
        self.inventory: list[Item] = []
        self.buffs: list[dict] = []  # {'name': str, 'stat': str, 'amount': int, 'turns_left': int}

    # --- Buff helpers -------------------------------------------------------

    def buff_attack(self) -> int:
        """Current attack including active buffs."""
        bonus = sum(b['amount'] for b in self.buffs if b['stat'] == 'attack')
        return self.attack + bonus

    def buff_defense(self) -> int:
        """Current defense including active buffs."""
        bonus = sum(b['amount'] for b in self.buffs if b['stat'] == 'defense')
        return self.defense + bonus

    def tick_buffs(self) -> list[str]:
        """Decrease buff timers by 1 and remove expired ones. Returns messages."""
        messages = []
        remaining = []
        for buff in self.buffs:
            buff['turns_left'] -= 1
            if buff['turns_left'] <= 0:
                messages.append(f"The effect of {buff['name']} has worn off.")
            else:
                remaining.append(buff)
        self.buffs = remaining
        return messages

    # --- Core actions -------------------------------------------------------

    def take_damage(self, amount: int) -> int:
        """Apply damage to the player. Returns actual damage taken."""
        actual = max(0, amount)
        self.hp = max(0, self.hp - actual)
        return actual

    def heal(self, amount: int) -> int:
        """Heal the player. Returns actual HP restored."""
        before = self.hp
        self.hp = min(self.max_hp, self.hp + amount)
        return self.hp - before

    def gain_xp(self, amount: int) -> list[str]:
        """Add XP and handle level-ups. Returns messages."""
        self.xp += amount
        messages = [f"You gain {amount} experience points."]
        while self.xp >= self.xp_to_next:
            messages.extend(self._level_up())
        return messages

    def _level_up(self) -> list[str]:
        """Perform a single level-up."""
        self.xp -= self.xp_to_next
        self.level += 1
        self.xp_to_next = int(self.xp_to_next * 1.6)
        self.max_hp += 20
        self.attack += 3
        self.defense += 2
        self.hp = self.max_hp
        return [
            f"*** LEVEL UP! You are now level {self.level}! ***",
            f"Max HP +20 ({self.max_hp}), Attack +3 ({self.attack}), Defense +2 ({self.defense}). Fully healed!",
        ]

    def use_item(self, item_index: int) -> tuple[bool, list[str]]:
        """
        Use an item from inventory by index.
        Returns (success, list_of_messages).
        """
        if item_index < 0 or item_index >= len(self.inventory):
            return False, ["Nothing to use at that slot."]

        item = self.inventory[item_index]
        messages: list[str] = []
        defn = ITEM_DEFINITIONS.get(item.item_type, {})

        if item.item_type == 'health_potion':
            healed = self.heal(defn.get('heal', 30))
            messages.append(f"You drink the {item.name} and recover {healed} HP.")
        elif item.item_type in ('attack_scroll', 'defense_scroll'):
            stat = defn['buff']
            buff = {
                'name': item.name,
                'stat': stat,
                'amount': defn['buff_amount'],
                'turns_left': defn['buff_duration'],
            }
            self.buffs.append(buff)
            messages.append(
                f"You read the {item.name}. +{defn['buff_amount']} {stat} for {defn['buff_duration']} turns!"
            )
        elif item.item_type == 'key':
            messages.append("You hold the key up, but there's nothing to unlock right now.")
            return False, messages
        else:
            messages.append(f"You can't use the {item.name} like that.")
            return False, messages

        self.inventory.pop(item_index)
        return True, messages

    # --- Serialization ------------------------------------------------------

    def to_dict(self) -> dict:
        return {
            'x': self.x,
            'y': self.y,
            'hp': self.hp,
            'max_hp': self.max_hp,
            'attack': self.buff_attack(),
            'defense': self.buff_defense(),
            'level': self.level,
            'xp': self.xp,
            'xp_to_next': self.xp_to_next,
            'gold': self.gold,
            'inventory': [i.inventory_dict() for i in self.inventory],
            'buffs': [{'name': b['name'], 'turns_left': b['turns_left']} for b in self.buffs],
        }


# ---------------------------------------------------------------------------
# Enemies
# ---------------------------------------------------------------------------

ENEMY_TEMPLATES = {
    'rat': {
        'name': 'Bakeneko',
        'hp': 25,
        'attack': 6,
        'defense': 2,
        'xp': 15,
        'gold_min': 4,
        'gold_max': 8,
        'behavior': 'aggressive',
        'symbol': 'b',
    },
    'skeleton': {
        'name': 'Ashigaru Skeleton',
        'hp': 50,
        'attack': 10,
        'defense': 4,
        'xp': 30,
        'gold_min': 8,
        'gold_max': 14,
        'behavior': 'patrol',
        'symbol': 'a',
    },
    'ghost': {
        'name': 'Yurei',
        'hp': 40,
        'attack': 14,
        'defense': 0,
        'xp': 45,
        'gold_min': 12,
        'gold_max': 20,
        'behavior': 'phasing',
        'symbol': 'y',
        'dodge_chance': 0.4,
    },
    'demon': {
        'name': 'Oni',
        'hp': 120,
        'attack': 22,
        'defense': 8,
        'xp': 80,
        'gold_min': 25,
        'gold_max': 45,
        'behavior': 'smart',
        'symbol': 'O',
        'fireball_range': 4,
        'fireball_damage': 15,
    },
}


class Enemy:
    """A hostile creature in the dungeon."""

    _next_id = 1

    def __init__(self, enemy_type: str, x: int, y: int):
        tmpl = ENEMY_TEMPLATES[enemy_type]
        self.id = Enemy._next_id
        Enemy._next_id += 1
        self.enemy_type = enemy_type
        self.name = tmpl['name']
        self.hp = tmpl['hp']
        self.max_hp = tmpl['hp']
        self.attack = tmpl['attack']
        self.defense = tmpl['defense']
        self.xp_value = tmpl['xp']
        self.gold_min = tmpl['gold_min']
        self.gold_max = tmpl['gold_max']
        self.behavior = tmpl['behavior']
        self.dodge_chance = tmpl.get('dodge_chance', 0.0)
        self.fireball_range = tmpl.get('fireball_range', 0)
        self.fireball_damage = tmpl.get('fireball_damage', 0)
        self.x = x
        self.y = y
        self.alive = True

        # Patrol state
        self.patrol_target: tuple[int, int] | None = None
        self.patrol_points: list[tuple[int, int]] = []
        self.patrol_index: int = 0
        self.chasing: bool = False

    def take_damage(self, amount: int) -> int:
        """Apply damage. Returns actual damage dealt."""
        actual = max(0, amount)
        self.hp = max(0, self.hp - actual)
        if self.hp <= 0:
            self.alive = False
        return actual

    def gold_drop(self) -> int:
        return random.randint(self.gold_min, self.gold_max)

    def to_dict(self, visible: bool = False) -> dict:
        return {
            'id': self.id,
            'type': self.enemy_type,
            'name': self.name,
            'x': self.x,
            'y': self.y,
            'hp': self.hp,
            'max_hp': self.max_hp,
            'visible': visible,
        }
