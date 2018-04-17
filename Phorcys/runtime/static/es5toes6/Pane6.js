class Pane {
  constructor(id) {
    const self = this;

    const el = document.createElement('div');
    el.className = 'window';

    const grip = document.createElement('div');
    grip.className = 'grip';

    const bar = document.createElement('div');
    bar.className = 'bar';

    const closeButton = document.createElement('button');
    closeButton.innerHTML = 'x';
    closeButton.title = 'close';

    const cloneButton = document.createElement('button');
    cloneButton.innerHTML = '-';
    cloneButton.title = 'disconnect';

    const title = document.createElement('div');
    title.className = 'title';

    const content = document.createElement('div');
    content.className = 'content';

    this.id = id;
    this.element = el;
    this.bar = bar;
    this.grip = grip;
    this.title = title;
    this.content = content;

    el.appendChild(grip);
    el.appendChild(bar);
    el.appendChild(content);
    bar.appendChild(closeButton);
    bar.appendChild(cloneButton);
    bar.appendChild(title);
    body.appendChild(el);

    on(closeButton, 'click', ev => {
      self.destroy();
      return cancel(ev);
    });

    on(cloneButton, 'click', ev => {
      bar.removeChild(cloneButton);
      self.id = id + Math.random();
      self.title.innerHTML += ' (offline)';
      delete panes[id];
      panes[self.id] = self;
      return cancel(ev);
    });

    on(grip, 'mousedown', ev => {
      self.focus();
      self.resizing(ev);
      return cancel(ev);
    });

    on(el, 'mousedown', ev => {
      if (ev.target.nodeName === "BUTTON") return true;
      self.focus();
      if (ev.target !== el && ev.target !== bar && ev.target !== title) return true;
      self.drag(ev);
      return cancel(ev);
    });

    on(bar, 'dblclick', ev => {
      self.maximize();
    });

    this.focus();

    const position = JSON.parse(localStorage.getItem(id) || 'false') || findPlacement();
    if (position.maximized) {
      this.maximize();
    } else {
      el.style.left = position.left;
      el.style.top = position.top;
      el.style.width = position.width;
      el.style.height = position.height;
    }

    panes[id] = this;
  }

  setTitle(title) {
    this.title.innerHTML = title;
  }

  focus() {
    // Restack, but only if not already last.
    // Otherwise, dblclick won't work.
    if (!this.element.nextSibling) return;
    const parent = this.element.parentNode;
    if (parent) {
      parent.removeChild(this.element);
      parent.appendChild(this.element);
    }
  }

  save() {
    const el = this.element;
    const position = {
      left: el.style.left,
      top: el.style.top,
      width: el.style.width,
      height: el.style.height,
      maximized: false, // ('minimize' in this),
    };
    localStorage.setItem(this.id, JSON.stringify(position));
  }

  destroy(keepPosition) {
    if (this.destroyed) return;
    this.destroyed = true;

    delete panes[this.id];
    this.element.parentNode.removeChild(this.element);
    if (!keepPosition)
      localStorage.removeItem(this.id);
  }

  drag(ev) {
    const self = this, el = this.element;

    if (this.minimize) return;

    const anchor = {
      x: ev.pageX - el.offsetLeft,
      y: ev.pageY - el.offsetTop,
    };

    el.style.opacity = '0.60';
    root.style.cursor = 'move';

    function move(ev) {
      el.style.left = `${ev.pageX - anchor.x}px`;
      el.style.top = `${Math.max(0, ev.pageY - anchor.y)}px`;
    }

    function up() {
      el.style.opacity = '';
      root.style.cursor = '';

      off(document, 'mousemove', move);
      off(document, 'mouseup', up);
      self.save();
    }

    on(document, 'mousemove', move);
    on(document, 'mouseup', up);
  }

  resizing(ev) {
    const self = this, el = this.element;

    delete this.minimize;

    const anchor = {
      x: ev.pageX - el.offsetWidth,
      y: ev.pageY - el.offsetHeight,
    };

    el.style.opacity = '0.70';
    root.style.cursor = 'se-resize';

    function move(ev) {
      el.style.width = `${ev.pageX - anchor.x}px`;
      el.style.height = `${ev.pageY - anchor.y}px`;
    }

    function up(ev) {
      el.style.opacity = '';
      root.style.cursor = '';
      off(document, 'mousemove', move);
      off(document, 'mouseup', up);
      self.save();
      if (self.onresize) self.onresize();
    }

    on(document, 'mousemove', move);
    on(document, 'mouseup', up);
  }

  maximize() {
    if (this.minimize) return this.minimize();

    const self = this, el = this.element, grip = this.grip;

    const m = {
      left: el.offsetLeft,
      top: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
    };

    this.minimize = () => {
      delete self.minimize;

      el.style.left = `${m.left}px`;
      el.style.top = `${m.top}px`;
      el.style.width = `${m.width}px`;
      el.style.height = `${m.height}px`;
      grip.style.display = '';
      self.save();
      if (self.onresize) self.onresize();
    };

    window.scrollTo(0, 0);

    el.style.left = '0px';
    el.style.top = '0px';
    el.style.width = '100%';
    el.style.height = '100%';
    grip.style.display = 'none';
    self.save();
    if (self.onresize) self.onresize();
  }
}