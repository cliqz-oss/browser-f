/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// **********
// Title: iq.js
// Various helper functions, in the vein of jQuery.

// ----------
// Function: iQ
// Returns an iQClass object which represents an individual element or a group
// of elements. It works pretty much like jQuery(), with a few exceptions,
// most notably that you can't use strings with complex html,
// just simple tags like '<div>'.
function iQ(selector, context) {
  // The iQ object is actually just the init constructor 'enhanced'
  return new iQClass(selector, context);
};

// A simple way to check for HTML strings or ID strings
// (both of which we optimize for)
var quickExpr = /^[^<]*(<[\w\W]+>)[^>]*$|^#([\w-]+)$/;

// Match a standalone tag
var rsingleTag = /^<(\w+)\s*\/?>(?:<\/\1>)?$/;

// ##########
// Class: iQClass
// The actual class of iQ result objects, representing an individual element
// or a group of elements.
//
// ----------
// Function: iQClass
// You don't call this directly; this is what's called by iQ().
function iQClass(selector, context) {

  // Handle $(""), $(null), or $(undefined)
  if (!selector) {
    return this;
  }

  // Handle $(DOMElement)
  if (selector.nodeType) {
    this.context = selector;
    this[0] = selector;
    this.length = 1;
    return this;
  }

  // The body element only exists once, optimize finding it
  if (selector === "body" && !context) {
    this.context = document;
    this[0] = document.body;
    this.selector = "body";
    this.length = 1;
    return this;
  }

  // Handle HTML strings
  if (typeof selector === "string") {
    // Are we dealing with HTML string or an ID?

    let match = quickExpr.exec(selector);

    // Verify a match, and that no context was specified for #id
    if (match && (match[1] || !context)) {

      // HANDLE $(html) -> $(array)
      if (match[1]) {
        let doc = (context ? context.ownerDocument || context : document);

        // If a single string is passed in and it's a single tag
        // just do a createElement and skip the rest
        let ret = rsingleTag.exec(selector);

        if (ret) {
          if (Utils.isPlainObject(context)) {
            Utils.assert(false, 'does not support HTML creation with context');
          } else {
            selector = [doc.createElement(ret[1])];
          }

        } else {
          Utils.assert(false, 'does not support complex HTML creation');
        }

        return Utils.merge(this, selector);

      // HANDLE $("#id")
      } else {
        let elem = document.getElementById(match[2]);

        if (elem) {
          this.length = 1;
          this[0] = elem;
        }

        this.context = document;
        this.selector = selector;
        return this;
      }

    // HANDLE $("TAG")
    } else if (!context && /^\w+$/.test(selector)) {
      this.selector = selector;
      this.context = document;
      selector = document.getElementsByTagName(selector);
      return Utils.merge(this, selector);

    // HANDLE $(expr, $(...))
    } else if (!context || context.iq) {
      return (context || iQ(document)).find(selector);

    // HANDLE $(expr, context)
    // (which is just equivalent to: $(context).find(expr)
    } else {
      return iQ(context).find(selector);
    }

  // HANDLE $(function)
  // Shortcut for document ready
  } else if (typeof selector == "function") {
    Utils.log('iQ does not support ready functions');
    return null;
  }

  if ("selector" in selector) {
    this.selector = selector.selector;
    this.context = selector.context;
  }

  let ret = this || [];
  if (selector != null) {
    // The window, strings (and functions) also have 'length'
    if (selector.length == null || typeof selector == "string" || selector.setInterval) {
      Array.push(ret, selector);
    } else {
      Utils.merge(ret, selector);
    }
  }
  return ret;
};
  
