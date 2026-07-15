# StylishSelect

<img src="https://raw.githubusercontent.com/Pro-Bandey/StylishSelect/src/social-.png" alt="StylishSelect examples" width="544"/>

A modular, highly accessible, and performance-oriented replacement for native HTML single select elements written in vanilla ES6.

[**View demo**](https://Pro-Bandey.github.io/StylishSelect/demos/)

## Motivation

**Why not just style a native select element with CSS?**  
Absolutely do that if it is sufficient for your layout. The primary goal of this project is to provide a customizable dropdown that seamlessly supports icon-based lists, modern transition flows, and isolated CSS custom variables while maintaining strong WAI-ARIA and native keyboard compliance.

## Features

- **Zero External Dependencies** — Written in modular vanilla ES6.
- **Native-Aligned Keyboard Navigation** — Supports immediate closed-state selection and open-state visual focus highlights.
- **Intelligent Focus Indicators** — Outlines are strictly mapped to active keyboard use (`.ss-keyboard-nav`), keeping mouse clicks clean.
- **Scoped Customization API** — Configure inline design overrides (`customStyles`) programmatically on a per-instance basis.
- **Dynamic Mutation Observers** — List data rebuilds and updates dynamically whenever native select attributes or nodes change.
- **Adaptive Preference Tracking** — Seamlessly matches system preference states (`prefers-color-scheme: dark`) on the `auto` theme setting.
- **Fully Accessible** — Built from the ground up to mirror native web controls.

---

## Getting Started

### Basic Usage

Download the [compiled release outputs](https://github.com/Pro-Bandey/StylishSelect/releases/latest) and reference them within your page layout:

```html
<link rel="stylesheet" href="dist/stylishselect.min.css" />
<script src="dist/stylishselect.min.js"></script>
```

Alternatively, load them from a CDN:

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/gh/Pro-Bandey/StylishSelect@latest/dist/stylishselect.min.css"
/>
<script src="https://cdn.jsdelivr.net/gh/Pro-Bandey/StylishSelect@latest/dist/stylishselect.min.js"></script>
```

Add the `stylish-select` attribute to your native HTML selects. They will be detected and initialized automatically:

```html
<select id="my-select" stylish-select>
  <option value="1">Option One</option>
  <option value="2">Option Two</option>
</select>
```

You can pass configuration parameters directly using token declarations:

```html
<!-- Formats: theme style animation -->
<select stylish-select="dark modern zoom">
  <option>Option One</option>
</select>
```

---

### Excluding Specific Elements

To preserve native select rendering for specific elements on a page, simply add the `fsb-ignore` CSS class to the select tag:

```html
<!-- Renders as a standard native select -->
<select id="ignored-select" class="fsb-ignore">
  <option>Native Option</option>
</select>
```

---

### Programmatic Initialization

Use the factory construct to instantiate or manipulate select nodes programmatically:

```javascript
// Initialize on a query selector
const select = StylishSelect.create("#my-select", {
  theme: "auto",
  style: "modern",
  animation: {
    open: "zoom",
    close: "fade",
    duration: 200,
    easing: "ease-out",
  },
  searchable: true,
  storage: true,
});
```

---

## WAI-ARIA Keyboard Specification

StylishSelect handles key events to match standard browser control behaviors:

| State      | Key Trigger                         | Action Completed                                                    |
| :--------- | :---------------------------------- | :------------------------------------------------------------------ |
| **Closed** | `ArrowDown` / `ArrowRight`          | Instantly selects the next option and fires update hooks.           |
| **Closed** | `ArrowUp` / `ArrowLeft`             | Instantly selects the previous option and fires update hooks.       |
| **Closed** | `Alt + ArrowDown` / `Alt + ArrowUp` | Opens the dropdown menu without modifying active selection.         |
| **Closed** | `Space` / `Enter`                   | Opens the dropdown menu.                                            |
| **Open**   | `ArrowDown` / `ArrowUp`             | Cycles visual focus highlight (`.ss-focused`).                      |
| **Open**   | `Enter` / `Space`                   | Commits current visual option, updates selected state, and closes.  |
| **Open**   | `Escape`                            | Reverts visual option focus to the last committed index and closes. |
| **Open**   | `Tab`                               | Commits highlighted focus option, closes menu, and shifts focus.    |
| **Both**   | `Printable Keys`                    | Triggers typeahead search (cycles matching prefix options).         |

---

## Customization

You can customize elements using either scoped CSS Custom Properties (CSS variables) or programmatically via the JavaScript API.

### 1. Scoped CSS Design Tokens

Since CSS variables are declared inside the `.ss-container` selector, you can safely override them at the block level without polluting global scope:

```css
.my-custom-wrapper {
  --ss-bg: #312e81;
  --ss-color: #ffffff;
  --ss-border-color: #4338ca;
  --ss-accent: #f59e0b;
  --ss-accent-color: #1e1b4b;
  --ss-radius: 12px;
  --ss-padding: 12px 18px;
}
```

### 2. JavaScript `customStyles` API

To customize single instances dynamically on initialization, use the `customStyles` configuration parameter:

```javascript
StylishSelect.create("#target-select", {
  theme: "light",
  style: "modern",
  customStyles: {
    bg: "#312e81", // Dropdown background
    color: "#ffffff", // Text color
    accent: "#f59e0b", // Active selection color
    accentColor: "#1e1b4b", // Active selection text
    hoverBg: "#4338ca", // Option hover state
    hoverColor: "#ffffff", // Option hover text
    radius: "16px", // Border radius
    padding: "12px 18px", // Padding dimensions
    margin: "4px", // Margin dimension
  },
});
```

---

## Dynamic Updates & API Methods

The API provides helper methods to handle dynamic mutations, disabling states, and selections:

```javascript
const selectEl = document.getElementById("my-select");

// 1. Update options dynamically (automatically handled if DOM nodes change)
StylishSelect.update(selectEl);

// 2. Programmatically open, close, or toggle
StylishSelect.open(selectEl);
StylishSelect.close(selectEl);
StylishSelect.toggle(selectEl);

// 3. Programmatically enable / disable
StylishSelect.disable(selectEl);
StylishSelect.enable(selectEl);

// 4. Force option selection by value
StylishSelect.select(selectEl, "my-option-value");

// 5. Safely teardown and restore native elements
StylishSelect.destroy(selectEl);
```

---

## Custom Event Listeners

Custom events are dispatched directly on the native select element, making integrating with other framework event systems straightforward:

```javascript
const nativeSelect = document.getElementById("my-select");

// Triggered when the dropdown begins opening
nativeSelect.addEventListener("ss:open", (event) => {
  console.log("Dropdown is opening.");
});

// Triggered when selection state changes
nativeSelect.addEventListener("ss:change", (event) => {
  const { value, text, index } = event.detail;
  console.log(`Selected Value: ${value} | Text: ${text} | Index: ${index}`);
});

// Triggered when dropdown closes
nativeSelect.addEventListener("ss:close", (event) => {
  console.log("Dropdown closed.");
});
```

---

## Dynamic Option Icons

StylishSelect supports inline SVG sprites on option nodes. Reference valid SVG sprite IDs using the `data-icon` attribute:

```html
<select stylish-select>
  <option value="home" data-icon="#icon-home">Home Page</option>
  <option value="settings" data-icon="#icon-settings">Settings</option>
</select>
```

---

## Building From Source

Install the workspace packages:

```bash
npm install
```

Compile and build stylesheet and script assets:

```bash
npm run build
```

Compiled distributions are exported directly to the `/dist` output directory.
