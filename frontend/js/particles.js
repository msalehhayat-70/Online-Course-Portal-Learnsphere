document.addEventListener("DOMContentLoaded", () => {
    // Look for canvas
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let particlesArray;
    const mouse = { x: null, y: null, radius: (canvas.height / 120) * (canvas.width / 120) };

    class Particle {
        constructor(x, y, dirX, dirY, size, color) {
            this.x = x; this.y = y; this.dirX = dirX; this.dirY = dirY;
            this.size = size; this.color = color;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
            ctx.fillStyle = 'rgba(0, 170, 255, 0.6)';
            ctx.fill();
        }
        update() {
            this.x += this.dirX; this.y += this.dirY;
            if (this.x > canvas.width + 5 || this.x < -5) this.dirX = -this.dirX;
            if (this.y > canvas.height + 5 || this.y < -5) this.dirY = -this.dirY;

            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < mouse.radius + this.size) {
                if (mouse.x < this.x && this.x < canvas.width - this.size * 10) this.x += 3;
                if (mouse.x > this.x && this.x > this.size * 10) this.x -= 3;
                if (mouse.y < this.y && this.y < canvas.height - this.size * 10) this.y += 3;
                if (mouse.y > this.y && this.y > this.size * 10) this.y -= 3;
            }
            this.draw();
        }
    }

    function initParticles() {
        particlesArray = [];
        let num = (canvas.height * canvas.width) / 9000;
        for (let i = 0; i < num; i++) {
            let size = (Math.random() * 1.5) + 0.5;
            let x = (Math.random() * (innerWidth - size * 2));
            let y = (Math.random() * (innerHeight - size * 2));
            let dirX = (Math.random() * 0.4) - 0.2;
            let dirY = (Math.random() * 0.4) - 0.2;
            particlesArray.push(new Particle(x, y, dirX, dirY, size));
        }
    }

    function connectParticles() {
        for (let a = 0; a < particlesArray.length; a++) {
            for (let b = a; b < particlesArray.length; b++) {
                let dist = ((particlesArray[a].x - particlesArray[b].x) ** 2) + ((particlesArray[a].y - particlesArray[b].y) ** 2);
                if (dist < (canvas.width / 7) * (canvas.height / 7)) {
                    let opacity = 1 - (dist / 20000);
                    ctx.strokeStyle = `rgba(0, 170, 255, ${opacity * 0.2})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                    ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                    ctx.stroke();
                }
            }
        }
    }

    function animateParticles() {
        requestAnimationFrame(animateParticles);
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update();
        }
        connectParticles();
    }

    // Events
    window.addEventListener('mousemove', e => { mouse.x = e.x; mouse.y = e.y; });
    window.addEventListener('mouseout', () => { mouse.x = null; mouse.y = null; });
    window.addEventListener('resize', () => {
        canvas.width = innerWidth; canvas.height = innerHeight;
        mouse.radius = (canvas.height / 120) * (canvas.width / 120);
        initParticles();
    });

    initParticles();
    animateParticles();
});
