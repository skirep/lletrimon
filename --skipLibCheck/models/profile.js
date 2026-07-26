"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEVEL_THRESHOLDS = exports.AVATARS = void 0;
exports.getLevelFromXp = getLevelFromXp;
exports.getXpToNextLevel = getXpToNextLevel;
exports.AVATARS = [
    'cat', 'dog', 'rabbit', 'bear', 'fox',
    'owl', 'penguin', 'unicorn', 'dragon', 'elephant',
];
exports.LEVEL_THRESHOLDS = [
    0, 100, 250, 500, 900, 1500, 2400, 3700, 5500, 8000,
];
function getLevelFromXp(xp) {
    let level = 1;
    for (let i = 0; i < exports.LEVEL_THRESHOLDS.length; i++) {
        if (xp >= exports.LEVEL_THRESHOLDS[i])
            level = i + 1;
    }
    return level;
}
function getXpToNextLevel(xp) {
    const level = getLevelFromXp(xp);
    const currentThreshold = exports.LEVEL_THRESHOLDS[level - 1] ?? 0;
    const nextThreshold = exports.LEVEL_THRESHOLDS[level] ?? exports.LEVEL_THRESHOLDS[exports.LEVEL_THRESHOLDS.length - 1];
    return {
        current: xp - currentThreshold,
        needed: nextThreshold - currentThreshold,
        level,
    };
}
