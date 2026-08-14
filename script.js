// ==========================================
// 🛑 YOUR GOOGLE SHEET CSV LINK
// ==========================================
const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQi3wglj0KY9gukaN6oVdot2tKiUEWcfxXi_0ZSO3QUttnUz2UriGxceXnHk9Sm25I7L-7MwbPzK9Rt/pub?gid=0&single=true&output=csv";

let allQuestions = [];
let currentPendingQuestions = [];
let currentTopicQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let currentGrade = ''; 
let currentTopic = '';
let timerInterval;
let secondsElapsed = 0;
let audioCtx;
let userAnswers = {}; // Tracks answers per question index

// ==========================================
// 📡 DEDICATED STUDENT SCORES WEB APP URL
// ==========================================
const SCORES_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwJDMf8gsj6p_krmPhhnGiMJuse-K3hVp4nnq3BsdMItIGlY9SIN_ICvZmJngllfh_XbQ/exec"; 

let currentStudentName = "Guest Student";

// --- GAMIFICATION STATE ---
let currentStreak = 0;
let totalXP = 0;
let playerLevel = 1;

// --- STUDENT NAME MODAL CONTROLS ---
function checkStudentName() {
    const savedName = localStorage.getItem("math_portal_student_name");
    if (savedName && savedName.trim() !== '') {
        currentStudentName = savedName.trim();
        updateNameHUD();
    } else {
        openNameModal();
    }
}

function openNameModal() {
    const modal = document.getElementById('name-modal');
    const input = document.getElementById('student-name-input');
    if (modal) {
        if (input) input.value = currentStudentName !== "Guest Student" ? currentStudentName : "";
        modal.classList.remove('hidden');
        setTimeout(() => input && input.focus(), 150);
    }
}

function saveStudentName() {
    const input = document.getElementById('student-name-input');
    if (input && input.value.trim() !== '') {
        currentStudentName = input.value.trim();
        localStorage.setItem("math_portal_student_name", currentStudentName);
        updateNameHUD();
        
        const modal = document.getElementById('name-modal');
        if (modal) modal.classList.add('hidden');
    }
}

function updateNameHUD() {
    const nameDisplay = document.getElementById('hud-student-name');
    if (nameDisplay) {
        nameDisplay.innerText = currentStudentName;
    }
}

// --- SEND SCORES TO TAB 2 (Student_Scores) ---
function sendScoreToDatabase() {
    if (!SCORES_WEB_APP_URL || SCORES_WEB_APP_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE") {
        console.warn("Scores Web App URL not set.");
        return;
    }

    const payload = {
        studentName: currentStudentName,
        grade: currentGrade || "Mental Math",
        topic: currentTopic || "General",
        score: score,
        totalQuestions: currentTopicQuestions.length,
        xpEarned: totalXP,
        timeTaken: formatTime(secondsElapsed)
    };

    fetch(SCORES_WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).then(() => {
        console.log("Score logged successfully to Tab 2!");
    }).catch(err => {
        console.error("Score logging failed:", err);
    });
}

// Helper to get column data regardless of exact header casing/naming
function getChapterName(q) {
    return q.Chapter_Number_Name || q.Topic || q.topic || "";
}

function getViews() {
    return {
        loading: document.getElementById('loading-screen'),
        grade: document.getElementById('grade-view'),
        topic: document.getElementById('topic-view'),
        type: document.getElementById('type-view'),
        practice: document.getElementById('practice-view'),
        score: document.getElementById('score-view')
    };
}

function showView(viewName) {
    const views = getViews();
    Object.values(views).forEach(v => {
        if (v) v.classList.add('hidden');
    });
    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
    }
}

function playSound(type) {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        if (type === 'correct') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); 
            oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.1); 
            gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
        } else {
            oscillator.type = 'sine'; 
            oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.3);
        }
    } catch(e) {
        // Audio policy protection
    }
}

function preloadImages(questionsArray) {
    questionsArray.forEach(q => {
        if (q.Image_URL && q.Image_URL.trim() !== '') {
            const img = new Image();
            img.onerror = function() {
                console.warn("Skipping broken database image link:", q.Image_URL);
            };
            img.src = q.Image_URL.trim(); 
        }
    });
}

