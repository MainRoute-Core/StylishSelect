function _defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}function _createClass(Constructor, protoProps, staticProps) {if (protoProps) _defineProperties(Constructor.prototype, protoProps);if (staticProps) _defineProperties(Constructor, staticProps);return Constructor;} /*!
 * StylishSelect
 * An accessible, multi-thematic, dynamic drop-in replacement for native select elements.
 * Built with absolute structural isolation, a high-performance rendering pipeline,
 * custom animation drivers, and robust WAI-ARIA compliance.
 * 
 * Licensed under the GNU GENERAL PUBLIC LICENSE.
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) : (
  global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.StylishSelect = factory());
})(void 0, function () {
  'use strict';

  // Private Registry maps native select elements to their StylishSelect instances
  var instances = new WeakMap();

  // Registry validation stores
  var VALID_THEMES = new Set([
  'light', 'dark', 'amoled', 'github', 'dracula', 'nord', 'solarized',
  'catppuccin', 'tokyo-night', 'gruvbox', 'material', 'one-dark', 'high-contrast', 'auto']);


  var VALID_STYLES = new Set([
  'classic', 'modern', 'rounded', 'terminal', 'retro', 'neon', 'chrome',
  'firefox', 'windows11', 'android', 'ios', 'md3', 'macos', 'fluent', 'glass', 'minimal', 'compact']);


  var VALID_ANIMATIONS = new Set([
  'fade', 'scale', 'zoom', 'slide', 'bounce', 'flip', 'grow', 'shrink', 'rotate',
  'swing', 'elastic', 'blur', 'float', 'pop', 'drop', 'fold', 'expand', 'collapse', 'none']);


  // Global settings for newly registered variants
  var registeredThemes = new Map();
  var registeredStyles = new Map();
  var registeredAnimations = new Map();

  // Unified global Storage Helper
  var StorageManager = {
    prefix: 'ss-',
    set: function set(key, value) {
      try {
        localStorage.setItem(this.prefix + key, value);
      } catch (e) {
        // Fallback for isolated contexts / private browsing limits
      }
    },
    get: function get(key) {
      try {
        return localStorage.getItem(this.prefix + key);
      } catch (e) {
        return null;
      }
    },
    remove: function remove(key) {
      try {
        localStorage.removeItem(this.prefix + key);
      } catch (e) {
        // Safe bypass
      }
    } };


  // Safe global DOM stylesheet injector for programmatically registered properties
  var StyleInjector = {
    sheet: null,
    inject: function inject(id, cssText) {
      if (!this.sheet) {
        var style = document.createElement('style');
        style.id = 'ss-dynamic-styles';
        document.head.appendChild(style);
        this.sheet = style.sheet;
      }
      // Remove previous rules under same ID if existing
      this.remove(id);

      // Translate the targeting selector dynamically to match instance attributes
      var selector = "[data-ss-inject=\"" + id + "\"]";
      if (id.startsWith('theme-')) {
        var themeName = id.replace('theme-', '');
        selector = "[data-ss-theme=\"" + themeName + "\"]";
      } else if (id.startsWith('style-')) {
        var styleName = id.replace('style-', '');
        selector = "[data-ss-style=\"" + styleName + "\"]";
      } else if (id.startsWith('anim-')) {
        var animName = id.replace('anim-', '');
        selector = "[data-ss-anim=\"" + animName + "\"] .ss-dropdown";
      }

      var index = this.sheet.insertRule(selector + " { " + cssText + " }", this.sheet.cssRules.length);
      this.sheet.cssRules[index]._ssId = id;
    },
    remove: function remove(id) {
      if (!this.sheet) return;
      for (var i = this.sheet.cssRules.length - 1; i >= 0; i--) {
        if (this.sheet.cssRules[i]._ssId === id) {
          this.sheet.deleteRule(i);
        }
      }
    } };


  // Adaptive System preference tracker (prefers-color-scheme)
  var SystemThemeObserver = {
    listeners: new Set(),
    mediaQuery: window.matchMedia('(prefers-color-scheme: dark)'),
    init: function init() {var _this = this;
      this.mediaQuery.addEventListener('change', function (e) {
        var activeTheme = e.matches ? 'dark' : 'light';
        _this.listeners.forEach(function (callback) {return callback(activeTheme);});
      });
    },
    subscribe: function subscribe(callback) {
      this.listeners.add(callback);
      // Immediate execution with current state
      callback(this.mediaQuery.matches ? 'dark' : 'light');
    },
    unsubscribe: function unsubscribe(callback) {
      this.listeners.delete(callback);
    } };

  SystemThemeObserver.init();

  // Main utility parsing string configuration lists (e.g. class list, attribute lists)
  function parseConfigTokens(attrValue) {
    if (!attrValue) return {};
    var tokens = attrValue.split(/\s+/).map(function (t) {return t.toLowerCase().trim();}).filter(Boolean);
    var parsed = {};

    tokens.forEach(function (token) {
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
  var searchString = '';
  var searchTimeout = null;var

  StylishSelectInstance = /*#__PURE__*/function () {
    function StylishSelectInstance(select, config) {if (config === void 0) {config = {};}
      this.select = select;
      this.index = StylishSelectInstance.counter++;

      // Merge configuration options in strict precedence order:
      var attrConfig = parseConfigTokens(select.getAttribute('stylish-select'));

      var rawAnim = select.getAttribute('data-ss-animation');
      var parsedAnim;
      if (rawAnim) {
        try {
          parsedAnim = JSON.parse(rawAnim);
        } catch (e) {
          parsedAnim = rawAnim; // Support string directly if JSON parsing fails
        }
      }

      var dataConfig = {
        theme: select.getAttribute('data-ss-theme') || undefined,
        style: select.getAttribute('data-ss-style') || undefined,
        animation: parsedAnim };

      // Clean undefined keys to keep fallback merges logical
      Object.keys(dataConfig).forEach(function (k) {return dataConfig[k] === undefined && delete dataConfig[k];});

      this.config = Object.assign({
        theme: 'auto',
        style: 'classic',
        animation: {
          open: 'zoom',
          close: 'fade',
          duration: 200,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },

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
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)' };

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
        var storedTheme = StorageManager.get("theme-" + this.index);
        var storedStyle = StorageManager.get("style-" + this.index);
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
    }var _proto = StylishSelectInstance.prototype;_proto.

    buildDOM = function buildDOM() {
      var parent = this.select.parentNode;

      this.container = document.createElement('span');
      this.container.className = 'ss-container';
      this.container.setAttribute('data-ss-id', this.index);
      this.container._ssInstance = this; // Avoid brittle DOM-traversal parents

      // Create screen-reader specific accessibility element
      this.label = document.createElement('span');
      this.label.id = "ss-label-" + this.index;
      this.label.className = 'ss-label';
      this.label.style.display = 'none';
      this.label.textContent = this.retrieveNativeLabel();

      // Formulate active state control button
      this.button = document.createElement('button');
      this.button.id = "ss-button-" + this.index;
      this.button.className = 'ss-button';
      this.button.setAttribute('type', 'button');
      this.button.setAttribute('aria-haspopup', 'listbox');
      this.button.setAttribute('aria-expanded', 'false');
      this.button.setAttribute('aria-disabled', this.select.disabled ? 'true' : 'false');
      this.button.setAttribute('aria-labelledby', this.label.id + " " + this.button.id);
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
    };_proto.

    retrieveNativeLabel = function retrieveNativeLabel() {var _this2 = this;
      var parent = this.select.parentNode;
      var labelEl = null;

      if (parent && parent.nodeName === 'LABEL') {
        labelEl = parent;
      } else if (this.select.id) {
        labelEl = document.querySelector("label[for=\"" + this.select.id + "\"]");
      }

      if (labelEl) {
        var textNodes = Array.from(labelEl.childNodes).filter(function (n) {return n.nodeType === 3;});
        var text = textNodes.map(function (n) {return n.textContent.trim();}).join(' ').trim();
        if (text) {
          labelEl.addEventListener('click', function (e) {
            if (e.target !== _this2.select && !_this2.container.contains(e.target)) {
              e.preventDefault();
              _this2.button.focus();
              _this2.toggle();
            }
          });
          return text;
        }
      }
      return 'Select Option';
    };_proto.

    applyCustomStyles = function applyCustomStyles() {var _this3 = this;
      var styles = this.config.customStyles;
      if (!styles || typeof styles !== 'object') return;

      var mappings = {
        bg: '--ss-bg',
        color: '--ss-color',
        accent: '--ss-accent',
        accentColor: '--ss-accent-color',
        hoverBg: '--ss-hover-bg',
        hoverColor: '--ss-hover-color',
        padding: '--ss-padding',
        margin: '--ss-margin',
        radius: '--ss-radius' };


      Object.keys(mappings).forEach(function (key) {
        if (styles[key] !== undefined && styles[key] !== null) {
          _this3.container.style.setProperty(mappings[key], styles[key]);

          // Cascading fallback variables
          if (key === 'bg') _this3.container.style.setProperty('--ss-list-bg', styles.bg);
          if (key === 'color') _this3.container.style.setProperty('--ss-list-color', styles.color);
          if (key === 'accent') _this3.container.style.setProperty('--ss-selected-bg', styles.accent);
          if (key === 'accentColor') _this3.container.style.setProperty('--ss-selected-color', styles.accentColor);
          if (key === 'radius') _this3.container.style.setProperty('--ss-list-radius', styles.radius);
        }
      });
    };_proto.

    rebuildOptions = function rebuildOptions() {var _this4 = this;
      this.dropdown.innerHTML = '';
      this.resizeElement.innerHTML = '';

      var options = Array.from(this.select.options);
      var longestNode = null;
      var maxLength = 0;

      options.forEach(function (option, idx) {
        var item = document.createElement('span');
        item.className = 'ss-option';
        item.setAttribute('role', 'option');
        item.setAttribute('id', "ss-opt-" + _this4.index + "-" + idx);
        item.setAttribute('data-ss-value', option.value);
        item.setAttribute('tabindex', '-1');

        var isSelected = option.selected;
        item.setAttribute('aria-selected', isSelected ? 'true' : 'false');

        if (option.disabled) {
          item.setAttribute('aria-disabled', 'true');
          item.classList.add('ss-disabled');
        }

        // Incorporate native labels or custom attribute icon sprites
        var icon = option.getAttribute('data-icon');
        var iconMarkup = icon ? "<svg class=\"ss-icon\" aria-hidden=\"true\"><use href=\"" + icon + "\"></use></svg> " : '';
        var itemLabel = "<span>" + (option.text || '&nbsp;') + "</span>";

        item.innerHTML = "" + iconMarkup + itemLabel;
        _this4.dropdown.appendChild(item);

        // Keep track of the longest label to set sizing bounds
        var textLength = option.text ? option.text.length : 0;
        if (textLength > maxLength) {
          maxLength = textLength;
          longestNode = item.cloneNode(true);
        }

        if (isSelected) {
          _this4.button.innerHTML = item.innerHTML;
          _this4.currentFocusOption = item;
          _this4.dropdown.setAttribute('aria-activedescendant', item.id);
          _this4.committedSelectionIndex = idx;
        }
      });

      if (longestNode) {
        longestNode.classList.remove('ss-option');
        longestNode.className = 'ss-resize-template';
        this.resizeElement.appendChild(longestNode);
      }
    };_proto.

    bindEvents = function bindEvents() {var _this5 = this;
      // Primary trigger click handlers
      this.button.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (_this5.select.disabled) return;
        _this5.toggle();
      });

      // Event delegation for option elements inside the dropdown
      this.dropdown.addEventListener('click', function (e) {
        var optionNode = e.target.closest('.ss-option');
        if (!optionNode || optionNode.getAttribute('aria-disabled') === 'true') {
          e.stopPropagation();
          return;
        }
        _this5.selectOption(optionNode);
        _this5.close(true);
      });

      // Mouse movements to naturally track focus state without turning on keyboard focus rings
      this.dropdown.addEventListener('mousemove', function (e) {
        var optionNode = e.target.closest('.ss-option');
        if (optionNode && optionNode.getAttribute('aria-disabled') !== 'true') {
          _this5.container.classList.remove('ss-keyboard-nav');
          _this5.focusOption(optionNode, false);
        }
      });

      // Remove keyboard navigation mode when clicking inside the container
      this.container.addEventListener('mousedown', function () {
        _this5.container.classList.remove('ss-keyboard-nav');
      });

      // Native elements changes syncer
      this.select.addEventListener('change', function () {
        _this5.updateFromNative();
      });

      // Key handlers bound to Accessibility systems
      this.button.addEventListener('keydown', this.handleButtonKeys.bind(this));
      this.dropdown.addEventListener('keydown', this.handleDropdownKeys.bind(this));
    };_proto.

    handleButtonKeys = function handleButtonKeys(e) {
      if (this.select.disabled) return;

      // Delegate directly to the open handler if the dropdown is currently open
      if (this.isOpen) {
        this.handleDropdownKeys(e);
        return;
      }

      this.container.classList.add('ss-keyboard-nav');
      var prevent = true;
      var options = Array.from(this.dropdown.querySelectorAll('.ss-option:not(.ss-disabled)'));
      var activeIndex = options.indexOf(this.currentFocusOption);

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
          }}


      if (prevent) {
        e.preventDefault();
        e.stopPropagation();
      }
    };_proto.

    handleDropdownKeys = function handleDropdownKeys(e) {
      this.container.classList.add('ss-keyboard-nav');
      var prevent = true;
      var options = Array.from(this.dropdown.querySelectorAll('.ss-option:not(.ss-disabled)'));
      var currentIndex = options.indexOf(this.currentFocusOption);

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
          var stepUpIndex = Math.max(0, currentIndex - 5);
          if (options.length > 0) {
            this.focusOption(options[stepUpIndex], true);
          }
          break;
        case 'PageDown':
          var stepDownIndex = Math.min(options.length - 1, currentIndex + 5);
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
          }}


      if (prevent) {
        e.preventDefault();
        e.stopPropagation();
      }
    };_proto.

    isPrintableCharacter = function isPrintableCharacter(e) {
      return e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey;
    };_proto.

    handleIncrementalSearch = function handleIncrementalSearch(char, focusOnly) {if (focusOnly === void 0) {focusOnly = true;}
      if (!this.config.searchable) return;

      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(function () {
        searchString = '';
      }, 1000);

      searchString += char.toLowerCase();
      var options = Array.from(this.dropdown.querySelectorAll('.ss-option:not(.ss-disabled)'));

      // Look up elements starting with current search tracking string
      var matched = options.find(function (opt) {return opt.textContent.trim().toLowerCase().startsWith(searchString);});

      // Cycling strategy optimization for single repeating character queries
      if (!matched && searchString.length > 1 && /^([a-zA-Z0-9])\1+$/.test(searchString)) {
        var baseChar = searchString[0];
        var repeatedMatches = options.filter(function (opt) {return opt.textContent.trim().toLowerCase().startsWith(baseChar);});
        if (repeatedMatches.length > 0) {
          var cyclerIndex = (searchString.length - 1) % repeatedMatches.length;
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
    };_proto.

    focusOption = function focusOption(optionNode, shouldScrollIntoView) {if (shouldScrollIntoView === void 0) {shouldScrollIntoView = false;}
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
    };_proto.

    scrollOptionIntoView = function scrollOptionIntoView(optionNode) {
      var dropdownHeight = this.dropdown.clientHeight;
      var optionTop = optionNode.offsetTop;
      var optionHeight = optionNode.offsetHeight;
      var scrollPosition = this.dropdown.scrollTop;

      if (optionTop < scrollPosition) {
        this.dropdown.scrollTop = optionTop;
      } else if (optionTop + optionHeight > scrollPosition + dropdownHeight) {
        this.dropdown.scrollTop = optionTop + optionHeight - dropdownHeight;
      }
    };_proto.

    selectOption = function selectOption(optionNode) {
      var allOptions = Array.from(this.dropdown.querySelectorAll('.ss-option'));
      var activeIndex = allOptions.indexOf(optionNode);

      allOptions.forEach(function (opt) {return opt.setAttribute('aria-selected', 'false');});
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
        index: activeIndex });

    };_proto.

    revertSelection = function revertSelection() {
      var allOptions = Array.from(this.dropdown.querySelectorAll('.ss-option'));
      var previouslyCommittedOption = allOptions[this.committedSelectionIndex];
      if (previouslyCommittedOption) {
        this.focusOption(previouslyCommittedOption, false);
      }
    };_proto.

    toggle = function toggle() {
      if (this.isOpen) {
        this.close(true);
      } else {
        this.open();
      }
    };_proto.

    open = function open() {var _this6 = this;
      if (this.isOpen || this.select.disabled) return;

      // Close all other active elements
      document.querySelectorAll('.ss-button[aria-expanded="true"]').forEach(function (activeButton) {
        var container = activeButton.parentNode;
        var inst = container ? container._ssInstance : null;
        if (inst && inst !== _this6) {
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
      var activeOption = this.dropdownActiveOption;
      if (activeOption) {
        this.focusOption(activeOption, true);
      }
    };_proto.

    close = function close(refocusButton) {var _this7 = this;if (refocusButton === void 0) {refocusButton = false;}
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
      var duration = this.config.animation && this.config.animation.duration || 200;

      if (this.closeTimeout) clearTimeout(this.closeTimeout);
      this.closeTimeout = setTimeout(function () {
        if (!_this7.isOpen) {
          _this7.dropdown.style.display = 'none';
          _this7.dropdown.classList.remove('ss-animate-out');
          _this7.container.classList.remove('ss-keyboard-nav'); // Clear active key-nav tracking
          _this7.dispatchEvent('ss:close');
        }
      }, duration);
    };_proto.





    applyAnimationConfig = function applyAnimationConfig(isOpenAnimation) {
      var anim = this.config.animation;
      if (!anim || anim.open === 'none' || anim.close === 'none') {
        this.dropdown.style.transition = 'none';
        return;
      }

      // Check system reduced motion configurations
      var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var duration = prefersReduced ? 0 : anim.duration || 200;
      var easing = anim.easing || 'ease';
      var animType = isOpenAnimation ? anim.open || 'zoom' : anim.close || 'fade';

      this.container.setAttribute('data-ss-anim', animType);
      this.dropdown.style.setProperty('--ss-anim-duration', duration + "ms");
      this.dropdown.style.setProperty('--ss-anim-easing', easing);
    };_proto.

    repositionDropdown = function repositionDropdown() {var _this8 = this;
      if (!this.isOpen) return;

      if (this.repositionFrame) cancelAnimationFrame(this.repositionFrame);

      // Throttled viewport layout alignment computation
      this.repositionFrame = requestAnimationFrame(function () {
        if (!_this8.isOpen) return;
        var rect = _this8.button.getBoundingClientRect();
        var windowHeight = window.innerHeight;
        var dropdownHeight = _this8.dropdown.offsetHeight;

        // Determine top-bottom context flip threshold
        var hasSpaceBelow = rect.bottom + dropdownHeight <= windowHeight;
        var hasSpaceAbove = rect.top - dropdownHeight >= 0;

        if (!hasSpaceBelow && hasSpaceAbove) {
          _this8.container.classList.add('ss-top');
        } else {
          _this8.container.classList.remove('ss-top');
        }
      });
    };_proto.

    applyTheme = function applyTheme(theme) {
      this.config.theme = theme;
      this.container.setAttribute('data-ss-theme', theme);

      if (this.config.storage) {
        StorageManager.set("theme-" + this.index, theme);
      }
      this.applyCustomStyles(); // Ensure custom style overrides persist over theme defaults
    };_proto.

    handleSystemThemeChange = function handleSystemThemeChange(resolvedTheme) {
      // Dynamic internal system resolution mapping to global rules
      this.container.setAttribute('data-ss-resolved-theme', resolvedTheme);
    };_proto.

    applyStyle = function applyStyle(style) {
      this.config.style = style;
      this.container.setAttribute('data-ss-style', style);

      if (this.config.storage) {
        StorageManager.set("style-" + this.index, style);
      }
      this.applyCustomStyles(); // Ensure custom style overrides persist over style defaults
    };_proto.

    updateFromNative = function updateFromNative() {
      this.button.setAttribute('aria-disabled', this.select.disabled ? 'true' : 'false');
      if (this.select.disabled) {
        this.button.setAttribute('tabindex', '-1');
      } else {
        this.button.removeAttribute('tabindex');
      }
      this.rebuildOptions();
      this.applyCustomStyles();
    };_proto.

    dispatchEvent = function dispatchEvent(name, detail) {if (detail === void 0) {detail = {};}
      var customEvent = new CustomEvent(name, {
        bubbles: true,
        cancelable: true,
        detail: Object.assign({ instance: this }, detail) });

      this.select.dispatchEvent(customEvent);
    };_proto.

    destroy = function destroy() {
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
    };_createClass(StylishSelectInstance, [{ key: "dropdownActiveOption", get: function get() {return this.dropdown.querySelector('[aria-selected="true"]') || this.dropdown.querySelector('.ss-option');} }]);return StylishSelectInstance;}();


  StylishSelectInstance.counter = 0;

  // Handle outside dynamic close events
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.ss-container')) {
      document.querySelectorAll('.ss-button[aria-expanded="true"]').forEach(function (activeButton) {
        var container = activeButton.parentNode;
        var inst = container ? container._ssInstance : null;
        if (inst) {
          inst.close(false);
        }
      });
    }
  });

  // Exported Main Global Library Namespace
  var StylishSelect = {
    /**
     * Initializes elements in document matching attribute pattern selector
     * @param {string} [selector] 
     * @param {object} [options]
     */
    init: function init(selector, options) {if (selector === void 0) {selector = 'select[stylish-select]';}if (options === void 0) {options = {};}
      document.querySelectorAll(selector).forEach(function (select) {
        if (!instances.has(select)) {
          var inst = new StylishSelectInstance(select, options);
          instances.set(select, inst);
        }
      });
    },

    /**
     * Imperative factory design construct
     */
    create: function create(element, options) {if (options === void 0) {options = {};}
      var select = typeof element === 'string' ? document.querySelector(element) : element;
      if (!select || select.nodeName !== 'SELECT') {
        throw new TypeError('StylishSelect: Invalid initialization target root.');
      }
      if (instances.has(select)) {
        return instances.get(select);
      }
      var inst = new StylishSelectInstance(select, options);
      instances.set(select, inst);
      return inst;
    },

    destroy: function destroy(element) {
      var select = typeof element === 'string' ? document.querySelector(element) : element;
      var inst = instances.get(select);
      if (inst) inst.destroy();
    },

    refresh: function refresh(element) {
      var select = typeof element === 'string' ? document.querySelector(element) : element;
      var inst = instances.get(select);
      if (inst) inst.updateFromNative();
    },

    update: function update(element) {
      this.refresh(element);
    },

    enable: function enable(element) {
      var select = typeof element === 'string' ? document.querySelector(element) : element;
      if (select) {
        select.disabled = false;
        this.refresh(select);
      }
    },

    disable: function disable(element) {
      var select = typeof element === 'string' ? document.querySelector(element) : element;
      if (select) {
        select.disabled = true;
        this.refresh(select);
      }
    },

    open: function open(element) {
      var select = typeof element === 'string' ? document.querySelector(element) : element;
      var inst = instances.get(select);
      if (inst) inst.open();
    },

    close: function close(element) {
      var select = typeof element === 'string' ? document.querySelector(element) : element;
      var inst = instances.get(select);
      if (inst) inst.close(true);
    },

    toggle: function toggle(element) {
      var select = typeof element === 'string' ? document.querySelector(element) : element;
      var inst = instances.get(select);
      if (inst) inst.toggle();
    },

    select: function select(element, value) {
      var select = typeof element === 'string' ? document.querySelector(element) : element;
      var inst = instances.get(select);
      if (inst) {
        var option = Array.from(inst.dropdown.querySelectorAll('.ss-option')).
        find(function (opt) {return opt.getAttribute('data-ss-value') === value;});
        if (option) {
          inst.selectOption(option);
        }
      }
    },

    clear: function clear(element) {
      var select = typeof element === 'string' ? document.querySelector(element) : element;
      var inst = instances.get(select);
      if (inst && inst.dropdown.firstElementChild) {
        inst.selectOption(inst.dropdown.firstElementChild);
      }
    },

    search: function search(element, query) {
      var select = typeof element === 'string' ? document.querySelector(element) : element;
      var inst = instances.get(select);
      if (inst) {
        var normalized = query.toLowerCase();
        var option = Array.from(inst.dropdown.querySelectorAll('.ss-option:not(.ss-disabled)')).
        find(function (opt) {return opt.textContent.trim().toLowerCase().includes(normalized);});
        if (option) {
          inst.focusOption(option, true);
        }
      }
    },

    filter: function filter(element, query) {
      var select = typeof element === 'string' ? document.querySelector(element) : element;
      var inst = instances.get(select);
      if (inst) {
        var normalized = query.toLowerCase();
        inst.dropdown.querySelectorAll('.ss-option').forEach(function (opt) {
          var isMatch = opt.textContent.trim().toLowerCase().includes(normalized);
          opt.style.display = isMatch ? 'flex' : 'none';
        });
      }
    },

    setTheme: function setTheme(element, themeName) {
      // Global runtime theme adjustment across target select or complete scope of selectors
      if (typeof element === 'string' && !document.querySelector(element)) {
        themeName = element;
        element = null;
      }
      if (element) {
        var select = typeof element === 'string' ? document.querySelector(element) : element;
        var inst = instances.get(select);
        if (inst) inst.applyTheme(themeName);
      } else {
        document.querySelectorAll('select[stylish-select]').forEach(function (sel) {
          var inst = instances.get(sel);
          if (inst) inst.applyTheme(themeName);
        });
      }
    },

    getTheme: function getTheme(element) {
      var select = typeof element === 'string' ? document.querySelector(element) : element;
      var inst = instances.get(select);
      return inst ? inst.config.theme : null;
    },

    setStyle: function setStyle(element, styleName) {
      if (typeof element === 'string' && !document.querySelector(element)) {
        styleName = element;
        element = null;
      }
      if (element) {
        var select = typeof element === 'string' ? document.querySelector(element) : element;
        var inst = instances.get(select);
        if (inst) inst.applyStyle(styleName);
      } else {
        document.querySelectorAll('select[stylish-select]').forEach(function (sel) {
          var inst = instances.get(sel);
          if (inst) inst.applyStyle(styleName);
        });
      }
    },

    getStyle: function getStyle(element) {
      var select = typeof element === 'string' ? document.querySelector(element) : element;
      var inst = instances.get(select);
      return inst ? inst.config.style : null;
    },

    setAnimation: function setAnimation(element, animationConfig) {
      var select = typeof element === 'string' ? document.querySelector(element) : element;
      var inst = instances.get(select);
      if (inst) {
        inst.config.animation = typeof animationConfig === 'string' ? {
          open: animationConfig,
          close: animationConfig,
          duration: 200,
          easing: 'ease' } :
        animationConfig;
      }
    },

    registerTheme: function registerTheme(name, cssRules) {
      var sanitizedName = name.toLowerCase().trim();
      VALID_THEMES.add(sanitizedName);
      registeredThemes.set(sanitizedName, cssRules);
      StyleInjector.inject("theme-" + sanitizedName, cssRules);
    },

    registerStyle: function registerStyle(name, cssRules) {
      var sanitizedName = name.toLowerCase().trim();
      VALID_STYLES.add(sanitizedName);
      registeredStyles.set(sanitizedName, cssRules);
      StyleInjector.inject("style-" + sanitizedName, cssRules);
    },

    registerAnimation: function registerAnimation(name, transitionCSS) {
      var sanitizedName = name.toLowerCase().trim();
      VALID_ANIMATIONS.add(sanitizedName);
      registeredAnimations.set(sanitizedName, transitionCSS);
      StyleInjector.inject("anim-" + sanitizedName, transitionCSS);
    } };


  // Perform dynamic auto-instantiation over active DOM structures matching selector properties
  if (typeof document !== 'undefined') {
    if (document.readyState !== 'loading') {
      StylishSelect.init();
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        StylishSelect.init();
      });
    }

    // High performance MutationObserver instance mapping dynamically appended selects
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            if (node.matches && node.matches('select[stylish-select]')) {
              StylishSelect.create(node);
            }
            if (node.querySelectorAll) {
              node.querySelectorAll('select[stylish-select]').forEach(function (select) {
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