iQClass.prototype = {

  // ----------
  // Function: toString
  // Prints [iQ...] for debug use
  toString: function iQClass_toString() {
    if (this.length > 1) {
      if (this.selector)
        return "[iQ (" + this.selector + ")]";
      else
        return "[iQ multi-object]";
    }

    if (this.length == 1)
      return "[iQ (" + this[0].toString() + ")]";

    return "[iQ non-object]";
  },

  // Start with an empty selector
  selector: "",

  // The default length of a iQ object is 0
  length: 0,

  // ----------
  // Function: each
  // Execute a callback for every element in the matched set.
  each: function iQClass_each(callback) {
    if (typeof callback != "function") {
      Utils.assert(false, "each's argument must be a function");
      return null;
    }
    for (let i = 0; this[i] != null && callback(this[i]) !== false; i++) {}
    return this;
  },

  // ----------
  // Function: addClass
  // Adds the given class(es) to the receiver.
  addClass: function iQClass_addClass(value) {
    Utils.assertThrow(typeof value == "string" && value,
                      'requires a valid string argument');

    let length = this.length;
    for (let i = 0; i < length; i++) {
      let elem = this[i];
      if (elem.nodeType === 1) {
        value.split(/\s+/).forEach(function(className) {
          elem.classList.add(className);
        });
      }
    }

    return this;
  },

  // ----------
  // Function: removeClass
  // Removes the given class(es) from the receiver.
  removeClass: function iQClass_removeClass(value) {
    if (typeof value != "string" || !value) {
      Utils.assert(false, 'does not support function argument');
      return null;
    }

    let length = this.length;
    for (let i = 0; i < length; i++) {
      let elem = this[i];
      if (elem.nodeType === 1 && elem.className) {
        value.split(/\s+/).forEach(function(className) {
          elem.classList.remove(className);
        });
      }
    }

    return this;
  },

  // ----------
  // Function: hasClass
  // Returns true is the receiver has the given css class.
  hasClass: function iQClass_hasClass(singleClassName) {
    let length = this.length;
    for (let i = 0; i < length; i++) {
      if (this[i].classList.contains(singleClassName)) {
        return true;
      }
    }
    return false;
  },

  // ----------
  // Function: find
  // Searches the receiver and its children, returning a new iQ object with
  // elements that match the given selector.
  find: function iQClass_find(selector) {
    let ret = [];
    let length = 0;

    let l = this.length;
    for (let i = 0; i < l; i++) {
      length = ret.length;
      try {
        Utils.merge(ret, this[i].querySelectorAll(selector));
      } catch(e) {
        Utils.log('iQ.find error (bad selector)', e);
      }

      if (i > 0) {
        // Make sure that the results are unique
        for (let n = length; n < ret.length; n++) {
          for (let r = 0; r < length; r++) {
            if (ret[r] === ret[n]) {
              ret.splice(n--, 1);
              break;
            }
          }
        }
      }
    }

    return iQ(ret);
  },

  // ----------
  // Function: contains
  // Check to see if a given DOM node descends from the receiver.
  contains: function iQClass_contains(selector) {
    Utils.assert(this.length == 1, 'does not yet support multi-objects (or null objects)');

    // fast path when querySelector() can be used
    if ('string' == typeof selector)
      return null != this[0].querySelector(selector);

    let object = iQ(selector);
    Utils.assert(object.length <= 1, 'does not yet support multi-objects');

    let elem = object[0];
    if (!elem || !elem.parentNode)
      return false;

    do {
      elem = elem.parentNode;
    } while (elem && this[0] != elem);

    return this[0] == elem;
  },

  // ----------
  // Function: remove
  // Removes the receiver from the DOM.
  remove: function iQClass_remove(options) {
    if (!options || !options.preserveEventHandlers)
      this.unbindAll();
    for (let i = 0; this[i] != null; i++) {
      let elem = this[i];
      if (elem.parentNode) {
        elem.parentNode.removeChild(elem);
      }
    }
    return this;
  },

  // ----------
  // Function: empty
  // Removes all of the reciever's children and HTML content from the DOM.
  empty: function iQClass_empty() {
    for (let i = 0; this[i] != null; i++) {
      let elem = this[i];
      while (elem.firstChild) {
        iQ(elem.firstChild).unbindAll();
        elem.removeChild(elem.firstChild);
      }
    }
    return this;
  },

  // ----------
  // Function: width
  // Returns the width of the receiver, including padding and border.
  width: function iQClass_width() {
    return Math.floor(this[0].offsetWidth);
  },

  // ----------
  // Function: height
  // Returns the height of the receiver, including padding and border.
  height: function iQClass_height() {
    return Math.floor(this[0].offsetHeight);
  },

  // ----------
  // Function: position
  // Returns an object with the receiver's position in left and top
  // properties.
  position: function iQClass_position() {
    let bounds = this.bounds();
    return new Point(bounds.left, bounds.top);
  },

  // ----------
  // Function: bounds
  // Returns a <Rect> with the receiver's bounds.
  bounds: function iQClass_bounds() {
    Utils.assert(this.length == 1, 'does not yet support multi-objects (or null objects)');
    let rect = this[0].getBoundingClientRect();
    return new Rect(Math.floor(rect.left), Math.floor(rect.top),
                    Math.floor(rect.width), Math.floor(rect.height));
  },

  // ----------
  // Function: data
  // Pass in both key and value to attach some data to the receiver;
  // pass in just key to retrieve it.
  data: function iQClass_data(key, value) {
    let data = null;
    if (value === undefined) {
      Utils.assert(this.length == 1, 'does not yet support multi-objects (or null objects)');
      data = this[0].iQData;
      if (data)
        return data[key];
      else
        return null;
    }

    for (let i = 0; this[i] != null; i++) {
      let elem = this[i];
      data = elem.iQData;

      if (!data)
        data = elem.iQData = {};

      data[key] = value;
    }

    return this;
  },

  // ----------
  // Function: html
  // Given a value, sets the receiver's innerHTML to it; otherwise returns
  // what's already there.
  html: function iQClass_html(value) {
    Utils.assert(this.length == 1, 'does not yet support multi-objects (or null objects)');
    if (value === undefined)
      return this[0].innerHTML;

    this[0].innerHTML = value;
    return this;
  },

  // ----------
  // Function: text
  // Given a value, sets the receiver's textContent to it; otherwise returns
  // what's already there.
  text: function iQClass_text(value) {
    Utils.assert(this.length == 1, 'does not yet support multi-objects (or null objects)');
    if (value === undefined) {
      return this[0].textContent;
    }

    return this.empty().append((this[0] && this[0].ownerDocument || document).createTextNode(value));
  },

  // ----------
  // Function: val
  // Given a value, sets the receiver's value to it; otherwise returns what's already there.
  val: function iQClass_val(value) {
    Utils.assert(this.length == 1, 'does not yet support multi-objects (or null objects)');
    if (value === undefined) {
      return this[0].value;
    }

    this[0].value = value;
    return this;
  },

  // ----------
  // Function: appendTo
  // Appends the receiver to the result of iQ(selector).
  appendTo: function iQClass_appendTo(selector) {
    Utils.assert(this.length == 1, 'does not yet support multi-objects (or null objects)');
    iQ(selector).append(this);
    return this;
  },

  // ----------
  // Function: append
  // Appends the result of iQ(selector) to the receiver.
  append: function iQClass_append(selector) {
    let object = iQ(selector);
    Utils.assert(object.length == 1 && this.length == 1, 
        'does not yet support multi-objects (or null objects)');
    this[0].appendChild(object[0]);
    return this;
  },

  // ----------
  // Function: attr
  // Sets or gets an attribute on the element(s).
  attr: function iQClass_attr(key, value) {
    Utils.assert(typeof key === 'string', 'string key');
    if (value === undefined) {
      Utils.assert(this.length == 1, 'retrieval does not support multi-objects (or null objects)');
      return this[0].getAttribute(key);
    }

    for (let i = 0; this[i] != null; i++)
      this[i].setAttribute(key, value);

    return this;
  },

  // ----------
  // Function: css
  // Sets or gets CSS properties on the receiver. When setting certain numerical properties,
  // will automatically add "px". A property can be removed by setting it to null.
  //
  // Possible call patterns:
  //   a: object, b: undefined - sets with properties from a
  //   a: string, b: undefined - gets property specified by a
  //   a: string, b: string/number - sets property specified by a to b
  css: function iQClass_css(a, b) {
    let properties = null;

    if (typeof a === 'string') {
      let key = a;
      if (b === undefined) {
        Utils.assert(this.length == 1, 'retrieval does not support multi-objects (or null objects)');

        return window.getComputedStyle(this[0], null).getPropertyValue(key);
      }
      properties = {};
      properties[key] = b;
    } else if (a instanceof Rect) {
      properties = {
        left: a.left,
        top: a.top,
        width: a.width,
        height: a.height
      };
    } else {
      properties = a;
    }

    let pixels = {
      'left': true,
      'top': true,
      'right': true,
      'bottom': true,
      'width': true,
      'height': true
    };

    for (let i = 0; this[i] != null; i++) {
      let elem = this[i];
      for (let key in properties) {
        let value = properties[key];

        if (pixels[key] && typeof value != 'string')
          value += 'px';

        if (value == null) {
          elem.style.removeProperty(key);
        } else if (key.indexOf('-') != -1)
          elem.style.setProperty(key, value, '');
        else
          elem.style[key] = value;
      }
    }

    return this;
  },

  // ----------
  // Function: animate
  // Uses CSS transitions to animate the element.
  //
  // Parameters:
  //   css - an object map of the CSS properties to change
  //   options - an object with various properites (see below)
  //
  // Possible "options" properties:
  //   duration - how long to animate, in milliseconds
  //   easing - easing function to use. Possibilities include
  //     "tabviewBounce", "easeInQuad". Default is "ease".
  //   complete - function to call once the animation is done, takes nothing
  //     in, but "this" is set to the element that was animated.
  animate: function iQClass_animate(css, options) {
    Utils.assert(this.length == 1, 'does not yet support multi-objects (or null objects)');

    if (!options)
      options = {};

    let easings = {
      tabviewBounce: "cubic-bezier(0.0, 0.63, .6, 1.29)", 
      easeInQuad: 'ease-in', // TODO: make it a real easeInQuad, or decide we don't care
      fast: 'cubic-bezier(0.7,0,1,1)'
    };

    let duration = (options.duration || 400);
    let easing = (easings[options.easing] || 'ease');

    if (css instanceof Rect) {
      css = {
        left: css.left,
        top: css.top,
        width: css.width,
        height: css.height
      };
    }


    // The latest versions of Firefox do not animate from a non-explicitly
    // set css properties. So for each element to be animated, go through
    // and explicitly define 'em.
    let rupper = /([A-Z])/g;
    this.each(function(elem) {
      let cStyle = window.getComputedStyle(elem, null);
      for (let prop in css) {
        prop = prop.replace(rupper, "-$1").toLowerCase();
        iQ(elem).css(prop, cStyle.getPropertyValue(prop));
      }
    });

    this.css({
      'transition-property': Object.keys(css).join(", "),
      'transition-duration': (duration / 1000) + 's',
      'transition-timing-function': easing
    });

    this.css(css);

    let self = this;
    setTimeout(function() {
      self.css({
        'transition-property': 'none',
        'transition-duration': '',
        'transition-timing-function': ''
      });

      if (typeof options.complete == "function")
        options.complete.apply(self);
    }, duration);

    return this;
  },

  // ----------
  // Function: fadeOut
  // Animates the receiver to full transparency. Calls callback on completion.
  fadeOut: function iQClass_fadeOut(callback) {
    Utils.assert(typeof callback == "function" || callback === undefined, 
        'does not yet support duration');

    this.animate({
      opacity: 0
    }, {
      duration: 400,
      complete: function() {
        iQ(this).css({display: 'none'});
        if (typeof callback == "function")
          callback.apply(this);
      }
    });

    return this;
  },

  // ----------
  // Function: fadeIn
  // Animates the receiver to full opacity.
  fadeIn: function iQClass_fadeIn() {
    this.css({display: ''});
    this.animate({
      opacity: 1
    }, {
      duration: 400
    });

    return this;
  },

  // ----------
  // Function: hide
  // Hides the receiver.
  hide: function iQClass_hide() {
    this.css({display: 'none', opacity: 0});
    return this;
  },

  // ----------
  // Function: show
  // Shows the receiver.
  show: function iQClass_show() {
    this.css({display: '', opacity: 1});
    return this;
  },

  // ----------
  // Function: bind
  // Binds the given function to the given event type. Also wraps the function
  // in a try/catch block that does a Utils.log on any errors.
  bind: function iQClass_bind(type, func) {
    let handler = function(event) func.apply(this, [event]);

    for (let i = 0; this[i] != null; i++) {
      let elem = this[i];
      if (!elem.iQEventData)
        elem.iQEventData = {};

      if (!elem.iQEventData[type])
        elem.iQEventData[type] = [];

      elem.iQEventData[type].push({
        original: func,
        modified: handler
      });

      elem.addEventListener(type, handler, false);
    }

    return this;
  },

  // ----------
  // Function: one
  // Binds the given function to the given event type, but only for one call;
  // automatically unbinds after the event fires once.
  one: function iQClass_one(type, func) {
    Utils.assert(typeof func == "function", 'does not support eventData argument');

    let handler = function(e) {
      iQ(this).unbind(type, handler);
      return func.apply(this, [e]);
    };

    return this.bind(type, handler);
  },

  // ----------
  // Function: unbind
  // Unbinds the given function from the given event type.
  unbind: function iQClass_unbind(type, func) {
    Utils.assert(typeof func == "function", 'Must provide a function');

    for (let i = 0; this[i] != null; i++) {
      let elem = this[i];
      let handler = func;
      if (elem.iQEventData && elem.iQEventData[type]) {
        let count = elem.iQEventData[type].length;
        for (let a = 0; a < count; a++) {
          let pair = elem.iQEventData[type][a];
          if (pair.original == func) {
            handler = pair.modified;
            elem.iQEventData[type].splice(a, 1);
            if (!elem.iQEventData[type].length) {
              delete elem.iQEventData[type];
              if (!Object.keys(elem.iQEventData).length)
                delete elem.iQEventData;
            }
            break;
          }
        }
      }

      elem.removeEventListener(type, handler, false);
    }

    return this;
  },

  // ----------
  // Function: unbindAll
  // Unbinds all event handlers.
  unbindAll: function iQClass_unbindAll() {
    for (let i = 0; this[i] != null; i++) {
      let elem = this[i];

      for (let j = 0; j < elem.childElementCount; j++)
        iQ(elem.children[j]).unbindAll();

      if (!elem.iQEventData)
        continue;

      Object.keys(elem.iQEventData).forEach(function (type) {
        while (elem.iQEventData && elem.iQEventData[type])
          this.unbind(type, elem.iQEventData[type][0].original);
      }, this);
    }

    return this;
  }
};

// ----------
// Create various event aliases
var events = [
  'keyup',
  'keydown',
  'keypress',
  'mouseup',
  'mousedown',
  'mouseover',
  'mouseout',
  'mousemove',
  'click',
  'dblclick',
  'resize',
  'change',
  'blur',
  'focus'
];

events.forEach(function(event) {
  iQClass.prototype[event] = function(func) {
    return this.bind(event, func);
  };
});
