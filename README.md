# HSK 4 Mock Exam — Free Online Practice Tests with Answers

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![HSK Level](https://img.shields.io/badge/HSK-Level%204-red)](https://mandarinzone.com)
[![Tests](https://img.shields.io/badge/Tests-12%20Complete%20Exams-blue)]()
[![Questions](https://img.shields.io/badge/Questions-1%2C176-green)]()

**12 complete HSK 4 mock exams** with listening, reading, and writing sections — structured JSON data, ready to use in your app, flashcard tool, or study workflow.

12 套完整的 HSK 4 模拟试题，涵盖听力、阅读、书写三大部分，JSON 格式，可直接用于 App 开发、刷题工具或学习系统。

> Created by [**Mandarin Zone**](https://mandarinzone.com) — A Chinese language school in Beijing since 2008, with 5,000+ students from 40+ countries and a 98% HSK pass rate.

---

## Why This Dataset?

- **Complete exam simulation**: Each test has 100 questions following the real HSK 4 exam format
- **Structured data**: Clean JSON format, easy to parse in any programming language
- **Audio references**: Listening questions include URLs to audio files
- **Answer key included**: Every question has the correct answer marked
- **Free and open**: Use it in your app, study tool, or research project

## Quick Start

```bash
git clone https://github.com/Make-dream-clear/hsk4-mock-exam.git
```

```python
import json

with open('data/test-01.json', encoding='utf-8') as f:
    test = json.load(f)

for q in test['questions']:
    print(f"Q{q['number']}: {q.get('text', '[Audio Question]')}")
    for i, opt in enumerate(q['options']):
        marker = '✓' if i == q['correct_answer_index'] else ' '
        print(f"  [{marker}] {opt}")
```

## Test Overview

| File | Title | Questions |
|------|-------|-----------|
| [`test-01.json`](data/test-01.json) | HSK 4 Sample Quiz | 100 |
| [`test-02.json`](data/test-02.json) | HSK 4 Mock Test Series 2 | 100 |
| [`test-03.json`](data/test-03.json) | HSK 4 Mock Exam H41002 | 100 |
| [`test-04.json`](data/test-04.json) | HSK 4 Mock Exam Series 4 | 100 |
| [`test-05.json`](data/test-05.json) | HSK 4 Mock Exam Series 5 | 100 |
| [`test-06.json`](data/test-06.json) | HSK 4 Mock Exam Series 6 | 100 |
| [`test-07.json`](data/test-07.json) | HSK 4 Mock Test Series 7 | 76 |
| [`test-08.json`](data/test-08.json) | HSK 4 Mock Test Series 8 | 100 |
| [`test-09.json`](data/test-09.json) | HSK 4 Mock Test Series 9 | 100 |
| [`test-10.json`](data/test-10.json) | HSK 4 Mock Test Series 10 | 100 |
| [`test-11.json`](data/test-11.json) | HSK 4 Mock Test Series 11 | 100 |
| [`test-12.json`](data/test-12.json) | HSK 4 Mock Test Series 12 | 100 |

## Question Types

Each test follows the official HSK 4 exam structure:

| Type | Section | Description |
|------|---------|-------------|
| `listening_true_false` | Listening 听力 | Listen to a statement and judge true (对) or false (错) |
| `listening_choice` | Listening 听力 | Listen to a dialogue and choose the correct answer |
| `fill_in_blank` | Reading 阅读 | Choose the correct word to fill in the blank |
| `reading_ordering` | Reading 阅读 | Arrange sentences in the correct order |
| `reading_comprehension` | Reading 阅读 | Read a passage and answer the question |
| `choice` | Writing 书写 | General multiple choice |

## Data Schema

```json
{
  "quiz_id": 2,
  "title": "HSK 4 SAMPLE QUIZ",
  "source": "Mandarin Zone (mandarinzone.com)",
  "total_questions": 100,
  "questions": [
    {
      "number": 1,
      "original_id": 405,
      "type": "listening_true_false",
      "audio": "https://media.mandarinzone.com/wp-content/uploads/2025/07/hsk4-1-02.wav",
      "text": "",
      "options": ["对", "错"],
      "correct_answer_index": 0
    }
  ]
}
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `number` | `int` | Question number within the test (1-100) |
| `original_id` | `int` | Original database ID |
| `type` | `string` | Question type (see table above) |
| `audio` | `string?` | Audio file URL (listening questions only) |
| `image` | `string?` | Image URL (if applicable) |
| `text` | `string?` | Question text content |
| `options` | `string[]` | Answer options |
| `correct_answer_index` | `int` | Index of correct answer in `options` array (0-based) |

## Audio Files

Listening comprehension questions include audio file URLs hosted on Mandarin Zone's CDN. The `audio` field contains the direct URL. Audio files are not included in this repository due to size.

## Use Cases

This dataset can be used to:

- **Build a quiz app** — Mobile or web-based HSK practice app
- **Create Anki decks** — Convert questions to spaced-repetition flashcards
- **Train NLP models** — Chinese language understanding and question answering
- **Research** — Study HSK exam patterns and question design
- **Self-study** — Practice for the HSK 4 exam

## About HSK 4

The HSK (汉语水平考试 / Hanyu Shuiping Kaoshi) is the standardized Chinese proficiency test recognized worldwide. HSK Level 4 certifies that you can:

- Discuss a wide range of topics in Chinese with fluency
- Communicate comfortably with native Chinese speakers
- Understand approximately 1,200 vocabulary words

Learn more about HSK preparation at [Mandarin Zone](https://mandarinzone.com).

## Related Resources

- [Online HSK 4 Practice Tests](https://mandarinzone.com) — Take these tests online with full audio support
- [HSK 4 Vocabulary List](https://mandarinzone.com) — Complete word list for HSK 4
- [Learn Chinese Online](https://mandarinzone.com) — 1-on-1 online Chinese classes

## Contributing

Contributions are welcome! You can help by:

- Reporting errors in questions or answers
- Adding translations or explanations
- Building apps or tools using this data
- Improving the data schema

Please open an issue or submit a pull request.

## License

This work is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

You are free to share and adapt this material for non-commercial purposes, as long as you give appropriate credit to [Mandarin Zone](https://mandarinzone.com) and distribute your contributions under the same license.

---

**Made with ❤️ by [Mandarin Zone](https://mandarinzone.com) — Learn Chinese in Beijing & Online since 2008**
