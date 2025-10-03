// Quiz 模組
class Quiz {
    constructor(resultElementId, chipsElement, pinball) {
        this.resultElement = document.getElementById(resultElementId);
        this.chipsElement = chipsElement;
        this.pinball = pinball;
        this.correct = "B"; // TODO: 之後可換題庫
    }

    chooseAnswer(choice) {
        if (this.pinball.chips <= 0) {
            alert("你沒有籌碼可以下注！");
            return;
        }

        if (choice === this.correct) {
            this.pinball.chips *= 2;
            this.resultElement.textContent = "答對了！籌碼翻倍：" + this.pinball.chips;
        } else {
            this.pinball.chips = 0;
            this.resultElement.textContent = "答錯了！籌碼清零";
        }

        this.chipsElement.textContent = this.pinball.chips;
    }
}
