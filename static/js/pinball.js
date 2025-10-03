// Pinball Game 模組
class Pinball {
    constructor(canvasId, chipsElementId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.chipsElement = document.getElementById(chipsElementId);

        this.ball = null;
        this.pegs = [];
        this.slots = [70, 80, 90];
        this.chips = 0;

        this._initPegs();
        this._render();
    }

    _initPegs() {
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 5; col++) {
                this.pegs.push({
                    x: 50 + col * 50 + (row % 2) * 25,
                    y: 80 + row * 60,
                    r: 5
                });
            }
        }
    }

    dropBall() {
        if (this.ball) return;
        this.ball = { x: this.canvas.width / 2, y: 20, vx: 0, vy: 2, r: 8 };
    }

    _drawPegs() {
        this.ctx.fillStyle = "#fff";
        this.pegs.forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    _drawBall() {
        if (!this.ball) return;
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2);
        this.ctx.fillStyle = "#ff4081";
        this.ctx.fill();
    }

    _updateBall() {
        if (!this.ball) return;

        this.ball.y += this.ball.vy;
        this.ball.x += this.ball.vx;

        if (this.ball.x - this.ball.r < 0 || this.ball.x + this.ball.r > this.canvas.width) this.ball.vx *= -1;

        this.pegs.forEach(p => {
            let dx = this.ball.x - p.x;
            let dy = this.ball.y - p.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.ball.r + p.r) {
                this.ball.vy *= -1;
                this.ball.vx += (Math.random() - 0.5) * 2;
            }
        });

        if (this.ball.y > this.canvas.height - 50) {
            let index = Math.floor((this.ball.x / this.canvas.width) * this.slots.length);
            let reward = this.slots[Math.min(index, this.slots.length - 1)];
            this.chips += reward;
            this.chipsElement.textContent = this.chips;
            alert("球掉進去了！你獲得 " + reward + " 籌碼！");
            this.ball = null;
        }
    }

    _drawSlots() {
        let slotWidth = this.canvas.width / this.slots.length;
        this.ctx.strokeStyle = "#0f0";
        this.ctx.font = "16px Inter";
        this.ctx.fillStyle = "#b0c4ff";
        for (let i = 0; i < this.slots.length; i++) {
            this.ctx.strokeRect(i * slotWidth, this.canvas.height - 50, slotWidth, 50);
            this.ctx.fillText(this.slots[i], i * slotWidth + slotWidth / 2 - 10, this.canvas.height - 20);
        }
    }

    _render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this._drawPegs();
        this._drawSlots();
        this._drawBall();
        this._updateBall();
        requestAnimationFrame(() => this._render());
    }
}
