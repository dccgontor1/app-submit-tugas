-- ============================================================
-- Text Practice Feature — Database Setup
-- Run this in phpMyAdmin > typing_master database
-- ============================================================

-- 1. Practice Texts table
CREATE TABLE IF NOT EXISTS Practice_Texts (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    title      VARCHAR(255)                    NOT NULL,
    content    TEXT                            NOT NULL,
    language   ENUM('en','id','ar')            NOT NULL DEFAULT 'id',
    difficulty ENUM('easy','medium','hard')    NOT NULL DEFAULT 'medium',
    is_active  TINYINT(1)                      NOT NULL DEFAULT 1,
    created_at TIMESTAMP                       DEFAULT CURRENT_TIMESTAMP
);

-- 2. Practice Results table  
CREATE TABLE IF NOT EXISTS Practice_Results (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT              NOT NULL,
    practice_text_id INT              NOT NULL,
    wpm              DECIMAL(6,2)     DEFAULT 0,
    accuracy         DECIMAL(5,2)     DEFAULT 0,
    errors           INT              DEFAULT 0,
    time_seconds     INT              DEFAULT 0,
    created_at       TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)          REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (practice_text_id) REFERENCES Practice_Texts(id) ON DELETE CASCADE
);

-- 3. Sample texts — English (easy)
INSERT INTO Practice_Texts (title, content, language, difficulty) VALUES
('The Quick Brown Fox', 'The quick brown fox jumps over the lazy dog. This simple sentence contains every letter of the alphabet at least once. It is often used for typing practice and font display purposes.', 'en', 'easy'),
('About Technology', 'Technology is rapidly changing the way we live and work. From smartphones to artificial intelligence, new innovations appear every day. Learning to adapt to these changes is an important skill for the modern world.', 'en', 'medium'),
('The Internet Age', 'The internet has transformed human communication in ways that were unimaginable just a few decades ago. Billions of people around the globe can now share information, connect with others, and access knowledge instantly from almost any location on Earth.', 'en', 'hard');

-- 4. Sample texts — Indonesian (id)
INSERT INTO Practice_Texts (title, content, language, difficulty) VALUES
('Keindahan Alam Indonesia', 'Indonesia adalah negara kepulauan yang memiliki keindahan alam luar biasa. Dari pantai berpasir putih hingga hutan tropis yang lebat, setiap sudut negeri ini menyimpan pesona yang tak ternilai harganya.', 'id', 'easy'),
('Perkembangan Teknologi', 'Perkembangan teknologi informasi di era modern ini berjalan sangat pesat. Berbagai inovasi baru hadir setiap harinya untuk memudahkan kehidupan manusia. Kita dituntut untuk terus belajar dan beradaptasi agar tidak tertinggal.', 'id', 'medium'),
('Budaya Nusantara', 'Indonesia merupakan negara yang kaya akan budaya dan tradisi. Terdapat lebih dari tiga ratus suku bangsa yang masing-masing memiliki adat istiadat, bahasa daerah, seni pertunjukan, dan kuliner khas yang unik. Keragaman ini menjadi kekayaan bangsa yang harus dijaga dan dilestarikan oleh setiap generasi.', 'id', 'hard');

-- 5. Sample texts — Arabic (ar)  
INSERT INTO Practice_Texts (title, content, language, difficulty) VALUES
('جمال اللغة العربية', 'اللغة العربية من أجمل لغات العالم وأكثرها ثراءً. تتميز بقواعدها الدقيقة ومفرداتها الغنية التي تعبر عن أدق المشاعر والمعاني.', 'ar', 'easy'),
('التكنولوجيا الحديثة', 'تتطور التكنولوجيا بسرعة كبيرة في عصرنا الحالي. أصبح الذكاء الاصطناعي حاضراً في كثير من جوانب حياتنا اليومية، من الهواتف الذكية إلى السيارات ذاتية القيادة. يجب أن نتعلم كيفية التعامل مع هذه التغيرات بفاعلية.', 'ar', 'medium');
