# Promotional Content for HSK 4 Mock Exam Open Source Project

---

## 1. Reddit Post — r/ChineseLanguage

**Title:** I open-sourced 12 complete HSK 4 mock exams (1,176 questions) — free JSON data for practice apps, Anki decks, or self-study

**Body:**

Hey everyone! I run a Chinese language school in Beijing (Mandarin Zone, since 2008), and I've been creating HSK mock exams for our students for years.

I decided to open-source all of our HSK 4 practice tests — **12 complete exams with 1,176 questions** covering:

- 听力 Listening (true/false + multiple choice, with audio file references)
- 阅读 Reading (fill-in-the-blank, sentence ordering, comprehension)
- 书写 Writing (multiple choice)

Everything is in clean JSON format, so you can:
- Build your own practice app
- Import into Anki or other flashcard tools
- Use it for NLP/language research
- Just study directly from the data

**Try it online:** [link to GitHub Pages demo]

**GitHub repo:** [link]

The data is licensed under CC BY-NC-SA 4.0, so you're free to use and adapt it for non-commercial purposes.

If you find any errors or want to contribute, PRs are welcome! I'm also planning to add HSK 3 and HSK 5 tests later.

加油！🇨🇳

---

## 2. Reddit Post — r/languagelearning

**Title:** Open-sourced 1,176 HSK 4 (Chinese proficiency) practice questions — free dataset for learners and app developers

**Body:**

I teach Chinese in Beijing and I've put together 12 complete HSK Level 4 mock exams over the years. Instead of keeping them behind our school's website, I decided to open-source everything.

**What's HSK 4?** It's the intermediate level of China's official Chinese proficiency test. Passing it means you can have conversations on a wide range of topics and understand ~1,200 vocabulary words.

**What's included:**
- 12 full practice tests (100 questions each)
- Listening, reading, and writing sections
- Answer keys for every question
- Audio file references for listening sections
- Everything in structured JSON — easy to use in any app

**Live demo:** [GitHub Pages link]
**Repo:** [GitHub link]

I hope this helps fellow Chinese learners! If there's interest, I'll add more levels (HSK 3, 5, 6).

---

## 3. Reddit Post — r/LearnChinese

**Title:** Free HSK 4 practice tests — 12 complete mock exams open-sourced on GitHub

**Body:**

大家好! I'm sharing 12 complete HSK 4 mock exams that I created for my students at Mandarin Zone (my Chinese school in Beijing).

All 1,176 questions are available for free in JSON format on GitHub, with an online demo where you can take the tests directly in your browser.

The tests follow the real HSK 4 exam format:
- Part 1: 听力 Listening (判断对错 + 选择题)
- Part 2: 阅读 Reading (选词填空 + 排列语句 + 阅读理解)  
- Part 3: 书写 Writing

**Take a test now:** [demo link]
**Get the data:** [GitHub link]

Good luck with your HSK prep! 祝你们考试顺利！

---

## 4. DEV.to Article

**Title:** How I Open-Sourced 1,000+ Chinese Exam Questions from WordPress to GitHub

**Tags:** opensource, education, webdev, chinese

**Body:**

