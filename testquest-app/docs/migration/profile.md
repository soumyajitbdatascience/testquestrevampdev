# Legacy Table Profile

Generated 2026-05-25T11:40:47.369Z

Profile of 27 migration-relevant tables.

## TOC
- [languages](#languages)
- [general_setting](#general_setting)
- [catigories](#catigories)
- [catigories_description](#catigories_description)
- [subcategories](#subcategories)
- [subcategories_description](#subcategories_description)
- [subjects](#subjects)
- [subjects_description](#subjects_description)
- [main_exam](#main_exam)
- [main_exam_description](#main_exam_description)
- [main_exam_to_question](#main_exam_to_question)
- [main_exam_status](#main_exam_status)
- [question](#question)
- [question_description](#question_description)
- [question_audio_video_paragraph](#question_audio_video_paragraph)
- [descriptive_question](#descriptive_question)
- [descriptive_question_description](#descriptive_question_description)
- [descriptive_main_exam](#descriptive_main_exam)
- [descriptive_main_exam_description](#descriptive_main_exam_description)
- [practice_exam](#practice_exam)
- [practice_exam_description](#practice_exam_description)
- [practice_exam_to_question](#practice_exam_to_question)
- [student](#student)
- [student_subject_selection](#student_subject_selection)
- [main_exam_result](#main_exam_result)
- [practice_exam_result](#practice_exam_result)
- [descriptive_main_exam_result](#descriptive_main_exam_result)

---

## Quick scorecard

### Languages defined

| ID | Name | Status |
|---|---|---|
| undefined | undefined | undefined |
| undefined | undefined | undefined |

### Question types in `question` table

**answer_type distribution:**

| Value | Count |
|---|---:|
| 101 | 18,013 |
| 102 | 10,217 |

**question_type distribution:**

| Value | Count |
|---|---:|
| 505 | 17,986 |
| 504 | 10,210 |
| 507 | 19 |
| 502 | 6 |
| 501 | 5 |
| 503 | 4 |

### `question_description` rows per language (`languages_id`)

| Language ID | Rows |
|---|---:|
| 3 | 28,227 |
| 2 | 10,165 |

### Subjects: deduplication signal

Top duplicated subject names (suggests same subject across SubCategories):

| Name | Occurrences |
|---|---:|
| Life Process | 28 |
| Probability | 20 |
| Coordinate Geometry | 20 |
| Heredity & Evolution | 18 |
| How do Organism Reproduce | 16 |
| DIVERSITY IN LIVING WORLD | 14 |
| Statistics | 14 |
| Control & Coordination | 14 |
| Coding Decoding | 12 |
| Number Series | 12 |

## Table profiles

### languages

**2 rows** · 6 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `languages_id` | int | NO | — | PRI |
| `name` | varchar | NO | '' | MUL |
| `code` | char | NO | '' | — |
| `image` | varchar | YES | NULL | — |
| `directory` | varchar | YES | NULL | — |
| `sort_order` | int | YES | NULL | — |

**Sample row:**

```json
{
  "languages_id": 2,
  "name": "Hindi",
  "code": "HI",
  "image": "icon.gif",
  "directory": "hindi",
  "sort_order": 2
}
```

### general_setting

**1 rows** · 59 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `g_id` | int | NO | — | PRI |
| `g_title` | varchar | NO | — | — |
| `g_description` | varchar | NO | — | — |
| `g_keywords` | varchar | NO | — | — |
| `g_organization` | varchar | NO | — | — |
| `g_copyright` | varchar | NO | — | — |
| `g_logo` | varchar | NO | — | — |
| `g_favicon` | varchar | NO | — | — |
| `g_address` | varchar | NO | — | — |
| `g_phone` | varchar | NO | — | — |
| `g_email` | varchar | NO | — | — |
| `g_url` | varchar | NO | — | — |
| `g_google_analytics` | varchar | NO | — | — |
| `g_certificate_logo` | varchar | NO | — | — |
| `g_certificate_content` | varchar | NO | — | — |
| `g_signature` | varchar | NO | — | — |
| `g_text_signature` | varchar | NO | — | — |
| `g_timezone` | varchar | NO | — | — |
| `desby` | varchar | NO | — | — |
| `g_smtp_host_name` | varchar | NO | — | — |
| `g_smtp_user_name` | varchar | NO | — | — |
| `g_smtp_password` | varchar | NO | — | — |
| `g_smtp_port` | varchar | NO | — | — |
| `g_enable_smtp_authentication` | varchar | NO | — | — |
| `g_smtp_secure` | varchar | NO | — | — |
| `g_smtp_from_mail` | varchar | NO | — | — |
| `g_language_default_name` | varchar | NO | — | — |
| `g_language_default_code` | varchar | NO | — | — |
| `g_language_default_id` | int | NO | — | — |
| `g_language_default_directory` | varchar | NO | — | — |
| `g_currency_default_name` | varchar | NO | — | — |
| `g_currency_default_code` | varchar | NO | — | — |
| `g_currency_default_id` | int | NO | — | — |
| `g_currency_default_symbol` | varchar | NO | — | — |
| `MerchantSalt` | varchar | NO | — | — |
| `MerchantKey` | varchar | NO | — | — |
| `paypalURL` | varchar | NO | — | — |
| `paypalID` | varchar | NO | — | — |
| `front_student_register_status` | int | NO | — | — |
| `front_center_register_status` | int | NO | — | — |
| `Home_Page_Status` | int | NO | 0 | — |
| `g_day_time` | varchar | NO | — | — |
| `g_faculty_button` | int | NO | 1 | — |
| `g_center_button` | int | NO | 1 | — |
| `g_student_button` | int | NO | 1 | — |
| `g_website_logo` | varchar | NO | — | — |
| `g_about_us` | text | NO | — | — |
| `g_whatsapp_popup_status` | int | NO | — | — |
| `g_whatsapp_popup_effect` | int | NO | — | — |
| `student_reg_wallet_promo_status` | int | NO | — | — |
| `student_reg_wallet_promo_amount` | decimal | NO | — | — |
| `g_flip_book_menu_download` | int | NO | — | — |
| `g_flip_book_menu_prev_page` | int | NO | — | — |
| `g_flip_book_menu_next_page` | int | NO | — | — |
| `g_flip_book_menu_zoom_in` | int | NO | — | — |
| `g_flip_book_menu_zoom_out` | int | NO | — | — |
| `g_flip_book_menu_zoom_auto` | int | NO | — | — |
| `g_flip_book_menu_show_all_pages` | int | NO | — | — |
| `g_flip_book_menu_full_normal_screen` | int | NO | — | — |

**Sample row:**

```json
{
  "g_id": 1,
  "g_title": "TestQuest - E-learning Platform",
  "g_description": "Online exam software and assessment tool that assists educational institutions t…",
  "g_keywords": "Online Exam Software | Assessment tool",
  "g_organization": "TestQuest",
  "g_copyright": "TestQuest eLearning Pvt Ltd All rights reserved.",
  "g_logo": "testquest-logo-200px.png",
  "g_favicon": "tagged.png",
  "g_address": "Bhubaneswar Odisha",
  "g_phone": "9322811116",
  "g_email": "sm@testquest.in",
  "g_url": "https://testquest.in",
  "g_google_analytics": "UA-1111111-1",
  "g_certificate_logo": "testquest-logo-200px.png",
  "g_certificate_content": "Not for use",
  "g_signature": "text-1683742860329.png",
  "g_text_signature": "Authorized Signatory<br>TestQuest eLearning Pvt Ltd",
  "g_timezone": "Asia/Kolkata",
  "desby": "63.30.78.112.109.98.115.97.114.30.109.100.30.82.99.118.114.115.113.30.71.108.114…",
  "g_smtp_host_name": "smtpout.secureserver.net",
  "g_smtp_user_name": "sm@testquest.in",
  "g_smtp_password": "NEduQuest1234",
  "g_smtp_port": "587",
  "g_enable_smtp_authentication": "true",
  "g_smtp_secure": "SSL",
  "g_smtp_from_mail": "sm@testquest.in",
  "g_language_default_name": "English",
  "g_language_default_code": "EN",
  "g_language_default_id": 3,
  "g_language_default_directory": "english",
  "g_currency_default_name": "Indian rupee",
  "g_currency_default_code": "INR",
  "g_currency_default_id": 1,
  "g_currency_default_symbol": "Rs",
  "MerchantSalt": "cotiEADzzB",
  "MerchantKey": "zPLdPoaS",
  "paypalURL": "https://www.sandbox.paypal.com/cgi-bin/webscr",
  "paypalID": "gkhanjan@gmail.com",
  "front_student_register_status": 1,
  "front_center_register_status": 1,
  "Home_Page_Status": 1,
  "g_day_time": "Monday - Friday 10:00AM-5:00PM",
  "g_faculty_button": 1,
  "g_center_button": 1,
  "g_student_button": 1,
  "g_website_logo": "testquest-logo-200px.png",
  "g_about_us": "TestQuest eLearning Pv. Ltd is an online platform to help you prepare for cracki…",
  "g_whatsapp_popup_status": 1,
  "g_whatsapp_popup_effect": 4,
  "student_reg_wallet_promo_status": 1,
  "student_reg_wallet_promo_amount": "0",
  "g_flip_book_menu_download": 0,
  "g_flip_book_menu_prev_page": 1,
  "g_flip_book_menu_next_page": 1,
  "g_flip_book_menu_zoom_in": 1,
  "g_flip_book_menu_zoom_out": 1,
  "g_flip_book_menu_zoom_auto": 1,
  "g_flip_book_menu_show_all_pages": 1,
  "g_flip_book_menu_full_normal_screen": 1
}
```

### catigories

**21 rows** · 2 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `categories_id` | int | NO | — | PRI |
| `categories_status` | int | NO | 0 | — |

**Sample row:**

```json
{
  "categories_id": 25,
  "categories_status": 1
}
```

### catigories_description

**42 rows** · 3 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `categories_id` | int | NO | — | — |
| `languages_id` | int | NO | — | — |
| `categories_name` | varchar | NO | — | — |

**Sample row:**

```json
{
  "categories_id": 34,
  "languages_id": 3,
  "categories_name": "OLYMPIAD"
}
```

### subcategories

**56 rows** · 6 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `subcategories_id` | int | NO | — | PRI |
| `subcategories_status` | int | NO | — | — |
| `subjects_id` | varchar | NO | — | — |
| `categories_id` | int | NO | — | — |
| `subcategory_icon` | varchar | NO | — | — |
| `page_name` | varchar | NO | — | — |

**Sample row:**

```json
{
  "subcategories_id": 68,
  "subcategories_status": 1,
  "subjects_id": "43,42",
  "categories_id": 33,
  "subcategory_icon": "",
  "page_name": ""
}
```

### subcategories_description

**112 rows** · 3 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `subcategories_id` | int | NO | — | — |
| `languages_id` | int | NO | — | — |
| `subcategories_name` | varchar | NO | — | — |

**Sample row:**

```json
{
  "subcategories_id": 171,
  "languages_id": 2,
  "subcategories_name": "Pre-Foundation Mathematics"
}
```

### subjects

**817 rows** · 7 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `subjects_id` | int | NO | — | PRI |
| `subjects_status` | int | NO | — | — |
| `Temp_Subject_Name` | varchar | NO | — | — |
| `catg_name` | varchar | YES | NULL | — |
| `course_name` | varchar | YES | NULL | — |
| `chapter_name` | varchar | YES | NULL | — |
| `chapter_title` | varchar | YES | NULL | — |

**Sample row:**

```json
{
  "subjects_id": 42,
  "subjects_status": 1,
  "Temp_Subject_Name": "",
  "catg_name": null,
  "course_name": null,
  "chapter_name": null,
  "chapter_title": null
}
```

### subjects_description

**1,850 rows** · 4 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `subjects_id` | int | NO | — | — |
| `languages_id` | int | NO | — | — |
| `subject_name` | varchar | NO | — | — |
| `subject_description` | varchar | NO | — | — |

**Sample row:**

```json
{
  "subjects_id": 7,
  "languages_id": 2,
  "subject_name": "Hisabati",
  "subject_description": ""
}
```

### main_exam

**376 rows** · 16 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `exam_id` | int | NO | — | PRI |
| `category_id` | int | NO | — | MUL |
| `subcategories_id` | int | NO | — | MUL |
| `subject_choose` | varchar | NO | — | — |
| `subject_id` | varchar | NO | — | — |
| `exam_date` | date | NO | — | MUL |
| `exam_duration` | varchar | NO | — | — |
| `passing_percentage` | varchar | NO | — | — |
| `re_exam_day` | int | NO | 0 | — |
| `neg_mark_status` | int | NO | 0 | — |
| `negative_marks` | varchar | YES | '0' | — |
| `result_show_on_mail` | int | NO | 0 | — |
| `after_exam_show_result` | int | NO | 0 | — |
| `exam_status` | int | NO | 0 | MUL |
| `sale_exam_without_packages_status` | int | NO | 0 | — |
| `exam_price` | decimal | NO | 0.00 | — |

**Sample row:**

```json
{
  "exam_id": 48,
  "category_id": 33,
  "subcategories_id": 68,
  "subject_choose": "42",
  "subject_id": "42",
  "exam_date": "2023-06-11T00:00:00.000Z",
  "exam_duration": "90",
  "passing_percentage": "30",
  "re_exam_day": 5,
  "neg_mark_status": 1,
  "negative_marks": "-1",
  "result_show_on_mail": 1,
  "after_exam_show_result": 1,
  "exam_status": 1,
  "sale_exam_without_packages_status": 1,
  "exam_price": "0"
}
```

### main_exam_description

**417 rows** · 4 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `exam_id` | int | NO | — | MUL |
| `languages_id` | int | NO | — | MUL |
| `exam_name` | varchar | NO | — | — |
| `terms_condition` | text | NO | — | — |

**Sample row:**

```json
{
  "exam_id": 51,
  "languages_id": 3,
  "exam_name": "NEET - Chemistry - Level 1 - Mole Concept",
  "terms_condition": "None"
}
```

### main_exam_to_question

**14,670 rows** · 11 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `main_exam_to_question_id` | int | NO | — | PRI |
| `exam_id` | int | NO | — | — |
| `question_id` | int | NO | — | — |
| `subjects_id` | int | NO | — | — |
| `sub_question_id` | int | NO | — | — |
| `total_options` | int | NO | — | — |
| `correct_answer` | varchar | NO | — | — |
| `Marks` | int | NO | — | — |
| `answer_type` | int | NO | — | — |
| `difficulty_leve` | varchar | NO | — | — |
| `question_type` | int | NO | — | — |

**Sample row:**

```json
{
  "main_exam_to_question_id": 1598,
  "exam_id": 48,
  "question_id": 227,
  "subjects_id": 42,
  "sub_question_id": 0,
  "total_options": 4,
  "correct_answer": "",
  "Marks": 4,
  "answer_type": 101,
  "difficulty_leve": "Easy",
  "question_type": 505
}
```

### main_exam_status

**520 rows** · 29 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `id` | int | NO | — | PRI |
| `category_id` | int | NO | — | — |
| `subcategory_id` | int | NO | — | — |
| `subject_choose` | varchar | NO | — | — |
| `subject_id` | varchar | NO | — | — |
| `exam_id` | int | NO | — | MUL |
| `center_id` | int | NO | — | — |
| `student_id` | int | NO | — | MUL |
| `exam_date` | date | NO | — | — |
| `status` | int | NO | — | — |
| `noofattemps` | int | NO | — | — |
| `user_score` | decimal | YES | NULL | — |
| `passing_score` | decimal | YES | NULL | — |
| `total_score` | decimal | YES | NULL | — |
| `total_question` | int | YES | NULL | — |
| `neg_mark_status` | int | YES | NULL | — |
| `negative_mark` | int | YES | 0 | — |
| `negative_marks_total` | decimal | NO | 0.00 | — |
| `wrong_answer` | int | YES | NULL | — |
| `correct_answer` | int | YES | NULL | — |
| `correct_answer_marks` | decimal | NO | 0.00 | — |
| `nogiven_answer` | int | YES | NULL | — |
| `exam_start_time` | datetime | NO | — | — |
| `exam_finish_time` | time | NO | — | — |
| `exam_finish_time_duplicate` | varchar | NO | — | — |
| `on_exam_spend_time_by_children` | varchar | NO | — | — |
| `exam_finish_time_by_children` | datetime | NO | '1978-07-31 00:00:00' | — |
| `student_rank` | int | NO | — | — |
| `token` | varchar | NO | — | — |

**Sample row:**

```json
{
  "id": 44,
  "category_id": 15,
  "subcategory_id": 15,
  "subject_choose": "31",
  "subject_id": "25,24,31",
  "exam_id": 47,
  "center_id": 18,
  "student_id": 21,
  "exam_date": "2022-07-11T00:00:00.000Z",
  "status": 2,
  "noofattemps": 1,
  "user_score": "0",
  "passing_score": "10",
  "total_score": "101",
  "total_question": 49,
  "neg_mark_status": 0,
  "negative_mark": 0,
  "negative_marks_total": "0",
  "wrong_answer": 0,
  "correct_answer": 0,
  "correct_answer_marks": "0",
  "nogiven_answer": 0,
  "exam_start_time": "2022-07-11T14:44:18.000Z",
  "exam_finish_time": "1970-01-01T15:23:18.000Z",
  "exam_finish_time_duplicate": "Jul 11, 2022 15:23:18",
  "on_exam_spend_time_by_children": "2022-07-11 14:44:19",
  "exam_finish_time_by_children": "2022-07-11T14:44:26.000Z",
  "student_rank": 0,
  "token": "cadfb394856a23f73b6605e62088111cc5c4bffd"
}
```

### question

**28,230 rows** · 12 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `question_id` | int | NO | — | PRI |
| `subjects_id` | int | NO | — | — |
| `difficulty_level` | varchar | NO | — | — |
| `total_questions` | int | NO | — | — |
| `answer_type` | int | NO | — | — |
| `question_type` | int | NO | — | — |
| `total_options` | int | NO | — | — |
| `question_status` | int | NO | — | — |
| `center_id` | int | NO | 0 | — |
| `create_by` | int | NO | 0 | — |
| `approval` | int | NO | 0 | — |
| `Migrated_QID` | int | NO | — | — |

**Sample row:**

```json
{
  "question_id": 107,
  "subjects_id": 31,
  "difficulty_level": "Hard",
  "total_questions": 3,
  "answer_type": 102,
  "question_type": 502,
  "total_options": 4,
  "question_status": 1,
  "center_id": 0,
  "create_by": 0,
  "approval": 0,
  "Migrated_QID": 0
}
```

### question_description

**38,392 rows** · 4 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `question_id` | int | NO | — | — |
| `subjects_id` | int | NO | — | — |
| `languages_id` | int | NO | — | — |
| `main_question` | text | NO | — | — |

**Sample row:**

```json
{
  "question_id": 0,
  "subjects_id": 0,
  "languages_id": 3,
  "main_question": "7688"
}
```

### question_audio_video_paragraph

**38,447 rows** · 16 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `id` | int | NO | — | PRI |
| `question_id` | int | NO | — | — |
| `subjects_id` | int | NO | — | — |
| `languages_id` | int | NO | — | — |
| `sub_question_id` | int | NO | — | — |
| `sub_question` | text | NO | — | — |
| `hint` | text | NO | — | — |
| `explanation` | text | NO | — | — |
| `options_1` | text | NO | — | — |
| `options_2` | text | NO | — | — |
| `options_3` | text | NO | — | — |
| `options_4` | text | NO | — | — |
| `options_5` | text | NO | — | — |
| `options_6` | text | NO | — | — |
| `Marks` | int | NO | — | — |
| `correct_answer` | varchar | NO | — | — |

**Sample row:**

```json
{
  "id": 421,
  "question_id": 107,
  "subjects_id": 31,
  "languages_id": 3,
  "sub_question_id": 1,
  "sub_question": "<p>video multi selection</p>\r\n",
  "hint": "<p>video multi selection</p>\r\n",
  "explanation": "<p>video multi selection</p>\r\n",
  "options_1": "<p>video multi selection</p>\r\n",
  "options_2": "<p>video multi selection</p>\r\n",
  "options_3": "<p>video multi selection</p>\r\n",
  "options_4": "<p>video multi selection</p>\r\n",
  "options_5": "",
  "options_6": "",
  "Marks": 2,
  "correct_answer": "1,2,,,,"
}
```

### descriptive_question

**237 rows** · 6 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `question_id` | int | NO | — | PRI |
| `subjects_id` | int | NO | — | — |
| `answer_type` | int | NO | 104 | — |
| `question_status` | int | NO | — | — |
| `Marks` | decimal | NO | — | — |
| `Migrated_QID` | int | NO | — | — |

**Sample row:**

```json
{
  "question_id": 12,
  "subjects_id": 31,
  "answer_type": 104,
  "question_status": 1,
  "Marks": "1",
  "Migrated_QID": 0
}
```

### descriptive_question_description

**242 rows** · 5 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `question_id` | int | NO | — | — |
| `question` | text | NO | — | — |
| `answer` | text | NO | — | — |
| `languages_id` | int | NO | — | — |
| `subjects_id` | int | NO | — | — |

**Sample row:**

```json
{
  "question_id": 13,
  "question": "<p>gsdgsdgsdfg</p>\r\n",
  "answer": "<p>sdfgsdfgdsfg</p>\r\n",
  "languages_id": 3,
  "subjects_id": 31
}
```

### descriptive_main_exam

**2 rows** · 13 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `exam_id` | int | NO | — | PRI |
| `category_id` | int | NO | — | — |
| `subcategories_id` | int | NO | — | — |
| `subject_choose` | varchar | NO | — | — |
| `exam_date` | date | NO | — | — |
| `exam_time` | varchar | NO | — | — |
| `exam_duration` | varchar | NO | — | — |
| `passing_percentage` | varchar | NO | — | — |
| `re_exam_day` | int | NO | 0 | — |
| `exam_status` | int | NO | 0 | — |
| `display_result_date` | date | NO | — | — |
| `faculty_id` | int | NO | — | — |
| `questions_id` | varchar | NO | — | — |

**Sample row:**

```json
{
  "exam_id": 12,
  "category_id": 15,
  "subcategories_id": 15,
  "subject_choose": "31",
  "exam_date": "2022-07-11T00:00:00.000Z",
  "exam_time": "16:13",
  "exam_duration": "30",
  "passing_percentage": "12",
  "re_exam_day": 0,
  "exam_status": 1,
  "display_result_date": "2022-07-11T00:00:00.000Z",
  "faculty_id": 6,
  "questions_id": "13,12,14"
}
```

### descriptive_main_exam_description

**4 rows** · 4 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `exam_id` | int | NO | — | — |
| `languages_id` | int | NO | — | — |
| `exam_name` | varchar | NO | — | — |
| `terms_condition` | text | NO | — | — |

**Sample row:**

```json
{
  "exam_id": 12,
  "languages_id": 3,
  "exam_name": "Bank Insurance",
  "terms_condition": "Our lead generation company reduces the pressure on your sales team by \r\ncoverin…"
}
```

### practice_exam

**8 rows** · 15 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `exam_id` | int | NO | — | PRI |
| `center_id` | int | NO | — | — |
| `category_id` | int | NO | — | — |
| `subcategories_id` | int | NO | — | — |
| `subject_choose` | varchar | NO | — | — |
| `subject_id` | varchar | NO | — | — |
| `exam_date` | date | NO | — | — |
| `exam_duration` | varchar | NO | — | — |
| `passing_percentage` | varchar | NO | — | — |
| `re_exam_day` | int | NO | 0 | — |
| `neg_mark_status` | int | NO | 0 | — |
| `negative_marks` | varchar | YES | '0' | — |
| `result_show_on_mail` | int | NO | 0 | — |
| `after_exam_show_result` | int | NO | 0 | — |
| `exam_status` | int | NO | 0 | — |

**Sample row:**

```json
{
  "exam_id": 23,
  "center_id": 18,
  "category_id": 15,
  "subcategories_id": 15,
  "subject_choose": "31",
  "subject_id": "25,24,31",
  "exam_date": "2022-07-12T00:00:00.000Z",
  "exam_duration": "44",
  "passing_percentage": "10",
  "re_exam_day": 1,
  "neg_mark_status": 0,
  "negative_marks": "",
  "result_show_on_mail": 0,
  "after_exam_show_result": 1,
  "exam_status": 1
}
```

### practice_exam_description

**16 rows** · 5 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `exam_id` | int | NO | — | — |
| `center_id` | int | NO | — | — |
| `languages_id` | int | NO | — | — |
| `exam_name` | varchar | NO | — | — |
| `terms_condition` | text | NO | — | — |

**Sample row:**

```json
{
  "exam_id": 23,
  "center_id": 18,
  "languages_id": 3,
  "exam_name": "fdsfasdf",
  "terms_condition": "sadfasdfasfd"
}
```

### practice_exam_to_question

**6 rows** · 12 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `main_exam_to_question_id` | int | NO | — | PRI |
| `center_id` | int | NO | — | — |
| `exam_id` | int | NO | — | — |
| `question_id` | int | NO | — | — |
| `subjects_id` | int | NO | — | — |
| `sub_question_id` | int | NO | — | — |
| `total_options` | int | NO | — | — |
| `correct_answer` | varchar | NO | — | — |
| `Marks` | int | NO | — | — |
| `answer_type` | int | NO | — | — |
| `difficulty_leve` | varchar | NO | — | — |
| `question_type` | int | NO | — | — |

**Sample row:**

```json
{
  "main_exam_to_question_id": 220,
  "center_id": 18,
  "exam_id": 23,
  "question_id": 113,
  "subjects_id": 31,
  "sub_question_id": 0,
  "total_options": 3,
  "correct_answer": "2",
  "Marks": 5,
  "answer_type": 101,
  "difficulty_leve": "Easy",
  "question_type": 507
}
```

### student

**1,376 rows** · 34 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `student_id` | int | NO | — | PRI |
| `category_id` | int | NO | — | — |
| `subcategories_id` | varchar | YES | NULL | — |
| `first_name` | varchar | NO | — | — |
| `second_name` | varchar | NO | — | — |
| `surname_name` | varchar | NO | — | — |
| `birth_date` | varchar | NO | — | — |
| `mobile_no` | varchar | NO | — | — |
| `address` | varchar | NO | — | — |
| `country` | int | NO | — | — |
| `state` | int | NO | — | — |
| `city` | int | YES | 0 | — |
| `center_id` | int | NO | — | — |
| `email_address` | varchar | NO | — | — |
| `username` | varchar | NO | — | — |
| `password` | varchar | NO | — | — |
| `encrypt_password` | varchar | NO | — | — |
| `status` | int | NO | — | — |
| `payment_status` | int | YES | 0 | — |
| `student_language_default_name` | varchar | NO | — | — |
| `student_language_default_code` | varchar | NO | — | — |
| `student_language_default_id` | int | NO | — | — |
| `student_language_default_directory` | varchar | NO | — | — |
| `registration_date` | varchar | NO | — | — |
| `account_number` | varchar | NO | — | — |
| `mail_activation` | int | NO | 0 | — |
| `avatar` | varchar | NO | — | — |
| `school_name` | varchar | YES | NULL | — |
| `gender` | varchar | YES | NULL | — |
| `country_name` | varchar | YES | NULL | — |
| `state_name` | varchar | YES | NULL | — |
| `city_name` | varchar | YES | NULL | — |
| `password_reset_token` | varchar | YES | NULL | — |
| `password_reset_expires` | datetime | YES | NULL | — |

**Sample row:**

```json
{
  "student_id": 544,
  "category_id": 45,
  "subcategories_id": "0",
  "first_name": "Gd",
  "second_name": "",
  "surname_name": "Sc",
  "birth_date": "2008-02-04",
  "mobile_no": "",
  "address": "",
  "country": 99,
  "state": 1498,
  "city": 0,
  "center_id": 31,
  "email_address": "gdgoenkabbsr@gmail.com",
  "username": "",
  "password": "Class10",
  "encrypt_password": "$2y$10$aCVvbCQlC0THB.BcEGj4QegnVKCCTfG3ZFp3VhU9k2tqTgiiEgQcW",
  "status": 1,
  "payment_status": 0,
  "student_language_default_name": "English",
  "student_language_default_code": "en",
  "student_language_default_id": 3,
  "student_language_default_directory": "english",
  "registration_date": "2024-11-08 09:36:33",
  "account_number": "1232434000",
  "mail_activation": 1,
  "avatar": "",
  "school_name": null,
  "gender": null,
  "country_name": null,
  "state_name": null,
  "city_name": null,
  "password_reset_token": null,
  "password_reset_expires": null
}
```

### student_subject_selection

**37 rows** · 3 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `student_id` | int | NO | — | PRI |
| `subject_ids` | varchar | NO | '' | — |
| `updated_at` | timestamp | NO | current_timestamp() | — |

**Sample row:**

```json
{
  "student_id": 1965,
  "subject_ids": "323",
  "updated_at": "2026-03-02T14:34:58.000Z"
}
```

### main_exam_result

**9,933 rows** · 14 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `exam_result_id` | int | NO | — | PRI |
| `exam_id` | int | NO | — | MUL |
| `student_id` | int | NO | — | MUL |
| `center_id` | int | NO | — | — |
| `subjects_id` | int | NO | — | — |
| `question_id` | int | NO | — | — |
| `sub_question_id` | int | NO | — | — |
| `user_answer` | varchar | NO | — | — |
| `correct_answer` | varchar | NO | — | — |
| `result` | int | NO | — | — |
| `Marks` | int | NO | — | — |
| `exam_given_date` | date | NO | — | MUL |
| `main_exam_status_id` | int | NO | — | — |
| `token` | varchar | NO | — | — |

**Sample row:**

```json
{
  "exam_result_id": 1954,
  "exam_id": 47,
  "student_id": 21,
  "center_id": 18,
  "subjects_id": 31,
  "question_id": 220,
  "sub_question_id": 0,
  "user_answer": "2",
  "correct_answer": "2",
  "result": 1,
  "Marks": 5,
  "exam_given_date": "2022-07-13T00:00:00.000Z",
  "main_exam_status_id": 45,
  "token": "80f220b298c887f6e59f938f7bfd3e7ab1b52315"
}
```

### practice_exam_result

**12 rows** · 14 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `exam_result_id` | int | NO | — | PRI |
| `exam_id` | int | NO | — | — |
| `student_id` | int | NO | — | — |
| `center_id` | int | NO | — | — |
| `subjects_id` | int | NO | — | — |
| `question_id` | int | NO | — | — |
| `sub_question_id` | int | NO | — | — |
| `user_answer` | varchar | NO | — | — |
| `correct_answer` | varchar | NO | — | — |
| `result` | int | NO | — | — |
| `Marks` | int | NO | — | — |
| `exam_given_date` | date | NO | — | — |
| `practice_exam_status_id` | int | NO | — | — |
| `token` | varchar | NO | — | — |

**Sample row:**

```json
{
  "exam_result_id": 407,
  "exam_id": 24,
  "student_id": 21,
  "center_id": 18,
  "subjects_id": 25,
  "question_id": 112,
  "sub_question_id": 0,
  "user_answer": "1,2,,,,",
  "correct_answer": "1,2,,,,",
  "result": 1,
  "Marks": 2,
  "exam_given_date": "2022-07-13T00:00:00.000Z",
  "practice_exam_status_id": 78,
  "token": "bbcf3c2f4db2699554b412cc8c33a718cab2f930"
}
```

### descriptive_main_exam_result

**3 rows** · 13 columns

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `exam_result_id` | int | NO | — | PRI |
| `exam_id` | int | NO | — | — |
| `student_id` | int | NO | — | — |
| `center_id` | int | NO | — | — |
| `subjects_id` | int | NO | — | — |
| `question_id` | int | NO | — | — |
| `user_answer` | text | NO | — | — |
| `obtain_marks` | decimal | NO | — | — |
| `student_language_id` | int | NO | — | — |
| `exam_given_date` | date | NO | — | — |
| `main_exam_status_id` | int | NO | — | — |
| `token` | varchar | NO | — | — |
| `remarks` | text | NO | — | — |

**Sample row:**

```json
{
  "exam_result_id": 84,
  "exam_id": 12,
  "student_id": 21,
  "center_id": 18,
  "subjects_id": 31,
  "question_id": 13,
  "user_answer": "In this article we have included all the details regarding NCERT Solutions for C…",
  "obtain_marks": "4",
  "student_language_id": 2,
  "exam_given_date": "2022-07-11T00:00:00.000Z",
  "main_exam_status_id": 62,
  "token": "c2e9071907615f3a255570c0f69ca4f119b681d1",
  "remarks": "Good Answer<br>"
}
```

