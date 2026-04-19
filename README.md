# Cyber Quiz 🔐

אתר קוויזים אינטראקטיבי בעברית לקורס **אבטחת מידע וסייבר**. כל מצגת מהקורס מקבלת קוויז משלה עם שאלות תרחיש, מסבירים, ומצבי תרגול מגוונים.

## ✨ יכולות

- **5 מצבי תרגול:** תרגול (משוב מיידי), מבחן (עם טיימר), "רק שאלות שטעיתי", כרטיסי זיכרון, מהיר (10 שאלות)
- **תמיכה מלאה ב-RTL** וגופנים עבריים מודרניים (Heebo/Rubik)
- **ערכות צבעים פר-קוויז** — 6 פלטות מובנות (Cyberpunk, Matrix, Ocean, Sunset, Forest, Midnight)
- **Dark Mode כברירת מחדל** — נוח לעיניים בלמידת לילה
- **התקדמות נשמרת מקומית** (LocalStorage בלבד — אין שרת, אין מעקב)
- **מותאם לנייד ומחשב**
- **אפס תלות build** — HTML/CSS/JS טהורים, פשוט להרחיב

## 🚀 הפעלה מקומית

ES Modules דורשים HTTP (לא `file://`). הפעל שרת סטטי מתוך תיקיית הפרויקט:

```bash
# אפשרות 1: Python (מובנה בדרך כלל)
python -m http.server 8000

# אפשרות 2: Node
npx serve .

# אפשרות 3: PHP
php -S localhost:8000
```

פתח ב-`http://localhost:8000`.

## 📁 מבנה הפרויקט

```
cyber-quiz/
├── index.html              # דשבורד — רשימת קוויזים
├── quiz.html               # עמוד ריצת קוויז
├── css/
│   ├── base.css            # reset, RTL, גופנים, dark mode
│   ├── themes.css          # ערכות צבעים (CSS variables)
│   ├── components.css      # כרטיסים, כפתורים, progress bar
│   └── modes.css           # עיצוב פר-מצב (practice/exam/flashcards)
├── js/
│   ├── quiz-engine.js      # מנוע ליבה (state + events)
│   ├── quiz-loader.js      # טעינה + validation של JSON
│   ├── ui.js               # רינדור DOM
│   ├── modes.js            # הגדרת ולוגיקה של מצבים
│   ├── storage.js          # LocalStorage helpers
│   ├── theme.js            # החלת ערכת צבעים
│   ├── dashboard.js        # entry-point ל-index.html
│   └── quiz-page.js        # entry-point ל-quiz.html
├── data/
│   ├── index.json          # רישום כל הקוויזים
│   └── quizzes/
│       └── quiz-XX.json    # קובץ נתונים לכל קוויז
└── assets/                 # תמונות, favicon
```

## ➕ הוספת קוויז חדש

1. צור קובץ `data/quizzes/quiz-XX-topic.json` לפי הסכמה:

```json
{
  "quizId": "quiz-02-encryption",
  "title": "הצפנה סימטרית וא-סימטרית",
  "color": { "primary": "#...", "secondary": "#...", "accent": "#..." },
  "totalQuestions": 30,
  "questions": [
    {
      "id": 1,
      "type": "scenario",
      "difficulty": "hard",
      "topic": "AES",
      "question": "...",
      "options": ["א", "ב", "ג", "ד"],
      "correctIndex": 2,
      "explanation": "...",
      "source": "שקף 17"
    }
  ]
}
```

2. הוסף רשומה ב-`data/index.json`:

```json
{
  "id": "quiz-02-encryption",
  "title": "הצפנה סימטרית וא-סימטרית",
  "presentationNumber": 2,
  "file": "data/quizzes/quiz-02-encryption.json",
  "theme": "matrix",
  "difficulty": "intermediate",
  "estimatedMinutes": 20,
  "questionCount": 30
}
```

3. הקובץ יופיע אוטומטית בדשבורד בטעינה הבאה.

### כללי כתיבת שאלות

- **תמיד 4 אפשרויות תשובה** — לא פחות, לא יותר
- כל אפשרות חייבת להיות **סבירה ולא זהה לאחרות**
- `explanation` — 2-4 משפטים שמסבירים למה התשובה נכונה ולמה האחרות לא
- `source` — הפניה לשקף/מקור ("שקף 17", "סעיף 3.2")
- עודד שאלות תרחיש ושאלות שלילה ("איזה מהבאים **אינו**") — הן מחזקות הבנה

## 🎨 ערכות צבעים

שש פלטות מובנות ב-`data/index.json` → `themes`:

| שם | ראשי | מוטיב |
|-----|-------|-------|
| `cyberpunk` | ורוד ניאון | אנרגטי, רגיל |
| `matrix` | ירוק CRT | האקרי, טכני |
| `ocean` | כחול ים | רגוע, ידידותי |
| `sunset` | כתום־זהב | חם, נעים |
| `forest` | ירוק יער | טבעי |
| `midnight` | סגול חצות | מסתורי |

קוויז יכול גם לדרוס את הצבעים דרך שדה `color` בקובץ ה-JSON שלו.

## 🏗️ ארכיטקטורה

### Data-driven
הוספת קוויז חדש = הוספת קובץ JSON. אין צורך לגעת בקוד. המנוע generic על הסכמה.

### Event-driven engine
`QuizEngine` הוא state machine שפולט אירועים (`question-changed`, `answer-submitted`, `quiz-completed`). שכבת ה-UI מאזינה ומעדכנת את ה-DOM. הפרדה נקייה = קל להוסיף analytics/sound/etc.

### CSS Variables
כל הצבעים מוגדרים כ-CSS variables ב-`:root` וב-theme classes. החלפת ערכה = החלפת class ב-`<body>`. אין re-render של JS.

### LocalStorage בלבד
כל המידע האישי (התקדמות, ציונים, שאלות שגויות) נשמר רק בדפדפן. **אין שרת, אין backend, אין מעקב**.

## 🌐 פריסה ל-GitHub Pages

1. צור ריפו ב-GitHub
2. הוסף remote ו-push:
   ```bash
   git remote add origin https://github.com/USERNAME/cyber-quiz.git
   git branch -M main
   git push -u origin main
   ```
3. ב-GitHub: **Settings → Pages → Source:** `Deploy from a branch` → `main` → `/ (root)`
4. האתר יהיה זמין ב-`https://USERNAME.github.io/cyber-quiz/` תוך 1-2 דקות

## 📄 רישיון

MIT — ראה [LICENSE](LICENSE).
