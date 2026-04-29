class GestureImage extends HTMLElement {
	constructor() {
		super();

		this.attachShadow({ mode: "open" });

		this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
        }

        .container {
          width: 100%;
          height: 100%;
          overflow: hidden;
          touch-action: none;
          position: relative;
          background: #000;
        }

        img {
          position: absolute;
          top: 50%;
          left: 50%;
          transform-origin: center;
          will-change: transform;
          max-width: none;
          max-height: none;
          user-select: none;
          pointer-events: none;
        }
      </style>
      <div class="container">
        <img />
      </div>
    `;

		this.container = this.shadowRoot.querySelector(".container");
		this.img = this.shadowRoot.querySelector("img");

		// gesture state
		this.pointers = new Map();
		this.startDistance = 0;
		this.startAngle = 0;

		// transform state
		this.baseScale = 1;
		this.userScale = 1;
		this.rotation = 0;
		this.x = 0;
		this.y = 0;

		this.minScale = 0.2;
		this.maxScale = 5;

		this._bindEvents();
	}

	// =========================
	// PUBLIC API
	// =========================

	setImage(src) {
		const temp = new Image();

		temp.onload = () => {
			this.img.src = src;

			requestAnimationFrame(() => {
				this._applyCoverScale(temp.width, temp.height);
			});
		};

		temp.src = src;
	}

	async exportImage() {
		const img = new Image();
		img.src = this.img.src;
		await img.decode();

		const rect = this.container.getBoundingClientRect();

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");

		// ✅ canvas = visible frame
		canvas.width = rect.width;
		canvas.height = rect.height;

		const finalScale = this.baseScale * this.userScale;

		// move origin to center of frame
		ctx.translate(canvas.width / 2, canvas.height / 2);

		// apply SAME transform order
		ctx.translate(this.x, this.y);
		ctx.rotate(this.rotation * Math.PI / 180);
		ctx.scale(finalScale, finalScale);

		// draw image centered
		ctx.drawImage(
			img,
			-img.width / 2,
			-img.height / 2
		);

		return canvas.toDataURL("image/png");
	}

	// ---- External Controls ----

	zoom(delta = 0.1) {
		this.userScale += delta;
		this._clampScale();
		this._update();
	}

	setZoom(scale) {
		this.userScale = scale;
		this._clampScale();
		this._update();
	}

	rotate(deltaDeg = 10) {
		this.rotation += deltaDeg;
		this._normalizeRotation();
		this._update();
	}

	setRotation(deg) {
		this.rotation = deg;
		this._normalizeRotation();
		this._update();
	}

	resetTransform() {
		this.userScale = 1;
		this.rotation = 0;
		this.x = 0;
		this.y = 0;
		this._update();
	}

	center() {
		this.x = 0;
		this.y = 0;
		this._update();
	}

	// =========================
	// INTERNAL
	// =========================

	_applyCoverScale(imgW, imgH) {
		const rect = this.container.getBoundingClientRect();

		const scaleX = rect.width / imgW;
		const scaleY = rect.height / imgH;

		this.baseScale = Math.max(scaleX, scaleY);

		this.userScale = 1;
		this.rotation = 0;
		this.x = 0;
		this.y = 0;

		this._update();
	}

	_bindEvents() {
		this.container.onpointerdown = (e) => {
			this.container.setPointerCapture(e.pointerId);

			this.pointers.set(e.pointerId, {
				x: e.clientX,
				y: e.clientY,
				prevX: e.clientX,
				prevY: e.clientY
			});

			if (this.pointers.size === 2) {
				const vals = Array.from(this.pointers.values());
				this.startDistance = this._distance(vals[0], vals[1]);
				this.startAngle = this._angle(vals[0], vals[1]);
			}
		};

		this.container.onpointermove = (e) => {
			if (!this.pointers.has(e.pointerId)) return;

			const p = this.pointers.get(e.pointerId);

			const dx = e.clientX - p.prevX;
			const dy = e.clientY - p.prevY;

			p.prevX = e.clientX;
			p.prevY = e.clientY;
			p.x = e.clientX;
			p.y = e.clientY;

			this.pointers.set(e.pointerId, p);

			// ✅ PAN (works after rotation)
			if (this.pointers.size === 1) {
				this.x += dx;
				this.y += dy;
			}

			// ✅ PINCH + ROTATE
			if (this.pointers.size === 2) {
				const vals = Array.from(this.pointers.values());
				const a = vals[0];
				const b = vals[1];

				const newDist = this._distance(a, b);
				const scaleFactor = newDist / this.startDistance;
				this.userScale *= scaleFactor;

				this._clampScale();

				const newAngle = this._angle(a, b);
				this.rotation += (newAngle - this.startAngle);
				this._normalizeRotation();

				this.startDistance = newDist;
				this.startAngle = newAngle;
			}

			requestAnimationFrame(() => this._update());
		};

		this.container.onpointerup = (e) => {
			this.pointers.delete(e.pointerId);
		};

		this.container.onpointercancel = (e) => {
			this.pointers.delete(e.pointerId);
		};
	}

	_update() {
		const finalScale = this.baseScale * this.userScale;

		this.img.style.transform = `
    translate(-50%, -50%)
    translate(${this.x}px, ${this.y}px)
    rotate(${this.rotation}deg)
    scale(${finalScale})
  `;
	}

	_clampScale() {
		this.userScale = Math.max(this.minScale, Math.min(this.userScale, this.maxScale));
	}

	_normalizeRotation() {
		this.rotation = this.rotation % 360;
	}

	_distance(a, b) {
		return Math.hypot(b.x - a.x, b.y - a.y);
	}

	_angle(a, b) {
		return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
	}
}

customElements.define("gesture-image", GestureImage);