function init() {
    checkStudentName(); // Checks or prompts for student name

    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.classList.remove('hidden');

    Papa.parse(GOOGLE_SHEET_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            allQuestions = results.data;
            if (allQuestions.length === 0) {
                if (loadingScreen) loadingScreen.innerHTML = `<p class="text-red-600 font-bold text-2xl">Error: No questions found.</p>`;
                return;
            }
            preloadImages(allQuestions);
            showGrades();
        },
        error: function(error) {
            console.error("Database Error:", error);
            if (loadingScreen) loadingScreen.innerHTML = `<p class="text-red-600 font-bold text-xl mt-4">Error loading database.</p>`;
        }
    });
}

function showGrades() {
    const navGrades = document.getElementById('nav-back-grades');
    const navTopics = document.getElementById('nav-back-topics');
    if (navGrades) navGrades.classList.add('hidden');
    if (navTopics) navTopics.classList.add('hidden');

    // Filter out non-numeric values so "Mental Math" doesn't create a normal Grade button
    const grades = [...new Set(allQuestions.map(q => q.Grade || q.grade))]
        .filter(g => g !== null && g !== undefined && !isNaN(Number(g)) && String(g).trim() !== '')
        .map(g => Number(g))
        .sort((a, b) => a - b);
        
    const container = document.getElementById('grade-buttons');
    if (container) {
        container.innerHTML = '';
        grades.forEach(grade => {
            const btn = document.createElement('button');
            btn.className = 'bg-white border-4 border-blue-500 text-blue-700 hover:bg-blue-50 font-extrabold text-3xl py-6 px-6 rounded-2xl shadow-md transition-transform hover:-translate-y-1';
            btn.innerText = `Grade ${grade}`;
            btn.onclick = () => showTopics(grade);
            container.appendChild(btn);
        });
    }
    showView('grade');
}

// ==========================================
// ⚡ TAB SWITCHING FOR CHAPTERS & MENTAL MATH
// ==========================================
function switchTopicTab(tabName) {
    const chaptersBtn = document.getElementById('tab-chapters-btn');
    const mentalBtn = document.getElementById('tab-mental-btn');
    const chaptersContent = document.getElementById('tab-chapters-content');
    const mentalContent = document.getElementById('tab-mental-content');

    if (chaptersBtn && mentalBtn && chaptersContent && mentalContent) {
        if (tabName === 'chapters') {
            chaptersBtn.className = "bg-blue-600 text-white font-bold text-xl py-3 px-6 rounded-xl shadow-md transition-all";
            mentalBtn.className = "bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xl py-3 px-6 rounded-xl transition-all";
            chaptersContent.classList.remove('hidden');
            mentalContent.classList.add('hidden');
        } else {
            mentalBtn.className = "bg-purple-600 text-white font-bold text-xl py-3 px-6 rounded-xl shadow-md transition-all";
            chaptersBtn.className = "bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xl py-3 px-6 rounded-xl transition-all";
            chaptersContent.classList.add('hidden');
            mentalContent.classList.remove('hidden');
        }
    }
}

function showTopics(selectedGrade) {
    document.getElementById('nav-back-grades').classList.remove('hidden');
    document.getElementById('nav-back-topics').classList.add('hidden');
    currentGrade = selectedGrade; 
    document.getElementById('selected-grade-title').innerText = `Grade ${selectedGrade} - Select Chapter`;

    // 1. Reset tabs default view back to Chapters
    switchTopicTab('chapters');

    // 2. Update Grade number in Mental Math tab
    const mmGradeNum = document.getElementById('mental-math-grade-num');
    if (mmGradeNum) mmGradeNum.innerText = selectedGrade;

    const gradeQuestions = allQuestions.filter(q => q.Grade == selectedGrade);
    
    // Filter out 'Mental Math' from regular chapter list if present in CSV
    const topics = [...new Set(gradeQuestions.map(q => getChapterName(q)))]
        .filter(Boolean)
        .filter(t => t.toLowerCase().trim() !== 'mental math')
        .sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));   

    const container = document.getElementById('topic-buttons');
    container.innerHTML = '';
    container.className = "grid grid-cols-1 md:grid-cols-2 gap-4 w-full";
    topics.forEach(topic => {
        const btn = document.createElement('button');
        btn.className = 'flex items-center text-left bg-white border-l-8 border-blue-600 border-t border-r border-b border-slate-200 hover:border-blue-500 hover:bg-blue-50 p-5 rounded-r-xl shadow-sm transition-all hover:scale-[1.02]';
        btn.innerHTML = `
            <div class="bg-blue-100 text-blue-700 rounded-lg p-3 mr-4">
                <i class="fas fa-book-open text-xl"></i>
            </div>
            <span class="font-bold text-xl text-slate-800">${topic}</span>
        `;
        btn.onclick = () => showQuestionTypes(topic, gradeQuestions.filter(q => getChapterName(q) === topic));
        container.appendChild(btn);
    });
    showView('topic');
}

