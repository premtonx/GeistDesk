// Loaded before the Vite bundle. Vite aliases `localStorage` → `window.safeLocalStorage`.
// Must be an external file (not inline) to satisfy production Helmet CSP (script-src 'self').

(function () {
  const originalDefineProperty = Object.defineProperty;
  Object.defineProperty = function (obj, prop, descriptor) {
    if (prop === 'ethereum' && obj === window) {
      try {
        return originalDefineProperty.apply(this, arguments);
      } catch (e) {
        console.warn('Prevented ethereum redefinition error');
        return obj;
      }
    }
    return originalDefineProperty.apply(this, arguments);
  };
})();

(function () {
  let originalStorage = null;
  let useFallback = false;
  try {
    if (window.localStorage) {
      window.localStorage.getItem('__test_storage_integrity__');
      originalStorage = window.localStorage;
    } else {
      useFallback = true;
    }
  } catch (e) {
    useFallback = true;
  }

  let storageMock = null;
  const memoryDatabase = {};

  const memoryStorage = {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(memoryDatabase, key) ? memoryDatabase[key] : null;
    },
    setItem: function (key, val) {
      memoryDatabase[key] = String(val);
    },
    removeItem: function (key) {
      delete memoryDatabase[key];
    },
    clear: function () {
      for (const k in memoryDatabase) {
        delete memoryDatabase[k];
      }
    },
    key: function (idx) {
      return Object.keys(memoryDatabase)[idx] || null;
    },
    get length() {
      return Object.keys(memoryDatabase).length;
    },
  };

  const resolveStorage = function () {
    if (useFallback) return storageMock || memoryStorage;
    return storageMock || originalStorage || memoryStorage;
  };

  try {
    Object.defineProperty(window, 'localStorage', {
      get: resolveStorage,
      set: function (val) {
        console.warn('Intercepted window.localStorage setter. Assigned safely.');
        storageMock = val;
      },
      configurable: true,
      enumerable: true,
    });
    window.safeLocalStorage = resolveStorage();
  } catch (e) {
    console.warn('Could not defineProperty localStorage on window directly.', e);
    try {
      Object.defineProperty(Window.prototype, 'localStorage', {
        get: resolveStorage,
        set: function (val) {
          storageMock = val;
        },
        configurable: true,
        enumerable: true,
      });
      window.safeLocalStorage = resolveStorage();
    } catch (protoErr) {
      console.error('Failed to redefine localStorage:', protoErr);
      window.safeLocalStorage = memoryStorage;
    }
  }

  if (!window.safeLocalStorage) {
    window.safeLocalStorage = memoryStorage;
  }
})();
