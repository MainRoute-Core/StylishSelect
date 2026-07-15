/*!
 * StylishSelect
 * An accessible, multi-thematic, dynamic drop-in replacement for native select elements.
 * Built with absolute structural isolation, a high-performance rendering pipeline,
 * custom animation drivers, and robust WAI-ARIA compliance.
 * 
 * Licensed under the GNU GENERAL PUBLIC LICENSE.
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
      (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.StylishSelect = factory());
})(this, function () {
  'use strict';

  // Private Registry maps native select elements to their StylishSelect instances
  const instances = new WeakMap();

  // Registry validation stores
  const VALID_THEMES = new Set([
    'light', 'dark', 'amoled', 'github', 'dracula', 'nord', 'solarized',
    'catppuccin', 'tokyo-night', 'gruvbox', 'material', 'one-dark', 'high-contrast', 'auto'
  ]);

  const VALID_STYLES = new Set([
    'classic', 'modern', 'rounded', 'terminal', 'retro', 'neon', 'chrome',
    'firefox', 'windows11', 'android', 'ios', 'md3', 'macos', 'fluent', 'glass', 'minimal', 'compact'
  ]);

  const VALID_ANIMATIONS = new Set([
    'fade', 'scale', 'zoom', 'slide', 'bounce', 'flip', 'grow', 'shrink', 'rotate',
    'swing', 'elastic', 'blur', 'float', 'pop', 'drop', 'fold', 'expand', 'collapse', 'none'
  ]);

  // Global settings for newly registered variants
  const registeredThemes = new Map();
  const registeredStyles = new Map();
  const registeredAnimations = new Map();

  // Unified global Storage Helper
  const StorageManager = {
    prefix: 'ss-',
    set(key, value) {
      try {
        localStorage.setItem(this.prefix + key, value);
      } catch (e) {
        // Fallback for isolated contexts / private browsing limits
      }
    },
    get(key) {
      try {
        return localStorage.getItem(this.prefix + key);
      } catch (e) {
        return null;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(this.prefix + key);
      } catch (e) {
        // Safe bypass
      }
    }
  };

  // Safe global DOM stylesheet injector for programmatically registered properties
  const StyleInjector = {
    sheet: null,
    inject(id, cssText) {
      if (!this.sheet) {
        const style = document.createElement('style');
        style.id = 'ss-dynamic-styles';
        document.head.appendChild(style);
        this.sheet = style.sheet;
      }
      // Remove previous rules under same ID if existing
      this.remove(id);

      // Translate the targeting selector dynamically to match instance attributes
      let selector = `[data-ss-inject="${id}"]`;
      if (id.startsWith('theme-')) {
        const themeName = id.replace('theme-', '');
        selector = `[data-ss-theme="${themeName}"]`;
      } else if (id.startsWith('style-')) {
        const styleName = id.replace('style-', '');
        selector = `[data-ss-style="${styleName}"]`;
      } else if (id.startsWith('anim-')) {
        const animName = id.replace('anim-', '');
        selector = `[data-ss-anim="${animName}"] .ss-dropdown`;
      }

      const index = this.sheet.insertRule(`${selector} { ${cssText} }`, this.sheet.cssRules.length);
      this.sheet.cssRules[index]._ssId = id;
    },
    remove(id) {
      if (!this.sheet) return;
      for (let i = this.sheet.cssRules.length - 1; i >= 0; i--) {
        if (this.sheet.cssRules[i]._ssId === id) {
          this.sheet.deleteRule(i);
        }
      }
    }
  };

  // Adaptive System preference tracker (prefers-color-scheme)
  const SystemThemeObserver = {
    listeners: new Set(),
    mediaQuery: window.matchMedia('(prefers-color-scheme: dark)'),
    init() {
      this.mediaQuery.addEventListener('change', (e) => {
        const activeTheme = e.matches ? 'dark' : 'light';
        this.listeners.forEach(callback => callback(activeTheme));
      });
    },
    subscribe(callback) {
      this.listeners.add(callback);
      // Immediate execution with current state
      callback(this.mediaQuery.matches ? 'dark' : 'light');
    },
    unsubscribe(callback) {
      this.listeners.delete(callback);
    }
  };
  SystemThemeObserver.init();

  // Main utility parsing string configuration lists (e.g. class list, attribute lists)
  function parseConfigTokens(attrValue) {
    if (!attrValue) return {};
    const tokens = attrValue.split(/\s+/).map(t => t.toLowerCase().trim()).filter(Boolean);
    const parsed = {};

    tokens.forEach(token => {
      if (VALID_THEMES.has(token) || registeredThemes.has(token)) {
        parsed.theme = token;
      } else if (VALID_STYLES.has(token) || registeredStyles.has(token)) {
        parsed.style = token;
      } else if (VALID_ANIMATIONS.has(token) || registeredAnimations.has(token)) {
        parsed.animation = token;
      }
    });
    return parsed;
  }

  // Active keyboard tracking search variables
  let searchString = '';
  let searchTimeout = null;

  class StylishSelectInstance {
    constructor(select, config = {}) {
      this.select = select;
      this.index = StylishSelectInstance.counter++;

      // Merge configuration options in strict precedence order:
      const attrConfig = parseConfigTokens(select.getAttribute('stylish-select'));

      let rawAnim = select.getAttribute('data-ss-animation');
      let parsedAnim;
      if (rawAnim) {
        try {
          parsedAnim = JSON.parse(rawAnim);
        } catch (e) {
          parsedAnim = rawAnim; // Support string directly if JSON parsing fails
        }
      }

      const dataConfig = {
        theme: select.getAttribute('data-ss-theme') || undefined,
        style: select.getAttribute('data-ss-style') || undefined,
        animation: parsedAnim
      };
      // Clean undefined keys to keep fallback merges logical
      Object.keys(dataConfig).forEach(k => dataConfig[k] === undefined && delete dataConfig[k]);

      this.config = Object.assign({
        theme: 'auto',
        style: 'classic',
        animation: {
          open: 'zoom',
          close: 'fade',
          duration: 200,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
        },
        searchable: true,
        storage: true,
        customStyles: {} // Supports bg, accent, hoverBg, color, hoverColor, padding, margin, radius overrides
      }, attrConfig, dataConfig, config);

      // Support shorthand animation strings passed directly through program interfaces
      if (typeof this.config.animation === 'string') {
        this.config.animation = {
          open: this.config.animation,
          close: this.config.animation,
          duration: 200,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
        };
      }

      // Initialize State Properties
      this.isOpen = false;
      this.currentFocusOption = null;
      this.savedStorageTheme = null;
      this.savedStorageStyle = null;
      this.repositionFrame = null;
      this.committedSelectionIndex = select.selectedIndex;

      // Handle Storage persistence
      if (this.config.storage) {
        const storedTheme = StorageManager.get(`theme-${this.index}`);
        const storedStyle = StorageManager.get(`style-${this.index}`);
        if (storedTheme) this.config.theme = storedTheme;
        if (storedStyle) this.config.style = storedStyle;
      }

      this.boundSystemThemeChange = this.handleSystemThemeChange.bind(this);
      this.boundReposition = this.repositionDropdown.bind(this);

      this.buildDOM();
      this.bindEvents();
      this.applyTheme(this.config.theme);
      this.applyStyle(this.config.style);

      // Ensure system preferences are mapped to resolve scheme changes dynamically
      SystemThemeObserver.subscribe(this.boundSystemThemeChange);
    }

    buildDOM() {
      const parent = this.select.parentNode;

      this.container = document.createElement('span');
      this.container.className = 'ss-container';
      this.container.setAttribute('data-ss-id', this.index);
      this.container._ssInstance = this; // Avoid brittle DOM-traversal parents

      // Create screen-reader specific accessibility element
      this.label = document.createElement('span');
      this.label.id = `ss-label-${this.index}`;
      this.label.className = 'ss-label';
      this.label.style.display = 'none';
      this.label.textContent = this.retrieveNativeLabel();

      // Formulate active state control button
      this.button = document.createElement('button');
      this.button.id = `ss-button-${this.index}`;
      this.button.className = 'ss-button';
      this.button.setAttribute('type', 'button');
      this.button.setAttribute('aria-haspopup', 'listbox');
      this.button.setAttribute('aria-expanded', 'false');
      this.button.setAttribute('aria-disabled', this.select.disabled ? 'true' : 'false');
      this.button.setAttribute('aria-labelledby', `${this.label.id} ${this.button.id}`);
      this.button.innerHTML = '&nbsp;';

      if (this.select.disabled) {
        this.button.setAttribute('tabindex', '-1');
      }

      // Prepare Dropdown context structure
      this.dropdown = document.createElement('span');
      this.dropdown.className = 'ss-dropdown';
      this.dropdown.setAttribute('role', 'listbox');
      this.dropdown.setAttribute('tabindex', '-1');
      this.dropdown.setAttribute('aria-labelledby', this.label.id);
      this.dropdown.style.display = 'none';

      // Sizing support element leveraging CSS grid overlay logic
      this.resizeElement = document.createElement('span');
      this.resizeElement.className = 'ss-resize';

      // Assemble physical dropdown layout list
      this.rebuildOptions();

      // Structure tree assembly
      this.container.appendChild(this.label);
      this.container.appendChild(this.button);
      this.container.appendChild(this.dropdown);
      this.container.appendChild(this.resizeElement);

      // Suppress standard dropdown element output and inject current instance
      this.select.classList.add('ss-original');
      this.select.style.display = 'none';
      parent.insertBefore(this.container, this.select.nextSibling);
    }

    retrieveNativeLabel() {
      const parent = this.select.parentNode;
      let labelEl = null;

      if (parent && parent.nodeName === 'LABEL') {
        labelEl = parent;
      } else if (this.select.id) {
        labelEl = document.querySelector(`label[for="${this.select.id}"]`);
      }

      if (labelEl) {
        const textNodes = Array.from(labelEl.childNodes).filter(n => n.nodeType === 3);
        const text = textNodes.map(n => n.textContent.trim()).join(' ').trim();
        if (text) {
          labelEl.addEventListener('click', (e) => {
            if (e.target !== this.select && !this.container.contains(e.target)) {
              e.preventDefault();
              this.button.focus();
              this.toggle();
            }
          });
          return text;
        }
      }
      return 'Select Option';
    }

    applyCustomStyles() {
      const styles = this.config.customStyles;
      if (!styles || typeof styles !== 'object') return;

      const mappings = {
        bg: '--ss-bg',
        color: '--ss-color',
        accent: '--ss-accent',
        accentColor: '--ss-accent-color',
        hoverBg: '--ss-hover-bg',
        hoverColor: '--ss-hover-color',
        padding: '--ss-padding',
        margin: '--ss-margin',
        radius: '--ss-radius'
      };

      Object.keys(mappings).forEach(key => {
        if (styles[key] !== undefined && styles[key] !== null) {
          this.container.style.setProperty(mappings[key], styles[key]);
          
          // Cascading fallback variables
          if (key === 'bg') this.container.style.setProperty('--ss-list-bg', styles.bg);
          if (key === 'color') this.container.style.setProperty('--ss-list-color', styles.color);
          if (key === 'accent') this.container.style.setProperty('--ss-selected-bg', styles.accent);
          if (key === 'accentColor') this.container.style.setProperty('--ss-selected-color', styles.accentColor);
          if (key === 'radius') this.container.style.setProperty('--ss-list-radius', styles.radius);
        }
      });
    }

    rebuildOptions() {
      this.dropdown.innerHTML = '';
      this.resizeElement.innerHTML = '';

      const options = Array.from(this.select.options);
      let longestNode = null;
      let maxLength = 0;

      options.forEach((option, idx) => {
        const item = document.createElement('span');
        item.className = 'ss-option';
        item.setAttribute('role', 'option');
        item.setAttribute('id', `ss-opt-${this.index}-${idx}`);
        item.setAttribute('data-ss-value', option.value);
        item.setAttribute('tabindex', '-1');

        const isSelected = option.selected;
        item.setAttribute('aria-selected', isSelected ? 'true' : 'false');

        if (option.disabled) {
          item.setAttribute('aria-disabled', 'true');
          item.classList.add('ss-disabled');
        }

        // Incorporate native labels or custom attribute icon sprites
        const icon = option.getAttribute('data-icon');
        const iconMarkup = icon ? `<svg class="ss-icon" aria-hidden="true"><use href="${icon}"></use></svg> ` : '';
        const itemLabel = `<span>${option.text || '&nbsp;'}</span>`;

        item.innerHTML = `${iconMarkup}${itemLabel}`;
        this.dropdown.appendChild(item);

        // Keep track of the longest label to set sizing bounds
        const textLength = option.text ? option.text.length : 0;
        if (textLength > maxLength) {
          maxLength = textLength;
          longestNode = item.cloneNode(true);
        }

        if (isSelected) {
          this.button.innerHTML = item.innerHTML;
          this.currentFocusOption = item;
          this.dropdown.setAttribute('aria-activedescendant', item.id);
          this.committedSelectionIndex = idx;
        }
      });

      if (longestNode) {
        longestNode.classList.remove('ss-option');
        longestNode.className = 'ss-resize-template';
        this.resizeElement.appendChild(longestNode);
      }
    }

    bindEvents() {
      // Primary trigger click handlers
      this.button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.select.disabled) return;
        this.toggle();
      });

      // Event delegation for option elements inside the dropdown
      this.dropdown.addEventListener('click', (e) => {
        const optionNode = e.target.closest('.ss-option');
        if (!optionNode || optionNode.getAttribute('aria-disabled') === 'true') {
          e.stopPropagation();
          return;
        }
        this.selectOption(optionNode);
        this.close(true);
      });

      // Mouse movements to naturally track focus state without turning on keyboard focus rings
      this.dropdown.addEventListener('mousemove', (e) => {
        const optionNode = e.target.closest('.ss-option');
        if (optionNode && optionNode.getAttribute('aria-disabled') !== 'true') {
          this.container.classList.remove('ss-keyboard-nav');
          this.focusOption(optionNode, false);
        }
      });

      // Remove keyboard navigation mode when clicking inside the container
      this.container.addEventListener('mousedown', () => {
        this.container.classList.remove('ss-keyboard-nav');
      });

      // Native elements changes syncer
      this.select.addEventListener('change', () => {
        this.updateFromNative();
      });

      // Key handlers bound to Accessibility systems
      this.button.addEventListener('keydown', this.handleButtonKeys.bind(this));
      this.dropdown.addEventListener('keydown', this.handleDropdownKeys.bind(this));
    }

    handleButtonKeys(e) {
      if (this.select.disabled) return;

      // Delegate directly to the open handler if the dropdown is currently open
      if (this.isOpen) {
        this.handleDropdownKeys(e);
        return;
      }

      this.container.classList.add('ss-keyboard-nav');
      let prevent = true;
      const options = Array.from(this.dropdown.querySelectorAll('.ss-option:not(.ss-disabled)'));
      const activeIndex = options.indexOf(this.currentFocusOption);

      // Handle native closed cycling vs Alt keys
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.altKey) {
        this.open();
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          // Closed cycling: Select next enabled option instantly matching native behaviour
          if (activeIndex < options.length - 1) {
            this.selectOption(options[activeIndex + 1]);
          }
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          // Closed cycling: Select previous enabled option instantly matching native behaviour
          if (activeIndex > 0) {
            this.selectOption(options[activeIndex - 1]);
          }
          break;
        case 'Enter':
        case ' ':
          this.open();
          break;
        case 'Home':
          if (options.length > 0) {
            this.selectOption(options[0]);
          }
          break;
        case 'End':
          if (options.length > 0) {
            this.selectOption(options[options.length - 1]);
          }
          break;
        case 'Tab':
          prevent = false;
          break;
        default:
          if (this.isPrintableCharacter(e)) {
            this.handleIncrementalSearch(e.key, false); // Direct select on typeahead when closed
          } else {
            prevent = false;
          }
      }

      if (prevent) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    handleDropdownKeys(e) {
      this.container.classList.add('ss-keyboard-nav');
      let prevent = true;
      const options = Array.from(this.dropdown.querySelectorAll('.ss-option:not(.ss-disabled)'));
      const currentIndex = options.indexOf(this.currentFocusOption);

      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.altKey) {
        if (this.currentFocusOption) {
          this.selectOption(this.currentFocusOption);
        }
        this.close(true);
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
          if (currentIndex > 0) {
            this.focusOption(options[currentIndex - 1], true);
          }
          break;
        case 'ArrowDown':
        case 'ArrowRight':
          if (currentIndex < options.length - 1) {
            this.focusOption(options[currentIndex + 1], true);
          }
          break;
        case 'PageUp':
          const stepUpIndex = Math.max(0, currentIndex - 5);
          if (options.length > 0) {
            this.focusOption(options[stepUpIndex], true);
          }
          break;
        case 'PageDown':
          const stepDownIndex = Math.min(options.length - 1, currentIndex + 5);
          if (options.length > 0) {
            this.focusOption(options[stepDownIndex], true);
          }
          break;
        case 'Home':
          if (options.length > 0) {
            this.focusOption(options[0], true);
          }
          break;
        case 'End':
          if (options.length > 0) {
            this.focusOption(options[options.length - 1], true);
          }
          break;
        case 'Enter':
        case ' ':
          if (this.currentFocusOption) {
            this.selectOption(this.currentFocusOption);
          }
          this.close(true);
          break;
        case 'Escape':
          this.revertSelection();
          this.close(true);
          break;
        case 'Tab':
          if (this.currentFocusOption) {
            this.selectOption(this.currentFocusOption);
          }
          this.close(false);
          prevent = false; // standard focus transitions
          break;
        default:
          if (this.isPrintableCharacter(e)) {
            this.handleIncrementalSearch(e.key, true); // Visual highlight on typeahead when open
          } else {
            prevent = false;
          }
      }

      if (prevent) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    isPrintableCharacter(e) {
      return e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey;
    }

    handleIncrementalSearch(char, focusOnly = true) {
      if (!this.config.searchable) return;

      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchString = '';
      }, 1000);

      searchString += char.toLowerCase();
      const options = Array.from(this.dropdown.querySelectorAll('.ss-option:not(.ss-disabled)'));

      // Look up elements starting with current search tracking string
      let matched = options.find(opt => opt.textContent.trim().toLowerCase().startsWith(searchString));

      // Cycling strategy optimization for single repeating character queries
      if (!matched && searchString.length > 1 && /^([a-zA-Z0-9])\1+$/.test(searchString)) {
        const baseChar = searchString[0];
        const repeatedMatches = options.filter(opt => opt.textContent.trim().toLowerCase().startsWith(baseChar));
        if (repeatedMatches.length > 0) {
          const cyclerIndex = (searchString.length - 1) % repeatedMatches.length;
          matched = repeatedMatches[cyclerIndex];
        }
      }

      if (matched) {
        if (focusOnly) {
          this.focusOption(matched, true);
        } else {
          this.selectOption(matched);
          this.focusOption(matched, false);
        }
      }
    }

    focusOption(optionNode, shouldScrollIntoView = false) {
      if (!optionNode) return;

      if (this.currentFocusOption) {
        this.currentFocusOption.classList.remove('ss-focused');
      }

      this.currentFocusOption = optionNode;
      this.currentFocusOption.classList.add('ss-focused');
      this.dropdown.setAttribute('aria-activedescendant', optionNode.id);

      if (shouldScrollIntoView) {
        this.scrollOptionIntoView(optionNode);
      }
    }

    scrollOptionIntoView(optionNode) {
      const dropdownHeight = this.dropdown.clientHeight;
      const optionTop = optionNode.offsetTop;
      const optionHeight = optionNode.offsetHeight;
      const scrollPosition = this.dropdown.scrollTop;

      if (optionTop < scrollPosition) {
        this.dropdown.scrollTop = optionTop;
      } else if (optionTop + optionHeight > scrollPosition + dropdownHeight) {
        this.dropdown.scrollTop = optionTop + optionHeight - dropdownHeight;
      }
    }

    selectOption(optionNode) {
      const allOptions = Array.from(this.dropdown.querySelectorAll('.ss-option'));
      const activeIndex = allOptions.indexOf(optionNode);

      allOptions.forEach(opt => opt.setAttribute('aria-selected', 'false'));
      optionNode.setAttribute('aria-selected', 'true');
      this.button.innerHTML = optionNode.innerHTML;

      // Mutate native elements safely
      this.select.selectedIndex = activeIndex;
      this.committedSelectionIndex = activeIndex;

      // Raise appropriate standard input and change hooks
      this.select.dispatchEvent(new Event('input', { bubbles: true }));
      this.select.dispatchEvent(new Event('change', { bubbles: true }));

      // Launch custom StylishSelect event tracker
      this.dispatchEvent('ss:change', {
        value: optionNode.getAttribute('data-ss-value'),
        text: optionNode.textContent.trim(),
        index: activeIndex
      });
    }

    revertSelection() {
      const allOptions = Array.from(this.dropdown.querySelectorAll('.ss-option'));
      const previouslyCommittedOption = allOptions[this.committedSelectionIndex];
      if (previouslyCommittedOption) {
        this.focusOption(previouslyCommittedOption, false);
      }
    }

    toggle() {
      if (this.isOpen) {
        this.close(true);
      } else {
        this.open();
      }
    }

    open() {
      if (this.isOpen || this.select.disabled) return;

      // Close all other active elements
      document.querySelectorAll('.ss-button[aria-expanded="true"]').forEach(activeButton => {
        const container = activeButton.parentNode;
        const inst = container ? container._ssInstance : null;
        if (inst && inst !== this) {
          inst.close(false);
        }
      });

      this.isOpen = true;
      this.committedSelectionIndex = this.select.selectedIndex;
      this.button.setAttribute('aria-expanded', 'true');
      this.dropdown.style.display = 'block';

      // Perform position observers binding exclusively on open
      window.addEventListener('resize', this.boundReposition);
      window.addEventListener('scroll', this.boundReposition, { capture: true, passive: true });

      this.repositionDropdown();

      // Trigger pre-flight structural class attributes before standard painting frames
      this.dropdown.classList.remove('ss-animate-out');
      this.dropdown.classList.add('ss-animate-in');
      this.applyAnimationConfig(true);

      this.dispatchEvent('ss:open');

      // Align focus state automatically
      const activeOption = this.dropdownActiveOption;
      if (activeOption) {
        this.focusOption(activeOption, true);
      }
    }

    close(refocusButton = false) {
      if (!this.isOpen) return;

      this.isOpen = false;
      this.button.setAttribute('aria-expanded', 'false');

      this.dropdown.classList.remove('ss-animate-in');
      this.dropdown.classList.add('ss-animate-out');
      this.applyAnimationConfig(false);

      // Instantly unbind dynamic positional window observers
      window.removeEventListener('resize', this.boundReposition);
      window.removeEventListener('scroll', this.boundReposition, { capture: true });
      if (this.repositionFrame) cancelAnimationFrame(this.repositionFrame);

      if (refocusButton) {
        this.button.focus();
      }

      // Read transition metadata
      const duration = (this.config.animation && this.config.animation.duration) || 200;

      if (this.closeTimeout) clearTimeout(this.closeTimeout);
      this.closeTimeout = setTimeout(() => {
        if (!this.isOpen) {
          this.dropdown.style.display = 'none';
          this.dropdown.classList.remove('ss-animate-out');
          this.container.classList.remove('ss-keyboard-nav'); // Clear active key-nav tracking
          this.dispatchEvent('ss:close');
        }
      }, duration);
    }

    get dropdownActiveOption() {
      return this.dropdown.querySelector('[aria-selected="true"]') || this.dropdown.querySelector('.ss-option');
    }

    applyAnimationConfig(isOpenAnimation) {
      const anim = this.config.animation;
      if (!anim || anim.open === 'none' || anim.close === 'none') {
        this.dropdown.style.transition = 'none';
        return;
      }

      // Check system reduced motion configurations
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const duration = prefersReduced ? 0 : (anim.duration || 200);
      const easing = anim.easing || 'ease';
      const animType = isOpenAnimation ? (anim.open || 'zoom') : (anim.close || 'fade');

      this.container.setAttribute('data-ss-anim', animType);
      this.dropdown.style.setProperty('--ss-anim-duration', `${duration}ms`);
      this.dropdown.style.setProperty('--ss-anim-easing', easing);
    }

    repositionDropdown() {
      if (!this.isOpen) return;

      if (this.repositionFrame) cancelAnimationFrame(this.repositionFrame);

      // Throttled viewport layout alignment computation
      this.repositionFrame = requestAnimationFrame(() => {
        if (!this.isOpen) return;
        const rect = this.button.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const dropdownHeight = this.dropdown.offsetHeight;

        // Determine top-bottom context flip threshold
        const hasSpaceBelow = rect.bottom + dropdownHeight <= windowHeight;
        const hasSpaceAbove = rect.top - dropdownHeight >= 0;

        if (!hasSpaceBelow && hasSpaceAbove) {
          this.container.classList.add('ss-top');
        } else {
          this.container.classList.remove('ss-top');
        }
      });
    }

    applyTheme(theme) {
      this.config.theme = theme;
      this.container.setAttribute('data-ss-theme', theme);

      if (this.config.storage) {
        StorageManager.set(`theme-${this.index}`, theme);
      }
      this.applyCustomStyles(); // Ensure custom style overrides persist over theme defaults
    }

    handleSystemThemeChange(resolvedTheme) {
      // Dynamic internal system resolution mapping to global rules
      this.container.setAttribute('data-ss-resolved-theme', resolvedTheme);
    }

    applyStyle(style) {
      this.config.style = style;
      this.container.setAttribute('data-ss-style', style);

      if (this.config.storage) {
        StorageManager.set(`style-${this.index}`, style);
      }
      this.applyCustomStyles(); // Ensure custom style overrides persist over style defaults
    }

    updateFromNative() {
      this.button.setAttribute('aria-disabled', this.select.disabled ? 'true' : 'false');
      if (this.select.disabled) {
        this.button.setAttribute('tabindex', '-1');
      } else {
        this.button.removeAttribute('tabindex');
      }
      this.rebuildOptions();
      this.applyCustomStyles();
    }

    dispatchEvent(name, detail = {}) {
      const customEvent = new CustomEvent(name, {
        bubbles: true,
        cancelable: true,
        detail: Object.assign({ instance: this }, detail)
      });
      this.select.dispatchEvent(customEvent);
    }

    destroy() {
      // Unsubscribe all global listeners securely
      SystemThemeObserver.unsubscribe(this.boundSystemThemeChange);
      window.removeEventListener('resize', this.boundReposition);
      window.removeEventListener('scroll', this.boundReposition, { capture: true });
      if (this.closeTimeout) clearTimeout(this.closeTimeout);
      if (this.repositionFrame) cancelAnimationFrame(this.repositionFrame);

      // Restore standard configuration output
      this.select.classList.remove('ss-original');
      this.select.style.display = '';

      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      instances.delete(this.select);
    }
  }

  StylishSelectInstance.counter = 0;

  // Handle outside dynamic close events
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ss-container')) {
      document.querySelectorAll('.ss-button[aria-expanded="true"]').forEach(activeButton => {
        const container = activeButton.parentNode;
        const inst = container ? container._ssInstance : null;
        if (inst) {
          inst.close(false);
        }
      });
    }
  });

  // Exported Main Global Library Namespace
  const StylishSelect = {
    /**
     * Initializes elements in document matching attribute pattern selector
     * @param {string} [selector] 
     * @param {object} [options]
     */
    init(selector = 'select[stylish-select]', options = {}) {
      document.querySelectorAll(selector).forEach(select => {
        if (!instances.has(select)) {
          const inst = new StylishSelectInstance(select, options);
          instances.set(select, inst);
        }
      });
    },

    /**
     * Imperative factory design construct
     */
    create(element, options = {}) {
      const select = typeof element === 'string' ? document.querySelector(element) : element;
      if (!select || select.nodeName !== 'SELECT') {
        throw new TypeError('StylishSelect: Invalid initialization target root.');
      }
      if (instances.has(select)) {
        return instances.get(select);
      }
      const inst = new StylishSelectInstance(select, options);
      instances.set(select, inst);
      return inst;
    },

    destroy(element) {
      const select = typeof element === 'string' ? document.querySelector(element) : element;
      const inst = instances.get(select);
      if (inst) inst.destroy();
    },

    refresh(element) {
      const select = typeof element === 'string' ? document.querySelector(element) : element;
      const inst = instances.get(select);
      if (inst) inst.updateFromNative();
    },

    update(element) {
      this.refresh(element);
    },

    enable(element) {
      const select = typeof element === 'string' ? document.querySelector(element) : element;
      if (select) {
        select.disabled = false;
        this.refresh(select);
      }
    },

    disable(element) {
      const select = typeof element === 'string' ? document.querySelector(element) : element;
      if (select) {
        select.disabled = true;
        this.refresh(select);
      }
    },

    open(element) {
      const select = typeof element === 'string' ? document.querySelector(element) : element;
      const inst = instances.get(select);
      if (inst) inst.open();
    },

    close(element) {
      const select = typeof element === 'string' ? document.querySelector(element) : element;
      const inst = instances.get(select);
      if (inst) inst.close(true);
    },

    toggle(element) {
      const select = typeof element === 'string' ? document.querySelector(element) : element;
      const inst = instances.get(select);
      if (inst) inst.toggle();
    },

    select(element, value) {
      const select = typeof element === 'string' ? document.querySelector(element) : element;
      const inst = instances.get(select);
      if (inst) {
        const option = Array.from(inst.dropdown.querySelectorAll('.ss-option'))
          .find(opt => opt.getAttribute('data-ss-value') === value);
        if (option) {
          inst.selectOption(option);
        }
      }
    },

    clear(element) {
      const select = typeof element === 'string' ? document.querySelector(element) : element;
      const inst = instances.get(select);
      if (inst && inst.dropdown.firstElementChild) {
        inst.selectOption(inst.dropdown.firstElementChild);
      }
    },

    search(element, query) {
      const select = typeof element === 'string' ? document.querySelector(element) : element;
      const inst = instances.get(select);
      if (inst) {
        const normalized = query.toLowerCase();
        const option = Array.from(inst.dropdown.querySelectorAll('.ss-option:not(.ss-disabled)'))
          .find(opt => opt.textContent.trim().toLowerCase().includes(normalized));
        if (option) {
          inst.focusOption(option, true);
        }
      }
    },

    filter(element, query) {
      const select = typeof element === 'string' ? document.querySelector(element) : element;
      const inst = instances.get(select);
      if (inst) {
        const normalized = query.toLowerCase();
        inst.dropdown.querySelectorAll('.ss-option').forEach(opt => {
          const isMatch = opt.textContent.trim().toLowerCase().includes(normalized);
          opt.style.display = isMatch ? 'flex' : 'none';
        });
      }
    },

    setTheme(element, themeName) {
      // Global runtime theme adjustment across target select or complete scope of selectors
      if (typeof element === 'string' && !document.querySelector(element)) {
        themeName = element;
        element = null;
      }
      if (element) {
        const select = typeof element === 'string' ? document.querySelector(element) : element;
        const inst = instances.get(select);
        if (inst) inst.applyTheme(themeName);
      } else {
        document.querySelectorAll('select[stylish-select]').forEach(sel => {
          const inst = instances.get(sel);
          if (inst) inst.applyTheme(themeName);
        });
      }
    },

    getTheme(element) {
      const select = typeof element === 'string' ? document.querySelector(element) : element;
      const inst = instances.get(select);
      return inst ? inst.config.theme : null;
    },

    setStyle(element, styleName) {
      if (typeof element === 'string' && !document.querySelector(element)) {
        styleName = element;
        element = null;
      }
      if (element) {
        const select = typeof element === 'string' ? document.querySelector(element) : element;
        const inst = instances.get(select);
        if (inst) inst.applyStyle(styleName);
      } else {
        document.querySelectorAll('select[stylish-select]').forEach(sel => {
          const inst = instances.get(sel);
          if (inst) inst.applyStyle(styleName);
        });
      }
    },

    getStyle(element) {
      const select = typeof element === 'string' ? document.querySelector(element) : element;
      const inst = instances.get(select);
      return inst ? inst.config.style : null;
    },

    setAnimation(element, animationConfig) {
      const select = typeof element === 'string' ? document.querySelector(element) : element;
      const inst = instances.get(select);
      if (inst) {
        inst.config.animation = typeof animationConfig === 'string' ? {
          open: animationConfig,
          close: animationConfig,
          duration: 200,
          easing: 'ease'
        } : animationConfig;
      }
    },

    registerTheme(name, cssRules) {
      const sanitizedName = name.toLowerCase().trim();
      VALID_THEMES.add(sanitizedName);
      registeredThemes.set(sanitizedName, cssRules);
      StyleInjector.inject(`theme-${sanitizedName}`, cssRules);
    },

    registerStyle(name, cssRules) {
      const sanitizedName = name.toLowerCase().trim();
      VALID_STYLES.add(sanitizedName);
      registeredStyles.set(sanitizedName, cssRules);
      StyleInjector.inject(`style-${sanitizedName}`, cssRules);
    },

    registerAnimation(name, transitionCSS) {
      const sanitizedName = name.toLowerCase().trim();
      VALID_ANIMATIONS.add(sanitizedName);
      registeredAnimations.set(sanitizedName, transitionCSS);
      StyleInjector.inject(`anim-${sanitizedName}`, transitionCSS);
    }
  };

  // Perform dynamic auto-instantiation over active DOM structures matching selector properties
  if (typeof document !== 'undefined') {
    if (document.readyState !== 'loading') {
      StylishSelect.init();
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        StylishSelect.init();
      });
    }

    // High performance MutationObserver instance mapping dynamically appended selects
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            if (node.matches && node.matches('select[stylish-select]')) {
              StylishSelect.create(node);
            }
            if (node.querySelectorAll) {
              node.querySelectorAll('select[stylish-select]').forEach(select => {
                StylishSelect.create(select);
              });
            }
          }
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  return StylishSelect;
});