function showQuestionTypes(topic, questionsForTopic) {
    const navGrades = document.getElementById('nav-back-grades');
    const navTopics = document.getElementById('nav-back-topics');
    if (navGrades) navGrades.classList.add('hidden');
    if (navTopics) navTopics.classList.remove('hidden');

    currentTopic = topic;
    currentPendingQuestions = questionsForTopic;

    const topicTitle = document.getElementById('selected-topic-title');
    if (topicTitle) topicTitle.innerText = topic;

    const typeView = document.getElementById('type-view');
    const oldBox = document.getElementById('worksheet-box');
    if (oldBox) oldBox.remove();

    const cleanTopic = topic.replace(/[:]/g, '')
                             .replace(/\s+/g, '-')
                             .replace(/-+/g, '-')
                             .trim();
    const safeFileName = `G${currentGrade}-${cleanTopic}`;

    if (typeView) {
        const worksheetDiv = document.createElement('div');
        worksheetDiv.id = 'worksheet-box';
        worksheetDiv.className = "mt-8 p-4 bg-yellow-50 border-2 border-dashed border-yellow-400 rounded-xl flex items-center justify-between";
        worksheetDiv.innerHTML = `
            <div class="text-left">
                <h4 class="font-bold text-yellow-800 text-lg">Grade ${currentGrade} Worksheet</h4>
                <p class="text-yellow-700 text-sm">Download questions for ${topic}</p>
            </div>
            <a href="worksheets/${safeFileName}.pdf" download class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors">
                <i class="fas fa-file-pdf"></i> Download
            </a>
        `;
        typeView.appendChild(worksheetDiv);
    }
    showView('type');
}

function startPracticeFilter(selectedType) {
    let filteredQuestions = currentPendingQuestions;
    if (selectedType !== 'ALL') {
        filteredQuestions = currentPendingQuestions.filter(q => {
            const qTypeRaw = q.Question_Type || q.question_type || q['Question Type'] || 'MCQ';
            const qType = String(qTypeRaw).toUpperCase().trim();
            return qType === selectedType || (selectedType === 'TF' && qType === 'T/F');
        });
    }
    if (filteredQuestions.length === 0) {
        alert(`No ${selectedType} questions found for this chapter.`);
        return;
    }
    startPractice(filteredQuestions);
}

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateTimerDisplay() {
    secondsElapsed++;
    const timerEl = document.getElementById('timer-display');
    if (timerEl) timerEl.innerText = `⏱️ ${formatTime(secondsElapsed)}`;
}

function startMentalMath() {
    startMentalMathForGrade(currentGrade || 1);
}

function startMentalMathForGrade(grade) {
    // 1. Look for questions assigned to this grade with Chapter/Topic named "Mental Math"
    let mmQuestions = allQuestions.filter(q => {
        const isGrade = (q.Grade == grade || q.grade == grade);
        const chapter = getChapterName(q).toLowerCase();
        return isGrade && chapter.includes('mental math');
    });

    // 2. Fallback: If no specific "Mental Math" chapter exists for this grade, pull all questions for this grade
    if (mmQuestions.length === 0) {
        mmQuestions = allQuestions.filter(q => q.Grade == grade || q.grade == grade);
    }

    if (mmQuestions.length === 0) {
        alert(`No Mental Math questions found for Grade ${grade}.`);
        return;
    }

    currentTopic = `Grade ${grade} Mental Math`;
    currentPendingQuestions = mmQuestions;
    startPractice(mmQuestions);
}

