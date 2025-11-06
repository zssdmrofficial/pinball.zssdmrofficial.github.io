document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 ---
    const startScreen = document.getElementById('start-screen');
    const gameContainer = document.getElementById('game-container');
    const startGameBtn = document.getElementById('start-game-btn');
    const dropBallBtn = document.getElementById('drop-ball-btn');
    const chipsDisplay = document.getElementById('chips-display');
    const answerQuestionBtn = document.getElementById('answer-question-btn');
    const questionTitle = document.getElementById('question-title');
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const resultText = document.getElementById('result-text');
    const ballResult = document.getElementById('ball-result');
    const timerDisplay = document.getElementById('timer-display');
    const wagerBtn = document.getElementById('wager-btn');
    const bumperBtn = document.getElementById('bumper-btn');


    // --- Canvas 彈珠台設定 ---
    const canvas = document.getElementById('plinko-canvas');
    const ctx = canvas.getContext('2d');
    const pegRadius = 5;
    const pegColor = '#ffffff';
    const ballRadius = 8;
    const ballColor = '#ff8888';
    let pegs = [];
    let ball = null;
    // 新增：動態障礙物
    let movingObstacles = [];
    // 新增：保險桿道具
    let bumperActive = false;
    const BUMPER_COST = 15;


    // --- 遊戲狀態 ---
    let chips = 10;
    let questions = [];
    let currentQuestion = null;
    let selectedAnswer = null;
    let canDropBall = true;
    const ANSWER_COST = 10;
    const CORRECT_REWARD = 30;
    // 新增：時間壓力
    const QUESTION_TIME_LIMIT = 20; // 20秒答題時間
    let timeLeft = QUESTION_TIME_LIMIT;
    let timerInterval = null;
    // 新增：懲罰與風險
    let consecutiveWrongAnswers = 0;
    let isWagerActive = false;

    // --- 初始化函式 ---
    async function initializeGame() {
        await loadQuestions();
        setupPegs();
        setupObstacles(); // 初始化障礙物
        draw();
        updateUI();
    }

    // --- 遊戲流程控制 ---
    startGameBtn.addEventListener('click', () => {
        startScreen.classList.add('hidden');
        gameContainer.classList.remove('hidden');
    });

    dropBallBtn.addEventListener('click', () => {
        if (canDropBall) {
            canDropBall = false;
            ballResult.textContent = '';
            dropBallBtn.disabled = true;
            ball = {
                x: canvas.width / 2 + (Math.random() - 0.5) * 20,
                y: ballRadius,
                vx: (Math.random() - 0.5) * 2,
                vy: 0
            };
            animateBall();
        }
    });

    wagerBtn.addEventListener('click', () => {
        isWagerActive = !isWagerActive;
        wagerBtn.classList.toggle('active', isWagerActive);
        updateUI();
    });

    bumperBtn.addEventListener('click', () => {
        if (chips >= BUMPER_COST) {
            chips -= BUMPER_COST;
            bumperActive = true;
            updateUI();
        }
    });

    answerQuestionBtn.addEventListener('click', () => {
        if (!currentQuestion) {
            loadNextQuestion();
        } else if (selectedAnswer) {
            checkAnswer();
        }
    });

    // --- 題庫處理 ---
    async function loadQuestions() {
        try {
            const response = await fetch('assets/QA.json');
            if (!response.ok) throw new Error('無法讀取題庫檔案');
            questions = await response.json();
        } catch (error) {
            console.error(error);
            questionTitle.textContent = '錯誤';
            questionText.textContent = '無法載入題目，請檢查檔案路徑或格式。';
        }
    }

    function loadNextQuestion() {
        // --- 懲罰與風險機制 ---
        const wagerMultiplier = isWagerActive ? 2 : 1;
        // 連續答錯，懲罰加重 (每錯1次成本+5)
        const penalty = consecutiveWrongAnswers * 5;
        const currentCost = (ANSWER_COST + penalty) * wagerMultiplier;

        if (chips < currentCost) return; // 籌碼不足無法開始
        if (questions.length === 0) {
            // ... (遊戲結束邏輯)
            return;
        }

        chips -= currentCost;
        updateUI();

        const questionIndex = Math.floor(Math.random() * questions.length);
        currentQuestion = questions.splice(questionIndex, 1)[0];
        selectedAnswer = null;

        questionTitle.textContent = `問題 (成本: ${currentCost})`;
        questionText.textContent = currentQuestion.question;
        resultText.textContent = '';
        optionsContainer.innerHTML = '';

        currentQuestion.options.forEach(option => {
            const button = document.createElement('button');
            button.textContent = option;
            button.disabled = false; // 確保按鈕是啟用的
            button.addEventListener('click', () => {
                optionsContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
                button.classList.add('selected');
                selectedAnswer = option;
            });
            optionsContainer.appendChild(button);
        });

        answerQuestionBtn.textContent = `確認答案`;
        startTimer(); // 開始計時
    }

    function checkAnswer(isTimeout = false) {
        stopTimer();
        const optionButtons = optionsContainer.querySelectorAll('button');
        optionButtons.forEach(btn => btn.disabled = true);

        const correct = !isTimeout && selectedAnswer === currentQuestion.answer;
        const wagerMultiplier = isWagerActive ? 2 : 1;
        const currentReward = CORRECT_REWARD * wagerMultiplier;

        if (correct) {
            chips += currentReward;
            resultText.textContent = `正確！獲得 ${currentReward} 籌碼！${currentQuestion.explanation}`;
            resultText.style.color = 'var(--correct-color)';
            consecutiveWrongAnswers = 0; // 重置連續答錯次數
        } else {
            resultText.textContent = isTimeout ? `時間到！` : `答錯了。`;
            resultText.textContent += `正確答案是：${currentQuestion.answer}。說明：${currentQuestion.explanation}`;
            resultText.style.color = 'var(--wrong-color)';
            consecutiveWrongAnswers++; // 增加連續答錯次數
        }

        optionButtons.forEach(btn => {
            if (btn.textContent === currentQuestion.answer) btn.classList.add('correct');
            else if (btn.textContent === selectedAnswer) btn.classList.add('wrong');
        });

        currentQuestion = null;
        selectedAnswer = null;
        isWagerActive = false; // 重置賭注狀態
        wagerBtn.classList.remove('active');
        updateUI();
    }

    // --- 新增：計時器功能 ---
    function startTimer() {
        timeLeft = QUESTION_TIME_LIMIT;
        timerDisplay.textContent = timeLeft;
        timerDisplay.classList.remove('low-time');

        timerInterval = setInterval(() => {
            timeLeft--;
            timerDisplay.textContent = timeLeft;
            if (timeLeft <= 5) {
                timerDisplay.classList.add('low-time');
            }
            if (timeLeft <= 0) {
                checkAnswer(true); // 時間到，以答錯論
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        timerDisplay.textContent = '';
        timerDisplay.classList.remove('low-time');
    }

    // --- UI 更新 ---
    function updateUI() {
        chipsDisplay.textContent = chips;

        const wagerMultiplier = isWagerActive ? 2 : 1;
        const penalty = consecutiveWrongAnswers * 5;
        const nextCost = (ANSWER_COST + penalty) * wagerMultiplier;

        if (currentQuestion) {
            answerQuestionBtn.textContent = '確認答案';
            answerQuestionBtn.disabled = !selectedAnswer;
        } else {
            answerQuestionBtn.textContent = `消耗 ${nextCost} 籌碼答題`;
            answerQuestionBtn.disabled = chips < nextCost;
        }

        // 更新道具按鈕狀態
        bumperBtn.disabled = chips < BUMPER_COST || bumperActive;
        bumperBtn.textContent = bumperActive ? '保險桿已啟用' : `保險桿 (${BUMPER_COST})`;
    }

    // --- 彈珠台物理與繪圖 ---
    function setupPegs() {
        const rows = 10;
        const cols = 7;
        for (let row = 1; row < rows; row++) {
            const numPegs = cols + (row % 2 === 0 ? 0 : -1);
            const spacing = canvas.width / (numPegs + 1);
            for (let col = 0; col < numPegs; col++) {
                pegs.push({
                    x: spacing * (col + (row % 2 === 0 ? 1 : 1.5)),
                    y: 50 + row * 35
                });
            }
        }
    }

    // 新增：設定動態障礙物
    function setupObstacles() {
        movingObstacles.push({
            x: 50, y: 150, width: 80, height: 8, vx: 1.2
        });
        movingObstacles.push({
            x: 200, y: 280, width: 60, height: 8, vx: -0.8
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 繪製釘子
        ctx.fillStyle = pegColor;
        pegs.forEach(peg => {
            ctx.beginPath();
            ctx.arc(peg.x, peg.y, pegRadius, 0, Math.PI * 2);
            ctx.fill();
        });

        // 繪製動態障礙物
        ctx.fillStyle = '#ffcc88';
        movingObstacles.forEach(ob => {
            ctx.fillRect(ob.x, ob.y, ob.width, ob.height);
        });

        // 繪製保險桿
        if (bumperActive) {
            ctx.fillStyle = '#49ffc2';
            ctx.fillRect(0, canvas.height - 10, canvas.width, 10);
        }

        // 繪製球
        if (ball) {
            ctx.fillStyle = ballColor;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 繪製底部獎勵槽 (包含負分陷阱區)
        const scores = [-10, 5, 15, 0, 15, 5, -10];
        const slotWidth = canvas.width / scores.length;
        ctx.font = '14px Noto Sans TC';
        scores.forEach((score, i) => {
            // 根據分數正負改變顏色
            ctx.fillStyle = score < 0 ? '#ff6b6b' : '#fff';
            ctx.fillText(score, i * slotWidth + slotWidth / 2 - (score >= 10 || score < 0 ? 10 : 5), canvas.height - 15);
        });
    }

    function animateBall() {
        if (!ball) return;

        // 更新障礙物位置
        movingObstacles.forEach(ob => {
            ob.x += ob.vx;
            if (ob.x < 0 || ob.x + ob.width > canvas.width) {
                ob.vx *= -1;
            }
        });

        ball.vy += 0.1;
        ball.x += ball.vx;
        ball.y += ball.vy;

        if (ball.x - ballRadius < 0 || ball.x + ballRadius > canvas.width) {
            ball.vx *= -0.8;
            ball.x = Math.max(ballRadius, Math.min(canvas.width - ballRadius, ball.x));
        }

        // 釘子碰撞
        pegs.forEach(peg => {
            const dx = ball.x - peg.x;
            const dy = ball.y - peg.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < ballRadius + pegRadius) {
                const angle = Math.atan2(dy, dx);
                ball.vx = Math.cos(angle) * 2;
                ball.vy = Math.sin(angle) * 2;
            }
        });

        // 動態障礙物碰撞
        movingObstacles.forEach(ob => {
            if (ball.x > ob.x && ball.x < ob.x + ob.width &&
                ball.y + ballRadius > ob.y && ball.y - ballRadius < ob.y + ob.height) {
                ball.vy *= -0.7; // 反彈
                ball.y = ob.y - ballRadius; // 避免穿透
            }
        });

        // 檢查保險桿
        if (bumperActive && ball.y + ballRadius > canvas.height - 10) {
            ball.vy *= -0.9; // 從保險桿反彈
            ball.y = canvas.height - 10 - ballRadius;
            bumperActive = false; // 保險桿使用一次後消失
            updateUI();
        }


        draw();

        // 檢查是否到底部
        if (ball.y > canvas.height) {
            const scores = [-10, 5, 15, 0, 15, 5, -10];
            const slotWidth = canvas.width / scores.length;
            const slotIndex = Math.floor(ball.x / slotWidth);
            const score = scores[slotIndex] || 0;

            chips += score;
            ballResult.textContent = score >= 0 ? `獲得 ${score} 籌碼！` : `失去 ${-score} 籌碼！`;
            updateUI();

            ball = null;
            canDropBall = true;
            dropBallBtn.disabled = false;
        } else {
            requestAnimationFrame(animateBall);
        }
    }

    // --- 遊戲啟動 ---
    initializeGame();
});