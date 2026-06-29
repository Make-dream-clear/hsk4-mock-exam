# HSK 4 Mock Exam — Free Online Practice Tests with Answers

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![HSK Level](https://img.shields.io/badge/HSK-Level%204-red)](https://mandarinzone.com)
[![Tests](https://img.shields.io/badge/Tests-15%20Exam%20Sets-blue)]()
[![Questions](https://img.shields.io/badge/Questions-1%2C475-green)]()

**15 HSK 4 mock and official exam sets** with listening, reading, and writing sections — structured JSON data, ready to use in your app, flashcard tool, or study workflow.

15 套 HSK 4 模拟/官方试题，涵盖听力、阅读、书写三大部分，JSON 格式，可直接用于 App 开发、刷题工具或学习系统。

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
| [`test-13.json`](data/test-13.json) | HSK 4 Official Exam H41220 | 100 |
| [`test-14.json`](data/test-14.json) | HSK 4 Official Exam H41221 | 100 |
| [`test-15.json`](data/test-15.json) | HSK 4 Official Exam H41327 | 100 |

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
| `writing_construction` | Writing 书写 | Construct a sentence from a picture prompt and keyword |

## Data Schema

```json
{
  "quiz_id": 13,
  "title": "HSK 4 Official Exam H41220",
  "source": "Hanban / Confucius Institute Headquarters",
  "official": true,
  "total_questions": 100,
  "listening_audio": "/test/13/listening.mp3",
  "questions": [
    {
      "number": 1,
      "type": "listening_true_false",
      "transcript": "今天天气非常好，我们去植物园了。那儿的花儿都开了，非常漂亮，大家玩儿得很高兴，还照了很多照片。",
      "text": "1. 他们去逛植物园了。",
      "options": ["对", "错"],
      "correct_answer_index": 0
    }
  ]
}
```

### Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `quiz_id` | `int` | Test number within the collection |
| `title` | `string` | Human-readable test title |
| `source` | `string` | Source attribution |
| `official` | `boolean?` | Marks official-paper datasets |
| `total_questions` | `int` | Expected question count for the test |
| `listening_audio` | `string?` | Continuous full-section listening audio path for official papers |

### Question Fields

| Field | Type | Description |
|-------|------|-------------|
| `number` | `int` | Question number within the test (1-100) |
| `original_id` | `int` | Original database ID |
| `type` | `string` | Question type (see table above) |
| `audio` | `string?` | Audio file URL (listening questions only) |
| `transcript` | `string?` | Listening transcript text for official-paper listening questions |
| `image` | `string?` | Image URL (if applicable) |
| `text` | `string?` | Question text content |
| `options` | `string[]` | Answer options |
| `correct_answer_index` | `int` | Index of correct answer in `options` array (0-based) |

## Audio Files

Most listening comprehension questions include audio file URLs hosted on Mandarin Zone's CDN. Official papers that ship a continuous exam recording use `listening_audio`; for example, `test-13` (H41220), `test-14` (H41221), and `test-15` (H41327) include local MP3 files under their `test/NN/` folders.

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