// ============================================================
// 🎯 PRACTICE INITIATION
// ============================================================

function startPractice(questions) {
    currentTopicQuestions = questions;
    currentQuestionIndex = 0;
    score = 0;
    currentStreak = 0;
    userAnswers = {}; 
    
    // Timer setup
    if (timerInterval) clearInterval(timerInterval);
    secondsElapsed = 0;
    timerInterval = setInterval(updateTimerDisplay, 1000);

    updateScoreDisplay();
    showView('practice');
    loadQuestion();
}

function quitPractice() {
    if (typeof timerInterval !== 'undefined') clearInterval(timerInterval);
    
    if (currentGrade) {
        showTopics(currentGrade);
    } else {
        showGrades();
    }
}

function loadQuestion() {
    const q = currentTopicQuestions[currentQuestionIndex];
    
    const fb = document.getElementById('feedback-container');
    const nextBtn = document.getElementById('next-btn');
    if (fb) fb.classList.add('hidden');
    if (nextBtn) nextBtn.classList.add('hidden');

    const progText = document.getElementById('progress-text');
    if (progText) progText.innerText = `Question ${currentQuestionIndex + 1} of ${currentTopicQuestions.length}`;

    const qText = document.getElementById('question-text');
    if (qText) qText.innerText = q.Question_Text || q.question_text || q.Question || '';

    const imgElement = document.getElementById('question-image');
    if (imgElement) {
        if (q.Image_URL && q.Image_URL.trim() !== '') {
            imgElement.src = q.Image_URL.trim(); 
            imgElement.classList.remove('hidden'); 
        } else {
            imgElement.classList.add('hidden'); 
        }
    }

    const optionsContainer = document.getElementById('options-container');
    if (!optionsContainer) return;

    optionsContainer.innerHTML = '';
    const qTypeRaw = q.Question_Type || q.question_type || q['Question Type'] || 'MCQ';
    const qType = String(qTypeRaw).toUpperCase().trim();

    if (qType === 'MCQ') {
        optionsContainer.className = "grid grid-cols-1 sm:grid-cols-2 gap-4 w-full";
        [q.Option_A, q.Option_B, q.Option_C, q.Option_D].forEach(opt => {
            if (!opt) return; 
            const btn = document.createElement('button');
            btn.className = 'option-btn text-left bg-slate-50 border-4 border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-2xl font-bold py-5 px-6 rounded-xl w-full transition-colors';
            btn.innerText = opt;
            btn.onclick = () => checkAnswer(btn, opt, q.Correct_Answer, q.Explanation, 'MCQ');
            optionsContainer.appendChild(btn);
        });
    } else if (qType === 'TF' || qType === 'T/F') {
        optionsContainer.className = "grid grid-cols-1 sm:grid-cols-2 gap-4 w-full";
        ['True', 'False'].forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-btn text-center bg-slate-50 border-4 border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-2xl font-bold py-5 px-6 rounded-xl w-full transition-colors';
            btn.innerText = opt;
            btn.onclick = () => checkAnswer(btn, opt, q.Correct_Answer, q.Explanation, 'TF');
            optionsContainer.appendChild(btn);
        });
    } else if (qType === 'FIB') {
        optionsContainer.className = "block w-full";
        optionsContainer.innerHTML = `
            <input type="text" id="fib-input" placeholder="Type answer here..." class="w-full text-2xl font-bold py-5 px-6 rounded-xl border-4 border-slate-300 focus:border-blue-500 mb-4 text-center outline-none">
            <button id="fib-submit" class="w-full md:w-1/2 mx-auto block bg-blue-600 text-white font-bold py-4 rounded-xl text-xl shadow-md hover:bg-blue-700 transition-colors">Submit</button>
        `;
        const input = document.getElementById('fib-input');
        const sub = document.getElementById('fib-submit');
        if (sub && input) {
            sub.onclick = () => checkAnswer(null, input.value, q.Correct_Answer, q.Explanation, 'FIB');
            input.addEventListener('keypress', (e) => { if(e.key === 'Enter') sub.click(); });
            setTimeout(() => input.focus(), 100);
        }
    }
}

// ============================================================
// 🧹 ANSWER NORMALIZATION & EVALUATION
// ============================================================

