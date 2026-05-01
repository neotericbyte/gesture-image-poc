import GestroEngine from "./gestro-engine.js";

class GestroImage extends HTMLElement {
	static get observedAttributes() {
		return ["src"];
	}

	constructor() {
		super();

		this.attachShadow({ mode: "open" });
		this.shadowRoot.innerHTML = this._template();

		// DOM
		this.container = this.shadowRoot.querySelector(".container");
		this.img = this.shadowRoot.querySelector("img");

		// =========================
		// STATE
		// =========================
		this._state = {
			baseScale: 1,
			userScale: 1,
			rotation: 0,
			x: 0,
			y: 0
		};

		this._config = {
			minScale: 0.2,
			maxScale: 5,
			maxHistory: 50
		};

		// history
		this._history = [];
		this._future = [];

		// render
		this._raf = null;

		// gesture helpers
		this._tap = {
			lastTime: 0,
			lastPos: null,
			timeout: 300,
			threshold: 10
		};

		this._initGestures();
		this._initKeyboard();
	}

	// =========================
	// TEMPLATE
	// =========================

	_template() {
		return `
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
		</div>`;
	}

	// =========================
	// LIFECYCLE
	// =========================

	connectedCallback() {
		const src = this.getAttribute("src");
		if (src) this.setImage(src);
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (name === "src" && newValue !== oldValue) {
			this.setImage(newValue);
		}
	}

	// =========================
	// GESTURES
	// =========================

	_initGestures() {
		this.gesture = new GestroEngine(this.container, {
			onPan: ({ dx, dy }) => {
				this._state.x += dx;
				this._state.y += dy;

				this._applyBounds();
				this._requestRender();
			},

			onPinchRotate: ({ scaleFactor, rotationDelta }) => {
				this._state.userScale *= scaleFactor;
				this._clampScale();

				this._state.rotation += rotationDelta;
				this._normalizeRotation();

				this._requestRender();
				this._emitTransform();
			},

			onEnd: (e) => {
				if (this.gesture.pointers.size === 0) {
					this._handleDoubleTap(e);
					this._snapToBounds();
					this._pushHistory();
				}
			}
		});
	}

	_initKeyboard() {
		window.addEventListener("keydown", (e) => {
			if (!(e.ctrlKey || e.metaKey)) return;

			if (e.key.toLowerCase() !== "z") return;

			e.preventDefault();
			e.shiftKey ? this.redo() : this.undo();
		});
	}

	// =========================
	// STATE HELPERS
	// =========================

	_getState() {
		return { ...this._state };
	}

	_setState(silent = false, state) {
		Object.assign(this._state, state);
		this._requestRender();
		if (!silent) this._emitTransform();
	}

	// =========================
	// HISTORY
	// =========================

	_pushHistory() {
		const s = this._getState();
		const last = this._history.at(-1);

		if (last && this._isSameState(last, s)) return;

		this._history.push(s);
		if (this._history.length > this._config.maxHistory) {
			this._history.shift();
		}

		this._future.length = 0;
	}

	_isSameState(a, b) {
		return (
			a.x === b.x &&
			a.y === b.y &&
			a.userScale === b.userScale &&
			a.rotation === b.rotation
		);
	}

	undo() {
		if (this._history.length <= 1) return;

		this._future.push(this._history.pop());
		this._setState(false, this._history.at(-1));
	}

	redo() {
		if (!this._future.length) return;

		const next = this._future.pop();
		this._history.push(next);
		this._setState(false, next);
	}

	// =========================
	// DOUBLE TAP
	// =========================

	_handleDoubleTap(e) {
		const now = performance.now();
		const { lastTime, lastPos, timeout, threshold } = this._tap;

		let isDouble = false;

		if (lastTime && lastPos) {
			const dt = now - lastTime;
			const dist = Math.hypot(e.clientX - lastPos.x, e.clientY - lastPos.y);

			isDouble = dt < timeout && dist < threshold;
		}

		this._tap.lastTime = now;
		this._tap.lastPos = { x: e.clientX, y: e.clientY };

		if (isDouble) this.resetTransform();
	}

	// =========================
	// PUBLIC API
	// =========================

	setScale(scale) {
		this._state.userScale = scale;
		this._clampScale();
		this._requestRender();
		this._emitTransform();
		this._pushHistory();
	}

	setRotation(deg) {
		this._state.rotation = deg;
		this._normalizeRotation();
		this._requestRender();
		this._emitTransform();
		this._pushHistory();
	}

	resetTransform() {
		Object.assign(this._state, {
			userScale: 1,
			rotation: 0,
			x: 0,
			y: 0
		});

		this._requestRender();
		this._emitTransform();
		this._pushHistory();
	}

