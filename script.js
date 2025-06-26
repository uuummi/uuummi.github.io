// 게임 상태 관리
const gameState = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'game_over',
    WON: 'won'
};

// 게임 객체
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = gameState.MENU;
        
        // 게임 변수
        this.score = 0;
        this.lives = 3;
        this.animationId = null;
        
        // 게임 객체들
        this.paddle = new Paddle(this.canvas.width / 2 - 60, this.canvas.height - 30, 120, 15);
        this.ball = new Ball(this.canvas.width / 2, this.canvas.height - 50, 8);
        this.blocks = [];
        
        // 마우스 위치
        this.mouseX = this.canvas.width / 2;
        
        this.initBlocks();
        this.bindEvents();
    }
    
    initBlocks() {
        this.blocks = [];
        const rows = 6;
        const cols = 10;
        const blockWidth = 70;
        const blockHeight = 25;
        const padding = 5;
        const offsetTop = 60;
        const offsetLeft = (this.canvas.width - (cols * (blockWidth + padding) - padding)) / 2;
        
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3'];
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = offsetLeft + col * (blockWidth + padding);
                const y = offsetTop + row * (blockHeight + padding);
                const color = colors[row];
                const points = (rows - row) * 10; // 위쪽 블럭일수록 높은 점수
                
                this.blocks.push(new Block(x, y, blockWidth, blockHeight, color, points));
            }
        }
    }
    
    bindEvents() {
        // 키보드 이벤트
        document.addEventListener('keydown', (e) => {
            if (e.code === 'ArrowLeft') {
                this.paddle.moveLeft();
            } else if (e.code === 'ArrowRight') {
                this.paddle.moveRight();
            } else if (e.code === 'Space') {
                e.preventDefault();
                if (this.state === gameState.PLAYING) {
                    this.pauseGame();
                } else if (this.state === gameState.PAUSED) {
                    this.resumeGame();
                }
            }
        });
        
        // 마우스 이벤트
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            if (this.state === gameState.PLAYING) {
                this.paddle.x = this.mouseX - this.paddle.width / 2;
                this.paddle.constrainToCanvas(this.canvas.width);
            }
        });
        
        // 버튼 이벤트
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('restartBtn').addEventListener('click', () => this.resetGame());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.resetGame());
    }
    
    startGame() {
        if (this.state === gameState.MENU) {
            this.state = gameState.PLAYING;
            this.ball.reset(this.canvas.width / 2, this.canvas.height - 50);
            this.gameLoop();
        }
    }
    
    togglePause() {
        if (this.state === gameState.PLAYING) {
            this.pauseGame();
        } else if (this.state === gameState.PAUSED) {
            this.resumeGame();
        }
    }
    
    pauseGame() {
        this.state = gameState.PAUSED;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
    
    resumeGame() {
        this.state = gameState.PLAYING;
        this.gameLoop();
    }
    
    resetGame() {
        this.state = gameState.MENU;
        this.score = 0;
        this.lives = 3;
        this.paddle.reset(this.canvas.width / 2 - 60, this.canvas.height - 30);
        this.ball.reset(this.canvas.width / 2, this.canvas.height - 50);
        this.initBlocks();
        this.updateUI();
        this.hideModal();
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
    
    gameLoop() {
        if (this.state !== gameState.PLAYING) return;
        
        this.update();
        this.render();
        
        this.animationId = requestAnimationFrame(() => this.gameLoop());
    }
    
    update() {
        // 공 업데이트
        this.ball.update();
        
        // 벽 충돌 감지
        if (this.ball.x <= this.ball.radius || this.ball.x >= this.canvas.width - this.ball.radius) {
            this.ball.dx *= -1;
        }
        if (this.ball.y <= this.ball.radius) {
            this.ball.dy *= -1;
        }
        
        // 바닥 충돌 (게임 오버)
        if (this.ball.y >= this.canvas.height - this.ball.radius) {
            this.lives--;
            if (this.lives <= 0) {
                this.gameOver();
            } else {
                this.ball.reset(this.canvas.width / 2, this.canvas.height - 50);
            }
        }
        
        // 패들과 공 충돌
        if (this.checkCollision(this.ball, this.paddle)) {
            const hitPos = (this.ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
            this.ball.dy = -Math.abs(this.ball.dy);
            this.ball.dx = hitPos * 5; // 패들의 어느 부분에 맞았는지에 따라 각도 조절
        }
        
        // 블럭과 공 충돌
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            const block = this.blocks[i];
            if (this.checkCollision(this.ball, block)) {
                this.score += block.points;
                this.blocks.splice(i, 1);
                this.ball.dy *= -1;
                
                // 모든 블럭을 깼는지 확인
                if (this.blocks.length === 0) {
                    this.gameWon();
                }
                break;
            }
        }
        
        this.updateUI();
    }
    
    checkCollision(ball, rect) {
        const closestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.height));
        
        const distanceX = ball.x - closestX;
        const distanceY = ball.y - closestY;
        
        return (distanceX * distanceX + distanceY * distanceY) < (ball.radius * ball.radius);
    }
    
    render() {
        // 화면 클리어
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 패들 그리기
        this.paddle.draw(this.ctx);
        
        // 공 그리기
        this.ball.draw(this.ctx);
        
        // 블럭들 그리기
        this.blocks.forEach(block => block.draw(this.ctx));
        
        // 게임 상태에 따른 텍스트 표시
        if (this.state === gameState.MENU) {
            this.ctx.fillStyle = '#FFF';
            this.ctx.font = '24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('게임 시작 버튼을 클릭하세요!', this.canvas.width / 2, this.canvas.height / 2);
        } else if (this.state === gameState.PAUSED) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#FFF';
            this.ctx.font = '36px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('일시정지', this.canvas.width / 2, this.canvas.height / 2);
        }
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('lives').textContent = this.lives;
    }
    
    gameOver() {
        this.state = gameState.GAME_OVER;
        document.getElementById('gameOverTitle').textContent = '게임 오버!';
        document.getElementById('finalScore').textContent = this.score;
        this.showModal();
    }
    
    gameWon() {
        this.state = gameState.WON;
        document.getElementById('gameOverTitle').textContent = '축하합니다!';
        document.getElementById('gameOverMessage').innerHTML = `모든 블럭을 깨뜨렸습니다!<br>최종 점수: <span id="finalScore">${this.score}</span>`;
        this.showModal();
    }
    
    showModal() {
        document.getElementById('gameOverModal').style.display = 'block';
    }
    
    hideModal() {
        document.getElementById('gameOverModal').style.display = 'none';
    }
}

