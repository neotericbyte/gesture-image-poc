import GestroEngine from "./gestro-engine.js";

class GestroImage extends HTMLElement {
	static get observedAttributes() {
		return ["src"];
	}

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

			contain: layout paint size;
			transform: translateZ(0);
			}

			img {
			position: absolute;
			top: 50%;
			left: 50%;
			transform-origin: center;

			will-change: transform;
			transform: translateZ(0);
			backface-visibility: hidden;
			-webkit-backface-visibility: hidden;

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

		// transform state
		this.baseScale = 1;
		this.userScale = 1;
		this.rotation = 0;
		this.x = 0;
		this.y = 0;

		this.minScale = 0.2;
		this.maxScale = 5;

		// RAF batching
		this._raf = null;

		// double tap
		this._lastTapTime = 0;
		this._lastTapPos = null;
		this._tapTimeout = 300;
		this._tapMoveThreshold = 10;

		this._initGestures();
	}

	// =========================
	// LIFECYCLE
	// =========================

	connectedCallback() {
		const src = this.getAttribute("src");
		if (src) this.setImage(src);
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (name === "src" && newValue && newValue !== oldValue) {
			this.setImage(newValue);
		}
	}

	// =========================
	// GESTURES
	// =========================

	_initGestures() {
		this.gesture = new GestroEngine(this.container, {
			onPan: ({ dx, dy }) => {
				this.x += dx;
				this.y += dy;

				const { maxX, maxY } = this._getBounds();

				this.x = this._rubberBand(this.x, maxX);
				this.y = this._rubberBand(this.y, maxY);

				this._requestUpdate();
			},

			onPinchRotate: ({ scaleFactor, rotationDelta }) => {
				this.userScale *= scaleFactor;
				this._clampScale();

				this.rotation += rotationDelta;
				this._normalizeRotation();

				this._requestUpdate();
				this._emitTransform();
			},

			onEnd: (e) => {
				if (this.gesture.pointers.size === 0) {
					this._handleDoubleTap(e);
				}
				this._snapToBounds();
			}
		});
	}

	// =========================
	// RAF
	// =========================

	_requestUpdate() {
		if (this._raf) return;

		this._raf = requestAnimationFrame(() => {
			this._raf = null;
			this._update();
		});
	}

	// =========================
	// DOUBLE TAP
	// =========================

	_handleDoubleTap(e) {
		const now = performance.now();
		const x = e.clientX;
		const y = e.clientY;

		let isDoubleTap = false;

		if (this._lastTapTime) {
			const dt = now - this._lastTapTime;

			if (dt < this._tapTimeout && this._lastTapPos) {
				const dx = x - this._lastTapPos.x;
				const dy = y - this._lastTapPos.y;

				if (Math.hypot(dx, dy) < this._tapMoveThreshold) {
					isDoubleTap = true;
				}
			}
		}

		this._lastTapTime = now;
		this._lastTapPos = { x, y };

		if (isDoubleTap) {
			this.resetTransform();
		}
	}

	// =========================
	// PUBLIC API
	// =========================

	setScale(scale) {
		this.userScale = scale;
		this._clampScale();
		this._requestUpdate();
		this._emitTransform();
	}

	scale(delta = 0.1) {
		this.userScale += delta;
		this._clampScale();
		this._requestUpdate();
		this._emitTransform();
	}

	// backward compatibility
	setZoom(scale) {
		console.warn("setZoom() is deprecated. Use setScale()");
		this.setScale(scale);
	}

	zoom(delta = 0.1) {
		console.warn("zoom() is deprecated. Use scale()");
		this.scale(delta);
	}

	setRotation(deg) {
		this.rotation = deg;
		this._normalizeRotation();
		this._requestUpdate();
		this._emitTransform();
	}

	rotate(delta = 10) {
		this.rotation += delta;
		this._normalizeRotation();
		this._requestUpdate();
		this._emitTransform();
	}

	resetTransform() {
		this.userScale = 1;
		this.rotation = 0;
		this.x = 0;
		this.y = 0;
		this._requestUpdate();
		this._emitTransform();
	}

	center() {
		this.x = 0;
		this.y = 0;
		this._requestUpdate();
	}

	// =========================
	// IMAGE
	// =========================

	setImage(src) {
		if (this.img.src === src) return;

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
		const finalScale = this.baseScale * this.userScale;

		const displayedWidth = img.width * finalScale;
		const displayedHeight = img.height * finalScale;

		const ratioX = img.width / displayedWidth;
		const ratioY = img.height / displayedHeight;

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");

		canvas.width = rect.width * ratioX;
		canvas.height = rect.height * ratioY;

		ctx.translate(canvas.width / 2, canvas.height / 2);

		ctx.translate(this.x * ratioX, this.y * ratioY);
		ctx.rotate(this.rotation * Math.PI / 180);
		ctx.scale(finalScale * ratioX, finalScale * ratioY);

		ctx.drawImage(img, -img.width / 2, -img.height / 2);

		return canvas.toDataURL("image/png");
	}

	_applyCoverScale(imgW, imgH) {
		const rect = this.container.getBoundingClientRect();

		const scaleX = rect.width / imgW;
		const scaleY = rect.height / imgH;

		this.baseScale = Math.max(scaleX, scaleY);

		this.userScale = 1;
		this.rotation = 0;
		this.x = 0;
		this.y = 0;

		this._requestUpdate();
	}

	// =========================
	// BOUNDS
	// =========================

	_getBounds() {
		const rect = this.container.getBoundingClientRect();
		const finalScale = this.baseScale * this.userScale;

		const imgW = this.img.naturalWidth * finalScale;
		const imgH = this.img.naturalHeight * finalScale;

		const maxX = Math.max(0, (imgW - rect.width) / 2);
		const maxY = Math.max(0, (imgH - rect.height) / 2);

		return { maxX, maxY };
	}

	_rubberBand(value, limit) {
		const abs = Math.abs(value);
		if (abs <= limit) return value;

		const excess = abs - limit;
		const resistance = 0.35;

		const reduced = limit + excess * resistance;
		return value < 0 ? -reduced : reduced;
	}

	// =========================
	// SNAP BACK
	// =========================

	_snapToBounds() {
		const { maxX, maxY } = this._getBounds();

		const clamp = (v, max) => Math.max(-max, Math.min(v, max));

		const targetX = clamp(this.x, maxX);
		const targetY = clamp(this.y, maxY);

		if (targetX === this.x && targetY === this.y) return;

		const startX = this.x;
		const startY = this.y;

		const duration = 300;
		const startTime = performance.now();

		const animate = (now) => {
			const t = Math.min(1, (now - startTime) / duration);
			const ease = 1 - Math.pow(1 - t, 3);

			this.x = startX + (targetX - startX) * ease;
			this.y = startY + (targetY - startY) * ease;

			this._update();

			if (t < 1) requestAnimationFrame(animate);
		};

		requestAnimationFrame(animate);
	}

	// =========================
	// RENDER
	// =========================

	_update() {
		const finalScale = this.baseScale * this.userScale;

		this.img.style.transform = `
      translate3d(-50%, -50%, 0)
      translate3d(${this.x}px, ${this.y}px, 0)
      rotate(${this.rotation}deg)
      scale(${finalScale})
    `;
	}

	_emitTransform() {
		this.dispatchEvent(
			new CustomEvent("transform", {
				detail: {
					scale: this.userScale,
					rotation: this.rotation,
					x: this.x,
					y: this.y
				}
			})
		);
	}

	_clampScale() {
		this.userScale = Math.max(this.minScale, Math.min(this.userScale, this.maxScale));
	}

	_normalizeRotation() {
		this.rotation = this.rotation % 360;
	}
}

customElements.define("gestro-image", GestroImage);