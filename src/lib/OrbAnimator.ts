export class OrbAnimator {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  particles: any[];
  rafId: number | null;
  center: { x: number; y: number };
  radius: number;
  orbColor: { r: number; g: number; b: number };
  pulseIntensity: number;
  pulseSpeed: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;
    this.particles = [];
    this.rafId = null;
    this.center = { x: 0, y: 0 };
    this.radius = 0;
    
    this.orbColor = { r: 0, g: 200, b: 255 };
    this.pulseIntensity = 1;
    this.pulseSpeed = 0.05;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
    this.center = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
    this.radius = Math.min(this.canvas.width, this.canvas.height) * 0.4;
  }

  createParticle() {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * this.radius;
    this.particles.push({
      x: this.center.x + Math.cos(angle) * distance,
      y: this.center.y + Math.sin(angle) * distance,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 2 + 0.5,
      alpha: Math.random()
    });
  }

  updateParticles() {
    this.particles.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.005;

      if (p.alpha <= 0 || !this.isInsideOrb(p.x, p.y)) {
        this.particles.splice(i, 1);
        this.createParticle();
      }
    });
    while (this.particles.length < 100) {
        this.createParticle();
    }
  }

  isInsideOrb(x: number, y: number) {
    const dist = Math.sqrt(Math.pow(x - this.center.x, 2) + Math.pow(y - this.center.y, 2));
    return dist < this.radius * this.pulseIntensity;
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const currentRadius = this.radius * (1 + Math.sin(Date.now() * this.pulseSpeed) * 0.1 * this.pulseIntensity);
    this.ctx.beginPath();
    this.ctx.arc(this.center.x, this.center.y, currentRadius, 0, Math.PI * 2);
    const gradient = this.ctx.createRadialGradient(this.center.x, this.center.y, 0, this.center.x, this.center.y, currentRadius);
    gradient.addColorStop(0, `rgba(${this.orbColor.r}, ${this.orbColor.g}, ${this.orbColor.b}, 0.6)`);
    gradient.addColorStop(0.5, `rgba(${this.orbColor.r}, ${this.orbColor.g}, ${this.orbColor.b}, 0.3)`);
    gradient.addColorStop(1, `rgba(${this.orbColor.r}, ${this.orbColor.g}, ${this.orbColor.b}, 0)`);
    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    this.particles.forEach(p => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(${this.orbColor.r}, ${this.orbColor.g}, ${this.orbColor.b}, ${p.alpha})`;
      this.ctx.fill();
    });
  }

  animate() {
    this.updateParticles();
    this.draw();
    this.rafId = requestAnimationFrame(() => this.animate());
  }

  start() {
    if (!this.rafId) {
      this.particles = [];
      for (let i = 0; i < 100; i++) this.createParticle();
      this.animate();
    }
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setListeningState() {
    this.orbColor = { r: 0, g: 150, b: 255 };
    this.pulseIntensity = 1.2;
    this.pulseSpeed = 0.1;
  }

  setProcessingState() {
    this.orbColor = { r: 150, g: 0, b: 255 };
    this.pulseIntensity = 1.5;
    this.pulseSpeed = 0.2;
  }

  setSpeakingState() {
    this.orbColor = { r: 0, g: 255, b: 150 };
    this.pulseIntensity = 1.1;
    this.pulseSpeed = 0.05;
  }

  setIdleState() {
    this.orbColor = { r: 0, g: 200, b: 255 };
    this.pulseIntensity = 1;
    this.pulseSpeed = 0.03;
  }
}