// Helper to normalize strings for comparison (strips spaces, commas, casing)
function normalizeAnswer(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .toLowerCase()
        .replace(/,/g, '')      // Removes commas: "45,890" -> "45890"
        .replace(/\s+/g, '')     // Removes all spaces: "5 cm" -> "5cm", "45, 46" -> "4546"
        .trim();
}

// Checks if student answer matches DB answer (supports space/comma tolerance & multiple OR answers)
function isAnswerCorrect(userAns, correctAns, qType) {
    if (qType === 'FIB') {
        const normalizedUser = normalizeAnswer(userAns);
        
        // Allows multiple acceptable answers in DB split by '|' or '/' (e.g. "5 cm | 0.05 m")
        const acceptableAnswers = String(correctAns).split(/\||\//);
        
        return acceptableAnswers.some(ans => normalizeAnswer(ans) === normalizedUser);
    }
    
    // For MCQ & True/False, use standard trimmed lowercase comparison
    return String(userAns || '').trim().toLowerCase() === String(correctAns || '').trim().toLowerCase();
}

function checkAnswer(selectedBtn, selectedText, correctText, explanation, qType) {
    // 🛑 STOP: Ignore click if this question has already been answered
    if (userAnswers[currentQuestionIndex] !== undefined) return;

    // ✨ NEW: Smart matching for spaces, commas, and formatting
    const isCorrect = isAnswerCorrect(selectedText, correctText, qType);

    // 1. Lock Options based on Question Type
    if (qType === 'MCQ' || qType === 'TF') {
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.onclick = null; // Remove click handlers
            btn.classList.add('opacity-70');
            
            // Highlight the correct option in green
            if (String(btn.innerText).trim().toLowerCase() === String(correctText).trim().toLowerCase()) {
                btn.classList.remove('opacity-70', 'bg-slate-50', 'border-slate-200');
                btn.classList.add('bg-green-100', 'border-green-500', 'text-green-900');
            }
        });
    } else if (qType === 'FIB') {
        const input = document.getElementById('fib-input');
        const sub = document.getElementById('fib-submit');
        if (input) input.disabled = true;
        if (sub) {
            sub.disabled = true;
            sub.onclick = null;
            sub.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    // 2. Save the answer state
    userAnswers[currentQuestionIndex] = isCorrect;

    // 3. GAMIFICATION LOGIC
    if (isCorrect) {
        currentStreak++;
        const xpEarned = 10 + (currentStreak * 2); // Bonus XP for streaks
        totalXP += xpEarned;
        playerLevel = Math.floor(totalXP / 50) + 1;
    } else {
        currentStreak = 0; // Reset streak on mistake
    }

    score = Object.values(userAnswers).filter(isAns => isAns === true).length;
    updateScoreDisplay();

    const fb = document.getElementById('feedback-container');
    const fbMsg = document.getElementById('feedback-message');
    const expText = document.getElementById('explanation-text');
    const nextBtn = document.getElementById('next-btn');

    if (fb) {
        fb.classList.remove('hidden', 'bg-green-100', 'bg-red-100');
        if (isCorrect) {
            playSound('correct');
            fb.classList.add('bg-green-100');
            const streakBonusMsg = currentStreak > 1 ? ` 🔥 ${currentStreak}x Streak!` : '';
            if (fbMsg) fbMsg.innerText = `✅ Correct! (+${10 + (currentStreak * 2)} XP)${streakBonusMsg}`;
        } else {
            playSound('incorrect');
            fb.classList.add('bg-red-100');
            if (fbMsg) fbMsg.innerText = qType === 'FIB' ? `❌ Incorrect. Answer: ${correctText}` : '❌ Incorrect';
        }
    }

    if (expText) {
        expText.innerText = explanation ? `Explanation: ${explanation}` : '';
    }

    if (nextBtn) nextBtn.classList.remove('hidden');
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        loadQuestion();
    } else {
        alert("You are already on the first question!");
    }
}

function nextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentTopicQuestions.length) {
        loadQuestion();
    } else {
        showFinalScore();
    }
}