	center() {
		this._state.x = 0;
		this._state.y = 0;
		this._requestRender();
		this._pushHistory();
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
				this._applyCover(temp.width, temp.height);
			});
		};

		temp.src = src;
	}

	_applyCover(w, h) {
		const rect = this.container.getBoundingClientRect();

		const sx = rect.width / w;
		const sy = rect.height / h;

		this._state.baseScale = Math.max(sx, sy);

		this._state.userScale = 1;
		this._state.rotation = 0;
		this._state.x = 0;
		this._state.y = 0;

		this._history = [];
		this._future = [];

		this._requestRender();
		this._pushHistory();
	}

	// =========================
	// BOUNDS
	// =========================

	_applyBounds() {
		const { maxX, maxY } = this._getBounds();

		this._state.x = this._softClamp(this._state.x, maxX);
		this._state.y = this._softClamp(this._state.y, maxY);
	}

	_getBounds() {
		const rect = this.container.getBoundingClientRect();
		const s = this._state.baseScale * this._state.userScale;

		const w = this.img.naturalWidth * s;
		const h = this.img.naturalHeight * s;

		if (w < rect.width || h < rect.height) {
			return {
				maxX: Math.abs((rect.width - w) / 2),
				maxY: Math.abs((rect.height - h) / 2)
			};
		}

		return {
			maxX: (w - rect.width) / 2,
			maxY: (h - rect.height) / 2
		};
	}

	_softClamp(v, limit) {
		const a = Math.abs(v);
		if (a <= limit) return v;

		const excess = a - limit;
		const t = Math.min(1, excess / 120);

		const r = 1 - Math.pow(1 - t, 3);

		const out = limit + excess * r * 0.2;
		return v < 0 ? -out : out;
	}

	// =========================
	// RENDER
	// =========================

	_requestRender() {
		if (this._raf) return;

		this._raf = requestAnimationFrame(() => {
			this._raf = null;
			this._render();
		});
	}

	_render() {
		const s = this._state.baseScale * this._state.userScale;

		this.img.style.transform = `
			translate3d(-50%, -50%, 0)
			translate3d(${this._state.x}px, ${this._state.y}px, 0)
			rotate(${this._state.rotation}deg)
			scale(${s})
		`;
	}

	_emitTransform() {
		this.dispatchEvent(
			new CustomEvent("transform", {
				detail: {
					scale: this._state.userScale,   // ✅ restore expected API
					rotation: this._state.rotation,
					x: this._state.x,
					y: this._state.y
				}
			})
		);
	}

	// =========================
	// UTIL
	// =========================

	_clampScale() {
		const { minScale, maxScale } = this._config;

		this._state.userScale = Math.max(
			minScale,
			Math.min(maxScale, this._state.userScale)
		);
	}

	_normalizeRotation() {
		this._state.rotation %= 360;
	}

	// =========================
	// SNAP
	// =========================

	_snapToBounds() {
		const { maxX, maxY } = this._getBounds();

		const clamp = (v, m) => Math.max(-m, Math.min(v, m));

		const tx = clamp(this._state.x, maxX);
		const ty = clamp(this._state.y, maxY);

		if (tx === this._state.x && ty === this._state.y) return;

		const sx = this._state.x;
		const sy = this._state.y;

		const start = performance.now();
		const duration = 300;

		const anim = (t) => {
			const p = Math.min(1, (t - start) / duration);
			const e = 1 - Math.pow(1 - p, 3);

			this._state.x = sx + (tx - sx) * e;
			this._state.y = sy + (ty - sy) * e;

			this._render();

			if (p < 1) requestAnimationFrame(anim);
		};

		requestAnimationFrame(anim);
	}

	// =========================
	// EXPORT
	// =========================

	async exportImage() {
		const img = new Image();
		img.src = this.img.src;
		await img.decode();

		const rect = this.container.getBoundingClientRect();

		const final = this._state.baseScale * this._state.userScale;

		const dw = img.width * final;
		const dh = img.height * final;

		const rx = img.width / dw;
		const ry = img.height / dh;

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");

		canvas.width = rect.width * rx;
		canvas.height = rect.height * ry;

		ctx.translate(canvas.width / 2, canvas.height / 2);
		ctx.translate(this._state.x * rx, this._state.y * ry);
		ctx.rotate((this._state.rotation * Math.PI) / 180);
		ctx.scale(final * rx, final * ry);

		ctx.drawImage(img, -img.width / 2, -img.height / 2);

		return canvas.toDataURL("image/png");
	}
}

customElements.define("gestro-image", GestroImage);