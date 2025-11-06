document.addEventListener('DOMContentLoaded', () => {
    // 畫面元素
    const startScreen = document.getElementById('start-screen');
    const gameContainer = document.getElementById('game-container');
    const endScreen = document.getElementById('end-screen');
    const startQuizModeBtn = document.getElementById('start-quiz-mode-btn');
    const startCustomModeBtn = document.getElementById('start-custom-mode-btn');
    const targetChipsInput = document.getElementById('target-chips-input');
    const restartGameBtn = document.getElementById('restart-game-btn');

    // 遊戲元素
    const gameArea = document.getElementById('game-area');
    const qaArea = document.getElementById('qa-area');
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
    const endTitle = document.getElementById('end-title');
    const endMessage = document.getElementById('end-message');

    // 彈珠台相關
    const canvas = document.getElementById('plinko-canvas');
    const ctx = canvas.getContext('2d');
    const pegRadius = 5;
    const pegColor = '#ffffff';
    const ballRadius = 8;
    const ballColor = '#ff8888';
    let pegs = [];
    let ball = null;
    let movingObstacles = [];
    let bumperActive = false;
    const BUMPER_COST = 15;

    // 遊戲狀態變數
    let chips = 10;
    let questions = [];
    let currentQuestion = null;
    let selectedAnswer = null;
    let canDropBall = true;
    let consecutiveWrongAnswers = 0;
    let isWagerActive = false;

    // 新增: 遊戲模式與輸贏機制變數
    let gameMode = null; // 'quiz' 或 'custom'
    let targetChips = 1000;
    let bailoutCount = 0;
    const MAX_BAILOUTS = 3; // 包含最後一次失敗，所以是拯救2次
    const BAILOUT_AMOUNT = 20;

    // 遊戲常數
    const DROP_BALL_COST = 2;
    const WAGER_ACTIVATION_COST = 5;
    const ANSWER_COST = 10;
    const CORRECT_REWARD = 30;
    const CONSECUTIVE_WRONG_PENALTY = 8;
    const QUESTION_TIME_LIMIT = 20;
    let timeLeft = QUESTION_TIME_LIMIT;
    let timerInterval = null;

    // 初始化函式
    async function initializeGame() {
        await loadQuestions();
        setupPegs();
        setupObstacles();
        draw();
    }

    // 模式選擇事件監聽
    startQuizModeBtn.addEventListener('click', () => {
        startGame('quiz');
    });

    startCustomModeBtn.addEventListener('click', () => {
        const customTarget = parseInt(targetChipsInput.value, 10);
        if (!isNaN(customTarget) && customTarget >= 100) {
            targetChips = customTarget;
        } else {
            targetChips = 1000; // 如果輸入無效，使用預設值
        }
        startGame('custom');
    });

    // 重新開始遊戲
    restartGameBtn.addEventListener('click', () => {
        location.reload(); // 最簡單的方式是重載頁面
    });

    function startGame(mode) {
        gameMode = mode;
        startScreen.classList.add('hidden');
        gameContainer.classList.remove('hidden');

        if (gameMode === 'quiz') {
            // 答題模式: 隱藏籌碼和彈珠台相關元素
            gameArea.classList.add('hidden');
            wagerBtn.classList.add('hidden');
            timerDisplay.classList.add('hidden');
            document.querySelector('.game-controls p').classList.add('hidden'); // 隱藏"目前籌碼"文字
        } else {
            // 自訂模式: 正常顯示所有元素
            qaArea.style.flex = '1'; // 確保QA區域寬度正常
        }
        updateUI();
    }

    dropBallBtn.addEventListener('click', () => {
        if (canDropBall && chips >= DROP_BALL_COST) {
            chips -= DROP_BALL_COST;
            canDropBall = false;
            ballResult.textContent = `(成本: -${DROP_BALL_COST})`;
            dropBallBtn.disabled = true;
            ball = {
                x: canvas.width / 2 + (Math.random() - 0.5) * 20,
                y: ballRadius,
                vx: (Math.random() - 0.5) * 2,
                vy: 0
            };
            animateBall();
            updateUI();
        }
    });

    wagerBtn.addEventListener('click', () => {
        if (!isWagerActive && chips >= WAGER_ACTIVATION_COST) {
            chips -= WAGER_ACTIVATION_COST;
            isWagerActive = true;
        } else {
            if (isWagerActive) chips += WAGER_ACTIVATION_COST;
            isWagerActive = false;
        }
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

    async function loadQuestions() {
        try {
            // 確保你的 QA.json 檔案放在名為 'assets' 的資料夾中
            const response = await fetch('assets/QA.json');
            if (!response.ok) throw new Error('無法讀取題庫檔案');
            questions = await response.json();
        } catch (error) {
            console.error(error);
            questionTitle.textContent = '錯誤';
            questionText.textContent = '無法載入題目，請檢查檔案路徑或格式。';
        }
    }

    // 新增: 觸發勝利 (修改版本，可接受勝利原因)
    function triggerWin(reason = 'chips') {
        gameContainer.classList.add('hidden');
        endScreen.classList.remove('hidden');
        endTitle.textContent = '恭喜獲勝！';
        endTitle.style.color = 'var(--correct-color)';

        if (reason === 'quiz_complete') {
            endMessage.textContent = `您已成功答完題庫中所有題目！`;
        } else {
            endMessage.textContent = `您成功達到了 ${targetChips} 籌碼的目標！`;
        }
    }
    function loadNextQuestion() {
        const penalty = consecutiveWrongAnswers * CONSECUTIVE_WRONG_PENALTY;
        const currentCost = ANSWER_COST + penalty;

        if (gameMode === 'custom' && chips < currentCost) return;

        if (questions.length === 0) {
            triggerWin('quiz_complete');
            return;
        }

        if (gameMode === 'custom') {
            chips -= currentCost;
        }
        updateUI();

        const questionIndex = Math.floor(Math.random() * questions.length);
        currentQuestion = questions.splice(questionIndex, 1)[0];
        selectedAnswer = null;

        const costText = gameMode === 'custom' ? ` (成本: ${currentCost})` : '';
        questionTitle.textContent = `問題${costText}`;
        questionText.textContent = currentQuestion.question;
        resultText.textContent = '';
        optionsContainer.innerHTML = '';

        // --- 【修改處】 ---
        // 建立一個選項的複製並打亂順序 (Fisher-Yates shuffle)
        const shuffledOptions = [...currentQuestion.options];
        for (let i = shuffledOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
        }

        // 使用打亂後的選項陣列來建立按鈕
        shuffledOptions.forEach(option => {
            const button = document.createElement('button');
            button.textContent = option;
            button.disabled = false;
            button.addEventListener('click', () => {
                optionsContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
                button.classList.add('selected');
                selectedAnswer = option;
                updateUI();
            });
            optionsContainer.appendChild(button);
        });
        // --- 【修改結束】 ---

        answerQuestionBtn.textContent = `確認答案`;
        if (gameMode === 'custom') {
            startTimer();
        }
    }
    function checkAnswer(isTimeout = false) {
        if (gameMode === 'custom') {
            stopTimer();
        }
        const optionButtons = optionsContainer.querySelectorAll('button');
        optionButtons.forEach(btn => btn.disabled = true);

        const correct = !isTimeout && selectedAnswer === currentQuestion.answer;
        const wagerMultiplier = isWagerActive ? 2 : 1;

        let timeBonus = 0;
        if (gameMode === 'custom') {
            if (timeLeft > 10) {
                timeBonus = 10;
            } else if (timeLeft <= 5 && timeLeft > 0) {
                timeBonus = -5;
            }
        }

        const finalReward = (CORRECT_REWARD + timeBonus) * wagerMultiplier;

        if (correct) {
            const rewardText = gameMode === 'custom' ? `獲得 ${finalReward} 籌碼！` : '';
            if (gameMode === 'custom') chips += finalReward;
            resultText.textContent = `正確！${rewardText}說明：${currentQuestion.explanation}`;
            resultText.style.color = 'var(--correct-color)';
            consecutiveWrongAnswers = 0;
        } else {
            resultText.textContent = isTimeout ? `時間到！` : `答錯了。`;
            resultText.textContent += `正確答案是：${currentQuestion.answer}。說明：${currentQuestion.explanation}`;
            resultText.style.color = 'var(--wrong-color)';
            if (gameMode === 'custom') consecutiveWrongAnswers++;
        }

        optionButtons.forEach(btn => {
            if (btn.textContent === currentQuestion.answer) btn.classList.add('correct');
            else if (btn.textContent === selectedAnswer) btn.classList.add('wrong');
        });

        currentQuestion = null;
        selectedAnswer = null;
        isWagerActive = false;
        wagerBtn.classList.remove('active');
        updateUI();
    }

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
                checkAnswer(true);
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        timerDisplay.textContent = '';
        timerDisplay.classList.remove('low-time');
    }

    function updateUI() {
        // 修正後的程式碼
        if (gameMode === 'quiz') {
            // 答題模式下的UI更新
            if (currentQuestion) {
                answerQuestionBtn.textContent = '確認答案';
                answerQuestionBtn.disabled = !selectedAnswer;
            } else {
                answerQuestionBtn.textContent = '開始答題';
                answerQuestionBtn.disabled = false;
            }
        } else {
            // 自訂模式下的UI更新
            chipsDisplay.textContent = chips;

            if (canDropBall) {
                dropBallBtn.disabled = chips < DROP_BALL_COST;
            }

            const penalty = consecutiveWrongAnswers * CONSECUTIVE_WRONG_PENALTY;
            const nextCost = ANSWER_COST + penalty;

            if (currentQuestion) {
                answerQuestionBtn.textContent = '確認答案';
                answerQuestionBtn.disabled = !selectedAnswer;
            } else {
                answerQuestionBtn.textContent = `消耗 ${nextCost} 籌碼答題`;
                answerQuestionBtn.disabled = chips < nextCost;
            }

            if (isWagerActive) {
                wagerBtn.textContent = `加倍中 (成本: ${WAGER_ACTIVATION_COST})`;
            } else {
                wagerBtn.textContent = `加倍賭注`;
                wagerBtn.disabled = chips < WAGER_ACTIVATION_COST || currentQuestion;
            }

            bumperBtn.disabled = chips < BUMPER_COST || bumperActive;
            bumperBtn.textContent = bumperActive ? '保險桿已啟用' : `保險桿 (${BUMPER_COST})`;

            // 每次UI更新時檢查遊戲狀態
            checkGameStatus();
        }
    }

    // 新增: 檢查遊戲輸贏狀態
    function checkGameStatus() {
        if (gameMode !== 'custom') return;

        // 勝利條件
        if (chips >= targetChips) {
            triggerWin();
            return;
        }

        // 拯救/失敗條件
        if (chips <= 0) {
            bailoutCount++;
            if (bailoutCount >= MAX_BAILOUTS) {
                triggerLoss();
            } else {
                chips = BAILOUT_AMOUNT;
                alert(`你的籌碼已歸零！系統贈送您 ${BAILOUT_AMOUNT} 籌碼。 (第 ${bailoutCount} 次拯救)`);
                updateUI(); // 再次更新UI以顯示新的籌碼
            }
        }
    }

    // 新增: 觸發失敗
    function triggerLoss() {
        gameContainer.classList.add('hidden');
        endScreen.classList.remove('hidden');
        endTitle.textContent = '挑戰失敗';
        endTitle.style.color = 'var(--wrong-color)';
        endMessage.textContent = `您已經耗盡了所有的拯救機會。再接再厲！`;
    }

    // --- 彈珠台繪圖與動畫邏輯 (無變動) ---
    function setupPegs() {
        const rows = 8;
        const cols = 6;
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

    function setupObstacles() {
        movingObstacles.push({ x: 50, y: 150, width: 80, height: 8, vx: 1.2 });
        movingObstacles.push({ x: 200, y: 280, width: 60, height: 8, vx: -0.8 });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = pegColor;
        pegs.forEach(peg => {
            ctx.beginPath();
            ctx.arc(peg.x, peg.y, pegRadius, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.fillStyle = '#ffcc88';
        movingObstacles.forEach(ob => {
            ctx.fillRect(ob.x, ob.y, ob.width, ob.height);
        });
        if (bumperActive) {
            ctx.fillStyle = '#49ffc2';
            ctx.fillRect(0, canvas.height - 10, canvas.width, 10);
        }
        if (ball) {
            ctx.fillStyle = ballColor;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
            ctx.fill();
        }
        const scores = [-10, 5, 15, 0, 15, 5, -10];
        const slotWidth = canvas.width / scores.length;
        ctx.font = '14px Noto Sans TC';
        scores.forEach((score, i) => {
            ctx.fillStyle = score < 0 ? '#ff6b6b' : '#fff';
            ctx.fillText(score, i * slotWidth + slotWidth / 2 - (score >= 10 || score < 0 ? 10 : 5), canvas.height - 15);
        });
    }

    function animateBall() {
        if (!ball) return;
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
        pegs.forEach(peg => {
            const dx = ball.x - peg.x;
            const dy = ball.y - peg.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < ballRadius + pegRadius) {
                const angle = Math.atan2(dy, dx);
                ball.vx = Math.cos(angle) * 1.5;
                ball.vy = Math.sin(angle) * 1.5;
            }
        });
        movingObstacles.forEach(ob => {
            if (ball.x > ob.x && ball.x < ob.x + ob.width &&
                ball.y + ballRadius > ob.y && ball.y - ballRadius < ob.y + ob.height) {
                ball.vy *= -0.7;
                ball.y = ob.y - ballRadius;
            }
        });
        if (bumperActive && ball.y + ballRadius > canvas.height - 10) {
            ball.vy *= -0.9;
            ball.y = canvas.height - 10 - ballRadius;
            bumperActive = false;
            updateUI();
        }
        draw();
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

    initializeGame();
});