function updateScoreDisplay() {
    const curScore = document.getElementById('current-score');
    if (curScore) curScore.innerText = `Score: ${score}`;

    const hudScore = document.getElementById('hud-score');
    if (hudScore) hudScore.innerText = score;

    // Gamification HUD Updates (if elements exist in HTML)
    const xpDisplay = document.getElementById('hud-xp');
    if (xpDisplay) xpDisplay.innerText = `${totalXP} XP`;

    const levelDisplay = document.getElementById('hud-level');
    if (levelDisplay) levelDisplay.innerText = `Lvl ${playerLevel}`;

    const streakDisplay = document.getElementById('hud-streak');
    if (streakDisplay) streakDisplay.innerText = `🔥 ${currentStreak}`;
}

function triggerConfetti(options) {
    if (typeof confetti === 'function') {
        confetti(options);
    }
}

function showFinalScore() {
    if (timerInterval) clearInterval(timerInterval);

    // 📡 SILENTLY LOG STUDENT RESULTS TO YOUR DEDICATED SHEET
    sendScoreToDatabase();

    const finalScore = document.getElementById('final-score');
    if (finalScore) finalScore.innerText = score;

    const totalQuestions = document.getElementById('total-questions');
    if (totalQuestions) totalQuestions.innerText = currentTopicQuestions.length;

    const finalTime = document.getElementById('final-time');
    if (finalTime) finalTime.innerText = formatTime(secondsElapsed);

    showView('score');
    
    const badge = document.getElementById('celebration-badge');
    if (badge) {
        badge.className = "text-3xl font-black mb-6 px-6 py-3 rounded-2xl inline-block border-4 hidden";
    }

    const total = currentTopicQuestions.length;
    if (total > 0) {
        const percentage = (score / total) * 100;
        
        if (score === 0) {
            if (badge) {
                badge.innerText = "🎯 Give it another shot! 🎯";
                badge.classList.add('bg-slate-100', 'text-slate-600', 'border-slate-300');
                badge.classList.remove('hidden');
            }
        } else if (percentage === 100) {
            if (badge) {
                badge.innerText = "🏆 Grand Master 🏆";
                badge.classList.add('bg-yellow-100', 'text-yellow-700', 'border-yellow-400');
                badge.classList.remove('hidden');
            }
            triggerConfetti({ particleCount: 180, spread: 80, origin: { y: 0.6 } });
            setTimeout(() => {
                triggerConfetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
            }, 250);
            
        } else if (percentage >= 80) {
            if (badge) {
                badge.innerText = "🎉 High Achiever 🎉";
                badge.classList.add('bg-green-100', 'text-green-700', 'border-green-400');
                badge.classList.remove('hidden');
            }
            triggerConfetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
            
        } else if (percentage >= 50) {
            if (badge) {
                badge.innerText = "👍 Solid Effort 👍";
                badge.classList.add('bg-blue-100', 'text-blue-700', 'border-blue-400');
                badge.classList.remove('hidden');
            }
            triggerConfetti({ particleCount: 60, spread: 50, origin: { y: 0.6 } });
            
        } else {
            if (badge) {
                badge.innerText = "💪 Keep It Up! 💪";
                badge.classList.add('bg-orange-100', 'text-orange-700', 'border-orange-400');
                badge.classList.remove('hidden');
            }
            triggerConfetti({ particleCount: 25, spread: 35, origin: { y: 0.6 } });
        }
    }
}

function handleBackNavigation() {
    const v = getViews();
    if (v.practice && !v.practice.classList.contains('hidden')) quitPractice();
    else if (v.type && !v.type.classList.contains('hidden')) showTopics(currentGrade);
    else if (v.topic && !v.topic.classList.contains('hidden')) showGrades();
    else if (v.score && !v.score.classList.contains('hidden')) showTopics(currentGrade);
    else window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', init);

// Expose functions globally for HTML event handlers
window.nextQuestion = nextQuestion;
window.previousQuestion = previousQuestion;
window.quitPractice = quitPractice;
window.showTopics = showTopics;
window.showGrades = showGrades;
window.startPracticeFilter = startPracticeFilter;
window.startMentalMath = startMentalMath;
window.handleBackNavigation = handleBackNavigation;
window.openNameModal = openNameModal;
window.saveStudentName = saveStudentName;
window.switchTopicTab = switchTopicTab;
window.startMentalMathForGrade = startMentalMathForGrade;