// 패들 클래스
class Paddle {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = 8;
    }
    
    moveLeft() {
        this.x -= this.speed;
        if (this.x < 0) this.x = 0;
    }
    
    moveRight() {
        this.x += this.speed;
    }
    
    constrainToCanvas(canvasWidth) {
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvasWidth) this.x = canvasWidth - this.width;
    }
    
    reset(x, y) {
        this.x = x;
        this.y = y;
    }
    
    draw(ctx) {
        const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        gradient.addColorStop(0, '#4ECDC4');
        gradient.addColorStop(1, '#44A08D');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // 패들에 하이라이트 효과
        ctx.fillStyle = '#FFF';
        ctx.fillRect(this.x, this.y, this.width, 2);
    }
}

// 공 클래스
class Ball {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.dx = 4;
        this.dy = -4;
        this.maxSpeed = 8;
    }
    
    update() {
        this.x += this.dx;
        this.y += this.dy;
        
        // 속도 제한
        const speed = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
        if (speed > this.maxSpeed) {
            this.dx = (this.dx / speed) * this.maxSpeed;
            this.dy = (this.dy / speed) * this.maxSpeed;
        }
    }
    
    reset(x, y) {
        this.x = x;
        this.y = y;
        this.dx = 4;
        this.dy = -4;
    }
    
    draw(ctx) {
        const gradient = ctx.createRadialGradient(this.x - 2, this.y - 2, 0, this.x, this.y, this.radius);
        gradient.addColorStop(0, '#FFF');
        gradient.addColorStop(1, '#FF6B6B');
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.closePath();
    }
}

// 블럭 클래스
class Block {
    constructor(x, y, width, height, color, points) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.points = points;
    }
    
    draw(ctx) {
        // 블럭 그라디언트
        const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, this.darkenColor(this.color, 20));
        
        ctx.fillStyle = gradient;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // 블럭 테두리
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        // 하이라이트 효과
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(this.x, this.y, this.width, 3);
    }
    
    darkenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
}

// 게임 초기화
let game;

window.addEventListener('load', () => {
    game = new Game();
}); 