I run [Mandarin Zone](https://mandarinzone.com), a Chinese language school in Beijing. Over the years, I built 12 complete HSK 4 mock exams using the AYS Quiz Maker WordPress plugin for our students to practice online.

Recently, I decided to open-source all of this content. Here's how I extracted 1,176 questions from a WordPress database and turned them into a clean, developer-friendly GitHub repository.

### The Challenge

Our quiz data was locked inside WordPress — stored across multiple database tables (`aysquiz_questions`, `aysquiz_answers`, `aysquiz_quizzes`) with HTML-embedded content, base64 images, and WordPress shortcodes for audio files.

### The Extraction

**Step 1: SQL Export**

I wrote targeted SQL queries to join the questions, answers, and quiz mapping tables:

```sql
SELECT 
    q.id AS question_id,
    q.question AS question_text,
    q.type AS question_type,
    a.answer AS answer_text,
    a.correct AS is_correct,
    a.ordering AS answer_order
FROM aysquiz_questions q
LEFT JOIN aysquiz_answers a ON a.question_id = q.id
ORDER BY q.id, a.ordering;
```

**Step 2: Data Cleaning**

The raw data had WordPress shortcodes like `[audio wav="..."][/audio]` and HTML entities everywhere. I wrote a Python script to:

- Extract audio URLs from shortcodes
- Strip HTML tags while preserving Chinese text
- Map question types based on content patterns
- Group answers by question ID

**Step 3: Structured JSON**

Each test became a clean JSON file:

```json
{
  "quiz_id": 2,
  "title": "HSK 4 Sample Quiz",
  "questions": [
    {
      "number": 1,
      "type": "listening_true_false",
      "audio": "https://media.mandarinzone.com/.../hsk4-1-02.wav",
      "options": ["对", "错"],
      "correct_answer_index": 0
    }
  ]
}
```

### The Result

- **12 complete HSK 4 mock exams** in JSON format
- **6 question types**: listening true/false, listening choice, fill-in-blank, sentence ordering, reading comprehension, and general choice
- **GitHub Pages demo** where anyone can take the tests online
- **CC BY-NC-SA 4.0** license — free for non-commercial use

### What You Can Build With This

- A mobile HSK practice app
- Anki flashcard decks
- NLP training data for Chinese language models
- Your own quiz platform

Check out the repo: **[github.com/Make-dream-clear/hsk4-mock-exam](https://github.com/Make-dream-clear/hsk4-mock-exam)**

If you're learning Chinese or building language learning tools, I hope this helps. PRs welcome!

---

## 5. Awesome Chinese Learning PR

**PR Title:** Add HSK 4 Mock Exam open-source practice tests

**PR Body:**

Hi! I'd like to add [HSK 4 Mock Exam](https://github.com/Make-dream-clear/hsk4-mock-exam) to the list.

It's a collection of 12 complete HSK 4 practice tests (1,176 questions) in structured JSON format, with an online demo. Covers listening, reading, and writing sections with answer keys.

Created by [Mandarin Zone](https://mandarinzone.com), a Chinese language school in Beijing since 2008.

**Suggested addition to the README** (under a "Practice Tests" or "HSK" section):

```markdown
- [HSK 4 Mock Exam](https://github.com/Make-dream-clear/hsk4-mock-exam) - 12 complete HSK 4 practice tests with 1,176 questions in JSON format. Listening, reading, and writing sections with answer keys. [Online demo](https://hsk4.mandarinzone.com/).
```

---

## 6. Hacker News (Show HN)

**Title:** Show HN: 12 open-source HSK 4 Chinese proficiency mock exams (1,176 questions in JSON)

**Body:**

I run a Chinese language school and open-sourced our HSK 4 practice test database: 12 complete exams, 1,176 questions, structured JSON.

GitHub: [link]
Live demo: [link]

Question types include listening (with audio URLs), reading comprehension, fill-in-the-blank, and sentence ordering. Everything follows the official HSK 4 exam format.

Built by extracting data from WordPress (AYS Quiz Maker plugin) → SQL → Python → clean JSON. The whole extraction and transformation process might be interesting if you're dealing with similar WordPress-to-static-data migrations.

CC BY-NC-SA 4.0 licensed.

---

## Posting Schedule Suggestion

| Day | Platform | Post |
|-----|----------|------|
| Day 1 | GitHub | Create repo, enable GitHub Pages |
| Day 1 | DEV.to | Publish article |
| Day 2 | Reddit r/ChineseLanguage | Post (highest value audience) |
| Day 2 | Reddit r/LearnChinese | Post |
| Day 3 | Reddit r/languagelearning | Post |
| Day 3 | Hacker News | Show HN post |
| Day 4 | awesome-chinese-learning | Submit PR |
| Day 7 | V2EX / 知乎 | Chinese dev community posts |

**Tips:**
- Post on Reddit Tuesday-Thursday mornings (US time) for best visibility
- Hacker News: post around 8-9 AM EST
- Don't cross-post on the same day — space them out
- Engage with every comment — this is critical for Reddit algorithm
- On DEV.to, add a custom canonical URL pointing to your GitHub Pages
