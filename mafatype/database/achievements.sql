-- Achievements System Tables

USE typing_master;

-- Add category column to Practice_Texts
ALTER TABLE Practice_Texts ADD COLUMN category ENUM('general', 'finger') NOT NULL DEFAULT 'general' AFTER language;

-- Update existing practice texts - assuming they are general
UPDATE Practice_Texts SET category = 'general';

-- Achievements Table
CREATE TABLE IF NOT EXISTS Achievements (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    title             VARCHAR(100) NOT NULL,
    description       TEXT NOT NULL,
    category          ENUM('typing_speed', 'typing_activity', 'practice_training', 'competition', 'special', 'accuracy', 'finger_training') NOT NULL,
    badge_icon        VARCHAR(50) DEFAULT '🏆',
    requirements_json JSON NOT NULL, -- e.g. {"type": "wpm", "min": 100}
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Achievements Table
CREATE TABLE IF NOT EXISTS User_Achievements (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NOT NULL,
    achievement_id INT NOT NULL,
    unlocked_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (user_id, achievement_id),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES Achievements(id) ON DELETE CASCADE
);

-- Seed Achievements
INSERT INTO Achievements (title, description, category, badge_icon, requirements_json) VALUES
-- Typing Speed
('10+ WPM', 'Capai kecepatan lebih dari 10 kata per menit.', 'typing_speed', '🐢', '{"type": "wpm", "min": 10}'),
('25+ WPM', 'Capai kecepatan lebih dari 25 kata per menit.', 'typing_speed', '🚶', '{"type": "wpm", "min": 25}'),
('50+ WPM', 'Capai kecepatan lebih dari 50 kata per menit.', 'typing_speed', '🏃', '{"type": "wpm", "min": 50}'),
('60+ WPM', 'Capai kecepatan lebih dari 60 kata per menit.', 'typing_speed', '🚲', '{"type": "wpm", "min": 60}'),
('75+ WPM', 'Capai kecepatan lebih dari 75 kata per menit.', 'typing_speed', '🚗', '{"type": "wpm", "min": 75}'),
('100+ WPM', 'Capai kecepatan lebih dari 100 kata per menit.', 'typing_speed', '🚄', '{"type": "wpm", "min": 100}'),
('125+ WPM', 'Capai kecepatan lebih dari 125 kata per menit.', 'typing_speed', '✈️', '{"type": "wpm", "min": 125}'),
('150+ WPM', 'Capai kecepatan lebih dari 150 kata per menit.', 'typing_speed', '🚀', '{"type": "wpm", "min": 150}'),
('200+ WPM', 'Capai kecepatan lebih dari 200 kata per menit.', 'typing_speed', '⚡', '{"type": "wpm", "min": 200}'),

-- Typing Activity (Tests Completed @ min 20 wpm)
('10 Tests Completed', 'Selesaikan 10 typing test dengan minimal 20 WPM.', 'typing_activity', '📜', '{"type": "test_count", "min": 10, "min_wpm": 20}'),
('25 Tests Completed', 'Selesaikan 25 typing test dengan minimal 20 WPM.', 'typing_activity', '📚', '{"type": "test_count", "min": 25, "min_wpm": 20}'),
('50 Tests Completed', 'Selesaikan 50 typing test dengan minimal 20 WPM.', 'typing_activity', '🎓', '{"type": "test_count", "min": 50, "min_wpm": 20}'),
('100 Tests Completed', 'Selesaikan 100 typing test dengan minimal 20 WPM.', 'typing_activity', '🏛️', '{"type": "test_count", "min": 100, "min_wpm": 20}'),
('500 Tests Completed', 'Selesaikan 500 typing test dengan minimal 20 WPM.', 'typing_activity', '🏰', '{"type": "test_count", "min": 500, "min_wpm": 20}'),
('1000 Tests Completed', 'Selesaikan 1000 typing test dengan minimal 20 WPM.', 'typing_activity', '👑', '{"type": "test_count", "min": 1000, "min_wpm": 20}'),

-- Flawless Typing (Accuracy 100% @ min 60 wpm)
('Flawless 3', 'Selesaikan 3 test berturut-turut tanpa kesalahan, minimal 60 WPM.', 'typing_activity', '💎', '{"type": "flawless_streak", "min": 3, "min_wpm": 60}'),
('Flawless 5', 'Selesaikan 5 test berturut-turut tanpa kesalahan, minimal 60 WPM.', 'typing_activity', '💎💎', '{"type": "flawless_streak", "min": 5, "min_wpm": 60}'),
('Flawless 10', 'Selesaikan 10 test berturut-turut tanpa kesalahan, minimal 60 WPM.', 'typing_activity', '💎💎💎', '{"type": "flawless_streak", "min": 10, "min_wpm": 60}'),

-- Practice Training (category general)
('Beginner Trainer', 'Selesaikan 5 latihan mengetik.', 'practice_training', '🌱', '{"type": "practice_count", "min": 5}'),
('Dedicated Learner', 'Selesaikan 25 latihan mengetik.', 'practice_training', '📖', '{"type": "practice_count", "min": 25}'),
('Practice Master', 'Selesaikan 50 latihan mengetik.', 'practice_training', '🧠', '{"type": "practice_count", "min": 50}'),
('Typing Specialist', 'Selesaikan 75 latihan mengetik.', 'practice_training', '🎖️', '{"type": "practice_count", "min": 75}'),
('Typing Expert', 'Selesaikan 100 latihan mengetik.', 'practice_training', '🏅', '{"type": "practice_count", "min": 100}'),

-- Finger Training (category finger)
('Finger Beginner', 'Selesaikan 5 latihan finger training.', 'finger_training', '☝️', '{"type": "finger_count", "min": 5}'),
('Finger Apprentice', 'Selesaikan 15 latihan finger training.', 'finger_training', '✌️', '{"type": "finger_count", "min": 15}'),
('Finger Skilled', 'Selesaikan 25 latihan finger training.', 'finger_training', '✋', '{"type": "finger_count", "min": 25}'),
('Finger Expert', 'Selesaikan 50 latihan finger training.', 'finger_training', '🦾', '{"type": "finger_count", "min": 50}'),
('Finger Specialist', 'Selesaikan 75 latihan finger training.', 'finger_training', '✨', '{"type": "finger_count", "min": 75}'),
('Finger Master', 'Selesaikan 100 latihan finger training.', 'finger_training', '🔮', '{"type": "finger_count", "min": 100}'),

-- Accuracy
('Accuracy 95%', 'Selesaikan test dengan akurasi ≥95%.', 'accuracy', '🎯', '{"type": "accuracy", "min": 95}'),
('Accuracy Master', 'Selesaikan 20 test dengan akurasi ≥98%.', 'accuracy', '🎯🎯', '{"type": "accuracy_count", "min": 20, "min_accuracy": 98}'),

-- Competition
('10 Competitions Played', 'Ikuti 10 kompetisi multiplayer.', 'competition', '🏁', '{"type": "comp_count", "min": 10}'),
('30 Competitions Played', 'Ikuti 30 kompetisi multiplayer.', 'competition', '🚩', '{"type": "comp_count", "min": 30}'),
('50 Competitions Played', 'Ikuti 50 kompetisi multiplayer.', 'competition', '🎌', '{"type": "comp_count", "min": 50}');
