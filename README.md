# Gestro

**Minimal gesture engine for image transforms.**
Pan • Zoom • Rotate • Export — powered by pointer gestures.

---

## 🔗 Live Demo

👉 https://neotericbyte.github.io/gestro/example

---

## ✨ Features

* Multi-touch gestures (pinch, rotate, drag)
* Works on mobile + desktop (Pointer Events)
* High-quality export (original resolution)
* No dependencies
* Lightweight & fast
* Web Component (framework agnostic)

---

## 📦 Installation

```bash
npm install gestro
```

---

## 🚀 Basic Usage

```html
<gestro-image id="editor"></gestro-image>

<script type="module">
  import "gestro";

  window.addEventListener("DOMContentLoaded", () => {
    const editor = document.getElementById("editor");

    const init = () => {
      if (!editor || typeof editor.setImage !== "function") {
        requestAnimationFrame(init);
        return;
      }

      editor.setImage("https://picsum.photos/800/1200");
    };

    init();
  });
</script>
```

---

## ⚠️ Important Note

Gestro is a Web Component. Methods may not be available immediately if called too early.

Always ensure the element is upgraded before calling APIs.

---

## 🎛 API

### Image
- `setImage(src: string)`

### Zoom
- `zoom(delta?: number)`
- `setZoom(scale: number)`

### Rotation
- `rotate(deltaDeg?: number)`
- `setRotation(deg: number)`

### Position
- `center()`
- `resetTransform()`

### Export
- `exportImage(): Promise<string>`
Returns PNG data URL of visible cropped area in original quality

---

## 🧩 Integration Guide

### Vanilla JS

```html
<gestro-image id="editor"></gestro-image>

<script type="module">
  import "gestro";

  window.addEventListener("DOMContentLoaded", () => {
    const el = document.getElementById("editor");

    const init = () => {
      if (!el || typeof el.setImage !== "function") {
        requestAnimationFrame(init);
        return;
      }

      el.setImage("image.jpg");
    };

    init();
  });
</script>
```

---

### React

```jsx
import { useEffect, useRef } from "react";
import "gestro";

export default function App() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;

    const init = () => {
      if (!el || typeof el.setImage !== "function") {
        requestAnimationFrame(init);
        return;
      }

      el.setImage("image.jpg");
    };

    init();
  }, []);

  return <gestro-image ref={ref}></gestro-image>;
}
```

---

### Angular

Enable custom elements:

```ts
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@NgModule({
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule {}
```

Usage:

```html
<gestro-image #editor></gestro-image>
```

```ts
@ViewChild('editor') editor!: ElementRef;

ngAfterViewInit() {
  const el = this.editor.nativeElement;

  const init = () => {
    if (!el || typeof el.setImage !== "function") {
      requestAnimationFrame(init);
      return;
    }

    el.setImage('image.jpg');
  };

  init();
}
```

---

## 🧠 Philosophy

Gestro is a low-level primitive, not a full editor.

Use it to build:
- image editors
- croppers
- social media tools
- design apps

---

## 📁 Package Contents

- dist/ → production build
- types/ → TypeScript definitions

---

## 📄 License

MIT

---

## ⭐ Support

If you find this useful, consider starring the repo ⭐
