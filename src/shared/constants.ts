/**
 * Shared constants for SnowClash game
 * Used by both server and client
 */

// Map
export const MAP_SIZE = 800;

// Player
export const PLAYER_SPEED = 2;
export const PLAYER_RADIUS = 15;
export const PLAYER_INITIAL_ENERGY = 10;

// Snowball
export const SNOWBALL_SPEED = 4;
export const SNOWBALL_RADIUS_NORMAL = 5;
export const SNOWBALL_RADIUS_CHARGED = 9;

// Damage
export const NORMAL_DAMAGE = 4;
export const CHARGED_DAMAGE = 7;
export const CHARGE_THRESHOLD = 0.7;

// Timing (milliseconds)
export const READY_TIMEOUT = 60000; // 1 minute
export const THROW_COOLDOWN = 1000;
export const MIN_CHARGE_TIME = 200;

// Bot behavior
export const BOT_ATTACK_INTERVAL = 2000;
export const BOT_DIRECTION_CHANGE_INTERVAL = 1000;

// Territory
export const TERRITORY_PADDING = 15; // Distance from diagonal line
export const SPAWN_MARGIN = 30; // Distance from diagonal for spawning
export const SPAWN_PADDING = 20; // Distance from map edges for spawning

// UI Layout
export const UI_HEADER_HEIGHT = 70; // Top margin for title/header
export const UI_FOOTER_HEIGHT = 70; // Bottom margin for buttons
export const UI_BORDER_MARGIN = 50; // Margin from edges to avoid tree decorations
export const MOBILE_CONTROLLER_HEIGHT = 200; // Mobile virtual controller area height

// Calculated UI values
export const PLAYABLE_AREA_TOP = UI_HEADER_HEIGHT;
export const PLAYABLE_AREA_BOTTOM = MAP_SIZE - UI_FOOTER_HEIGHT;
export const PLAYABLE_AREA_HEIGHT = PLAYABLE_AREA_BOTTOM - PLAYABLE_AREA_TOP;

// Player positioning in lobby
export const PLAYER_SPACING = 110; // Distance between players in lobby
