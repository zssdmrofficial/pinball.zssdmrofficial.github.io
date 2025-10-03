// 初始化程式
window.addEventListener("DOMContentLoaded", () => {
    const pinball = new Pinball("pinballCanvas", "chips");
    const quiz = new Quiz("result", document.getElementById("chips"), pinball);

    // 綁定事件
    document.getElementById("drop-ball-btn").addEventListener("click", () => pinball.dropBall());
    document.querySelectorAll(".options button").forEach(btn => {
        btn.addEventListener("click", () => {
            quiz.chooseAnswer(btn.dataset.choice);
        });
    });
});
