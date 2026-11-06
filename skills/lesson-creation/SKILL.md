# Lesson Creation Skill

## Purpose
Create interactive, voice-enabled lesson pages for exam preparation courses. Each lesson includes:
- Voice-over narration using Web Speech API
- Scroll-based section highlighting
- 10+ MCQ quizzes with instant feedback
- Coding exercises with specific guidance (no solutions)
- Dark theme with modern UI

## When to Use
- User wants to create a crash course for exam prep
- User needs interactive lessons with voice-over
- User wants structured learning with quizzes and exercises
- User is preparing for technical exams (programming, etc.)

## Course Structure

### File Organization
```
learning/
├── material/
│   ├── index.html          # Course hub with links to all lessons
│   ├── course.css          # Shared styles (dark theme, voice controls, highlights)
│   ├── course.js           # Shared JS (voice engine, quiz logic, scroll tracking)
│   ├── 01_topic.html       # Lesson 1
│   ├── 02_topic.html       # Lesson 2
│   └── ...                 # Additional lessons
└── [project files]         # Actual code project for exercises
```

### Lesson Page Template
Each lesson page follows this structure:
1. **Voice Controls Bar** (sticky at top)
   - Voice selector dropdown
   - Play Section / Play All / Stop buttons
   - Speed control (number input)
   - Status display

2. **Content Sections** (multiple per page)
   - Each section has `class="section"` and `id="sec-N"`
   - Content elements have `class="tutor-element"` and `data-voice="text to speak"`
   - Code examples use `<pre>` with syntax highlighting spans
   - Analogies use `class="analogy"` with 💡 icon

3. **Quiz Section** (at end of lesson)
   - `class="quiz"` container
   - 10+ MCQ questions with `class="quiz-question"`
   - Each question has `class="mcq"` with `data-correct="letter"`
   - Options use `class="mcq-option"` with radio inputs
   - Answer feedback divs: `.answer` (correct) and `.answer.wrong`

4. **Coding Exercise Section** (after quiz)
   - `class="section"` container
   - "What to Build" list with specific class/method names
   - No implementation code - just requirements
   - "When You're Done" prompt to return to chat

5. **Navigation Links** (at bottom)
   - Previous lesson link
   - Next lesson link

## Key Features

### Voice-Over System
- Uses Web Speech API (browser built-in)
- Auto-selects UK English female voice if available
- Speed control (0.5x to 3x)
- Highlights current element being spoken
- Scrolls to keep current element centered

### Scroll-Based Highlighting
- Tracks which section is in viewport center
- Adds `active-section` class to current section
- Visual indicator: thicker colored border
- Updates automatically on scroll

### Quiz System
- MCQ format with radio buttons
- Instant feedback on selection
- Correct answer highlighted in green
- Wrong answer highlighted in red
- Voice reads the explanation after selection
- Options lock after answering

### Coding Exercises
- Lists specific classes, methods, properties to create
- No implementation code provided
- User must figure out the implementation
- Return to chat for code review and feedback

## Workflow
1. **Learn** - Open lesson page, hit "Play All" to hear narration with highlights
2. **Quiz** - Answer 10+ MCQs at bottom of page
3. **Code** - Complete coding exercise in project files
4. **Check** - Return to chat, say "I finished the exercise"
5. **Feedback** - Tutor reviews code and provides feedback
6. **Next** - Move to next lesson

## Implementation Steps

### Step 1: Create Shared Files
Create `course.css` and `course.js` with:
- Dark theme styling
- Voice controls bar
- Section/quiz highlighting
- MCQ quiz logic
- Scroll tracking
- Voice synthesis engine

### Step 2: Create Index Page
Create `index.html` with:
- Course title and description
- "Start Course" button
- List of all lessons grouped by phase/module
- Workflow explanation

### Step 3: Create Lesson Pages
For each lesson:
1. Copy template structure
2. Add content sections with `data-voice` attributes
3. Add 10+ MCQ questions
4. Add coding exercise with specific requirements
5. Add navigation links

### Step 4: Test
- Open index.html in browser
- Test voice-over on each lesson
- Verify scroll highlighting works
- Test quiz functionality
- Ensure navigation links work

## Content Guidelines

### Lesson Content
- Break into logical sections (3-6 per lesson)
- Each section should be 2-5 minutes of narration
- Include code examples with syntax highlighting
- Use analogies to explain complex concepts
- Keep text concise - voice will read it

### Quiz Questions
- Minimum 10 questions per lesson
- Mix of conceptual and practical questions
- Clear correct/wrong feedback messages
- Cover all major concepts from the lesson

### Coding Exercises
- List specific classes, methods, properties to create
- Include method signatures where helpful
- Don't provide implementation code
- Make requirements clear and specific
- Reference files/locations in project

## Customization

### For Different Subjects
- Adjust color scheme in `course.css` if needed
- Modify quiz question format for non-coding subjects
- Replace coding exercises with appropriate practice tasks
- Adjust voice text for subject-specific terminology

### For Different Levels
- Beginner: More analogies, simpler exercises
- Intermediate: Balance of theory and practice
- Advanced: Focus on complex scenarios, minimal hand-holding

## Example Usage

```
User: "I have a Java exam in 2 weeks. Can you create a crash course?"

Tutor: "I'll create an interactive lesson course with voice-over, quizzes, and coding exercises. Let me start by creating the shared files and then build out each lesson."

[Creates course structure]
[Creates lesson pages with content]
[Tests functionality]

Tutor: "Your course is ready! Open index.html to start. Each lesson has voice-over, 10+ quiz questions, and a coding exercise. Work through them in order, and come back to chat after each exercise for code review."
```

## Files to Reference
- `course.css` - shared styles
- `course.js` - shared behaviour
- `index.html` - course index
- `01_book_class.html` - one lesson, used as the template

Keep those files in the course directory. Do not hard-code a machine-specific path.

## Notes
- Voice quality depends on browser and OS voice packs
- Chrome/Edge have best Web Speech API support
- Works offline (no server needed)
- All files are static HTML/CSS/JS
- Can be opened directly from file system
