document.addEventListener('DOMContentLoaded', () => {
    const startScreen = document.getElementById('start-screen');
    const gameContainer = document.getElementById('game-container');
    const endScreen = document.getElementById('end-screen');
    const startQuizModeBtn = document.getElementById('start-quiz-mode-btn');
    const startCustomModeBtn = document.getElementById('start-custom-mode-btn');
    const targetChipsInput = document.getElementById('target-chips-input');
    const restartGameBtn = document.getElementById('restart-game-btn');
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
    let currentScores = [-10, 5, 15, 15, 15, 5, 15];
    let chips = 10;
    let questions = [];
    let currentQuestion = null;
    let selectedAnswer = null;
    let canDropBall = true;
    let consecutiveWrongAnswers = 0;
    let isWagerActive = false;
    let gameMode = null;
    let targetChips = 1000;
    let bailoutCount = 0;
    const MAX_BAILOUTS = 3;
    const BAILOUT_AMOUNT = 20;
    const DROP_BALL_COST = 2;
    const WAGER_ACTIVATION_COST = 5;
    const ANSWER_COST = 10;
    const CORRECT_REWARD = 30;
    const CONSECUTIVE_WRONG_PENALTY = 8;
    const QUESTION_TIME_LIMIT = 20;
    let timeLeft = QUESTION_TIME_LIMIT;
    let timerInterval = null;

    async function initializeGame() {
        await loadQuestions();
        setupPegs();
        randomizeObstacles();
        draw();
    }

    startQuizModeBtn.addEventListener('click', () => {
        startGame('quiz');
    });

    startCustomModeBtn.addEventListener('click', () => {
        const customTarget = parseInt(targetChipsInput.value, 10);
        if (!isNaN(customTarget) && customTarget >= 100) {
            targetChips = customTarget;
        } else {
            targetChips = 1000;
        }
        startGame('custom');
    });

    restartGameBtn.addEventListener('click', () => {
        location.reload();
    });

    function startGame(mode) {
        gameMode = mode;
        startScreen.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        if (gameMode === 'quiz') {
            gameArea.classList.add('hidden');
            wagerBtn.classList.add('hidden');
            timerDisplay.classList.add('hidden');
            document.querySelector('.game-controls p').classList.add('hidden');
        } else {
            qaArea.style.flex = '1';
        }
        updateUI();
    }

    function shuffleScores() {
        for (let i = currentScores.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [currentScores[i], currentScores[j]] = [currentScores[j], currentScores[i]];
        }
    }

    dropBallBtn.addEventListener('click', () => {
        if (canDropBall && chips >= DROP_BALL_COST) {
            shuffleScores();
            randomizeObstacles();
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
            const response = await fetch('assets/QA.jsonl');
            if (!response.ok) throw new Error('無法讀取題庫檔案');
            const text = await response.text();
            questions = text.split('\n')
                .filter(line => line.trim() !== '')
                .map(line => JSON.parse(line));
        } catch (error) {
            console.error(error);
            questionTitle.textContent = '錯誤';
            questionText.textContent = '無法載入題目，請檢查檔案路徑或格式。';
        }
    }

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
        const shuffledOptions = [...currentQuestion.options];
        for (let i = shuffledOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
        }
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
        if (gameMode === 'quiz') {
            if (currentQuestion) {
                answerQuestionBtn.textContent = '確認答案';
                answerQuestionBtn.disabled = !selectedAnswer;
            } else {
                answerQuestionBtn.textContent = '開始答題';
                answerQuestionBtn.disabled = false;
            }
        } else {
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
            checkGameStatus();
        }
    }

    function checkGameStatus() {
        if (gameMode !== 'custom' || currentQuestion) return;

        if (chips >= targetChips) {
            triggerWin();
            return;
        }

        const penalty = consecutiveWrongAnswers * CONSECUTIVE_WRONG_PENALTY;
        const nextAnswerCost = ANSWER_COST + penalty;

        const canPerformAnyAction =
            (chips >= DROP_BALL_COST && canDropBall) ||
            (chips >= nextAnswerCost && !currentQuestion) ||
            (chips >= WAGER_ACTIVATION_COST && !currentQuestion && !isWagerActive) ||
            (chips >= BUMPER_COST && !bumperActive);

        if (!canPerformAnyAction) {
            bailoutCount++;
            if (bailoutCount >= MAX_BAILOUTS) {
                triggerLoss();
            } else {
                const message = chips <= 0 ? `你的籌碼已歸零！` : `你的籌碼不足以進行任何操作！`;
                chips = BAILOUT_AMOUNT;
                alert(`${message} 系統贈送您 ${BAILOUT_AMOUNT} 籌碼。 (第 ${bailoutCount} 次拯救)`);
                updateUI();
            }
        }
    }

    function triggerLoss() {
        gameContainer.classList.add('hidden');
        endScreen.classList.remove('hidden');
        endTitle.textContent = '挑戰失敗';
        endTitle.style.color = 'var(--wrong-color)';
        endMessage.textContent = `您已經耗盡了所有的拯救機會。再接再厲！`;
    }

    function setupPegs() {
        const rows = 8;
        const yStart = 40;
        const verticalSpacing = 35;
        const horizontalSpacing = 40;
        const jitterAmount = 1.5;
        pegs = [];
        const numPegsPerRow = 10;
        for (let row = 0; row < rows; row++) {
            const offsetX = (row % 2 === 0) ? 0 : horizontalSpacing / 2;
            const totalRowWidth = (numPegsPerRow - 1) * horizontalSpacing;
            const startX = (canvas.width - totalRowWidth) / 2 + offsetX;
            for (let col = 0; col < numPegsPerRow; col++) {
                const baseX = startX + col * horizontalSpacing;
                const baseY = yStart + row * verticalSpacing;
                const finalX = baseX + (Math.random() - 0.5) * jitterAmount * 2;
                const finalY = baseY + (Math.random() - 0.5) * jitterAmount * 2;
                pegs.push({ x: finalX, y: finalY });
            }
        }
    }

    function randomizeObstacles() {
        movingObstacles = [];
        const obstacleCount = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < obstacleCount; i++) {
            const width = Math.random() * 50 + 50;
            const x = Math.random() * (canvas.width - width);
            const y = Math.random() * 200 + 100;
            const speed = Math.random() * 1 + 0.5;
            const direction = Math.random() < 0.5 ? 1 : -1;
            const vx = speed * direction;
            movingObstacles.push({ x, y, width, height: 8, vx });
        }
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
        const slotWidth = canvas.width / currentScores.length;
        ctx.font = '14px Noto Sans TC';
        currentScores.forEach((score, i) => {
            ctx.fillStyle = score < 0 ? '#ff6b6b' : '#fff';
            ctx.fillText(score, i * slotWidth + slotWidth / 2 - (score >= 10 || score < 0 ? 10 : 5), canvas.height - 15);
            if (i > 0) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(i * slotWidth, canvas.height - 40);
                ctx.lineTo(i * slotWidth, canvas.height);
                ctx.stroke();
            }
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
                ball.vx = Math.cos(angle) * 1.3;
                ball.vy = Math.sin(angle) * 1.3;
            }
        });
        movingObstacles.forEach(ob => {
            if (ball.x > ob.x && ball.x < ob.x + ob.width &&
                ball.y + ballRadius > ob.y && ball.y - ballRadius < ob.y + ob.height) {
                ball.vy *= -0.5;
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
            const slotWidth = canvas.width / currentScores.length;
            const slotIndex = Math.floor(ball.x / slotWidth);
            const score = currentScores[slotIndex] || 0;
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