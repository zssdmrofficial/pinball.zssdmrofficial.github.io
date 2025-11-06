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

    // --- Canvas 彈珠台設定 ---
    const canvas = document.getElementById('plinko-canvas');
    const ctx = canvas.getContext('2d');
    const pegRadius = 5;
    const pegColor = '#ffffff'; // 白色釘子依然適合
    const ballRadius = 8;
    const ballColor = '#ff8888'; // 使用新的主粉紅色
    let pegs = [];
    let ball = null;

    // --- 遊戲狀態 ---
    let chips = 10;
    let questions = [];
    let currentQuestion = null;
    let selectedAnswer = null;
    let canDropBall = true;
    const ANSWER_COST = 10;
    const CORRECT_REWARD = 30;

    // --- 初始化函式 ---
    async function initializeGame() {
        await loadQuestions();
        setupPegs();
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

    answerQuestionBtn.addEventListener('click', () => {
        if (!currentQuestion) {
            loadNextQuestion();
            answerQuestionBtn.textContent = `確認答案`;
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
        if (questions.length === 0) {
            questionTitle.textContent = '恭喜！';
            questionText.textContent = '您已完成所有題目！';
            optionsContainer.innerHTML = '';
            answerQuestionBtn.disabled = true;
            return;
        }

        // 消耗籌碼
        chips -= ANSWER_COST;
        updateUI();

        // 載入新題目
        const questionIndex = Math.floor(Math.random() * questions.length);
        currentQuestion = questions.splice(questionIndex, 1)[0];
        selectedAnswer = null;

        questionTitle.textContent = '問題';
        questionText.textContent = currentQuestion.question;
        resultText.textContent = '';
        optionsContainer.innerHTML = '';

        currentQuestion.options.forEach(option => {
            const button = document.createElement('button');
            button.textContent = option;
            button.addEventListener('click', () => {
                // 移除其他按鈕的 selected class
                optionsContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
                // 新增 selected class
                button.classList.add('selected');
                selectedAnswer = option;
            });
            optionsContainer.appendChild(button);
        });
    }

    function checkAnswer() {
        // 禁用所有選項按鈕
        const optionButtons = optionsContainer.querySelectorAll('button');
        optionButtons.forEach(btn => btn.disabled = true);

        const correct = selectedAnswer === currentQuestion.answer;
        if (correct) {
            chips += CORRECT_REWARD;
            resultText.textContent = `正確！${currentQuestion.explanation}`;
            resultText.style.color = 'var(--correct-color)';
        } else {
            resultText.textContent = `答錯了。正確答案是：${currentQuestion.answer}。說明：${currentQuestion.explanation}`;
            resultText.style.color = 'var(--wrong-color)';
        }

        // 標示正確與錯誤的選項
        optionButtons.forEach(btn => {
            if (btn.textContent === currentQuestion.answer) {
                btn.classList.add('correct');
            } else if (btn.textContent === selectedAnswer) {
                btn.classList.add('wrong');
            }
        });

        currentQuestion = null;
        selectedAnswer = null;
        answerQuestionBtn.textContent = '消耗 10 籌碼答下一題';
        updateUI();
    }


    // --- UI 更新 ---
    function updateUI() {
        chipsDisplay.textContent = chips;
        answerQuestionBtn.disabled = chips < ANSWER_COST && !currentQuestion;
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

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 繪製釘子
        ctx.fillStyle = pegColor;
        pegs.forEach(peg => {
            ctx.beginPath();
            ctx.arc(peg.x, peg.y, pegRadius, 0, Math.PI * 2);
            ctx.fill();
        });

        // 繪製球
        if (ball) {
            ctx.fillStyle = ballColor;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 繪製底部獎勵槽
        const scores = [1, 5, 10, 2, 10, 5, 1];
        const slotWidth = canvas.width / scores.length;
        ctx.font = '14px Noto Sans TC';
        scores.forEach((score, i) => {
            ctx.fillStyle = '#fff';
            ctx.fillText(score, i * slotWidth + slotWidth / 2 - 5, canvas.height - 15);
        });
    }

    function animateBall() {
        if (!ball) return;

        // 物理更新
        ball.vy += 0.1; // 重力
        ball.x += ball.vx;
        ball.y += ball.vy;

        // 牆壁碰撞
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

        draw();

        // 檢查是否到底部
        if (ball.y > canvas.height) {
            const scores = [1, 5, 10, 2, 10, 5, 1];
            const slotWidth = canvas.width / scores.length;
            const slotIndex = Math.floor(ball.x / slotWidth);
            const score = scores[slotIndex] || 1;

            chips += score;
            ballResult.textContent = `獲得 ${score} 籌碼！`;
            updateUI();

            ball = null; // 球消失
            canDropBall = true;
            dropBallBtn.disabled = false;
        } else {
            requestAnimationFrame(animateBall);
        }
    }

    // --- 遊戲啟動 ---
    initializeGame();
});