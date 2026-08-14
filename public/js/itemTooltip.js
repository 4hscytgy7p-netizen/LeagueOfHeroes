class ItemTooltip {
  constructor(config = {}) {
    this.tooltip = null;
    this.items = [];
    this.hideTimeout = null;
    this.showTimeout = null;
    this.isHoveringTooltip = false;
    this.config = {
      offsetX: 16,
      offsetY: 16,
      fadeInDelay: 220,
      fadeOutDelay: 120,
      ...config
    };
  }

  init(tooltipElement, items) {
    this.tooltip = tooltipElement;
    if (items && items.length) this.items = items;

    if (this.tooltip) {
      this.tooltip.addEventListener('mouseenter', () => {
        this.isHoveringTooltip = true;
        if (this.hideTimeout) {
          clearTimeout(this.hideTimeout);
          this.hideTimeout = null;
        }
      });

      this.tooltip.addEventListener('mouseleave', () => {
        this.isHoveringTooltip = false;
        this.scheduleHide();
      });
    }

    document.addEventListener('mouseover', (e) => this.handleMouseOver(e));
    document.addEventListener('mouseout', (e) => this.handleMouseOut(e));
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));

    this.annotateItemAnchors(document.body);
  }

  annotateItemAnchors(container) {
    const anchors = container.querySelectorAll('a[href*="/items/"]');
    anchors.forEach(a => {
      if (!a.classList.contains('item-link')) {
        const href = a.getAttribute('href') || '';
        const m = href.match(/\/items\/(.+?)(?:[\/\?#]|$)/);
        if (m) {
          a.classList.add('item-link');
          a.dataset.itemId = decodeURIComponent(m[1]);
        }
      }
    });
  }

  async linkifyItemsInNode(container) {
    if (!container) return;
    // ensure anchors already annotated
    this.annotateItemAnchors(container);

    // ensure we have items list
    let items = this.items && this.items.length ? this.items : await this.loadRegularItems();
    if (!items || items.length === 0) return;

    const nameIndex = items.map(it => ({
      id: it.id,
      name: (it.name || '').toLowerCase(),
      nameEn: (it.nameEn || '').toLowerCase()
    }));

    // create simple normalization variants for matching (strip common russian endings)
    function variantsOf(s) {
      if (!s) return [s];
      const base = s.toLowerCase();
      const variants = new Set([base]);
      // strip simple endings
      const endings = ['ы','а','ов','ев','и','я','ей','ом','у','ах','ях','ю','ть','ый','ые','ое'];
      endings.forEach(end => {
        if (base.endsWith(end)) variants.add(base.slice(0, -end.length));
      });
      // also add words split by space parts
      base.split(/\s+/).forEach(part => variants.add(part));
      return Array.from(variants).filter(Boolean);
    }

    const entries = nameIndex.map(n => ({
      id: n.id,
      variants: Array.from(new Set([n.name, n.nameEn].flatMap(v => variantsOf(v))))
    }));

    // collect text nodes
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) { // eslint-disable-line no-cond-assign
      textNodes.push(node);
    }

    for (const tNode of textNodes) {
      if (!tNode.nodeValue || !tNode.nodeValue.trim()) continue;
      if (tNode.parentElement && tNode.parentElement.closest && tNode.parentElement.closest('a')) continue;

      const nodeText = tNode.nodeValue;
      const lowerText = nodeText.toLowerCase();

      // find candidate matches
      const matches = [];
      for (const e of entries) {
        for (const v of e.variants) {
          if (!v) continue;
          let start = 0;
          while (true) {
            const idx = lowerText.indexOf(v, start);
            if (idx === -1) break;
            // ensure reasonable boundaries (not part of long word)
            const left = idx > 0 ? lowerText[idx - 1] : '';
            const right = idx + v.length < lowerText.length ? lowerText[idx + v.length] : '';
            const leftOk = left === '' || /[\s\(\[\.,;:\-–—]/.test(left) || /\d/.test(left);
            const rightOk = right === '' || /[\s\)\]\.,;:\-–—]/.test(right) || /\d/.test(right);
            if (leftOk && rightOk) {
              matches.push({ index: idx, length: v.length, id: e.id, text: nodeText.substr(idx, v.length) });
            }
            start = idx + v.length;
          }
        }
      }
      if (matches.length === 0) continue;

      // prefer longer matches, avoid overlaps
      matches.sort((a, b) => b.length - a.length || a.index - b.index);
      const occupied = new Array(nodeText.length).fill(false);
      const chosen = [];
      for (const m of matches) {
        let conflict = false;
        for (let p = m.index; p < m.index + m.length; p++) {
          if (occupied[p]) { conflict = true; break; }
        }
        if (!conflict) {
          chosen.push(m);
          for (let p = m.index; p < m.index + m.length; p++) occupied[p] = true;
        }
      }
      if (chosen.length === 0) continue;
      chosen.sort((a, b) => a.index - b.index);

      const parent = tNode.parentNode;
      if (!parent) continue;
      const frag = document.createDocumentFragment();
      let pos = 0;
      for (const m of chosen) {
        if (m.index > pos) frag.appendChild(document.createTextNode(nodeText.slice(pos, m.index)));
        const a = document.createElement('a');
        a.href = `/items/${encodeURIComponent(m.id)}`;
        a.className = 'item-link';
        a.dataset.itemId = m.id;
        a.textContent = nodeText.slice(m.index, m.index + m.length);
        frag.appendChild(a);
        pos = m.index + m.length;
      }
      if (pos < nodeText.length) frag.appendChild(document.createTextNode(nodeText.slice(pos)));
      parent.insertBefore(frag, tNode);
      parent.removeChild(tNode);
    }
    // finally annotate anchors we added
    this.annotateItemAnchors(container);
  }

  async loadRegularItems() {
    if (this.items && this.items.length) return this.items;
    try {
      const res = await fetch('/api/items');
      if (res.ok) {
        const data = await res.json();
        this.items = data;
        return this.items;
      }
    } catch (e) {
      // ignore
    }
    return [];
  }

  handleMouseOver(event) {
    const target = event.target;
    const link = target.closest ? target.closest('.item-link') : null;
    if (link && link.dataset.itemId) {
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }

      const itemId = link.dataset.itemId;
      this.showTimeout = window.setTimeout(async () => {
        let item = this.items.find(i => i.id === itemId);
        if (!item) {
          const items = await this.loadRegularItems();
          item = items.find(i => i.id === itemId) || null;
        }
        if (item && this.tooltip) this.showTooltip(item, event);
      }, this.config.fadeInDelay);
    }
  }

  handleMouseOut(event) {
    const target = event.target;
    const link = target.closest ? target.closest('.item-link') : null;
    if (link) {
      if (this.showTimeout) {
        clearTimeout(this.showTimeout);
        this.showTimeout = null;
      }
      const related = event.relatedTarget;
      if (related && (related === this.tooltip || (this.tooltip && this.tooltip.contains && this.tooltip.contains(related)))) {
        return;
      }
      this.scheduleHide();
    }
  }

  handleMouseMove(event) {
    if (!this.tooltip || this.tooltip.style.display === 'none') return;
    const target = event.target;
    const link = target.closest ? target.closest('.item-link') : null;
    if (link) {
      this.positionTooltip(event);
    }
  }

  scheduleHide() {
    this.hideTimeout = window.setTimeout(() => {
      if (!this.isHoveringTooltip) this.hideTooltip();
    }, this.config.fadeOutDelay);
  }

  showTooltip(item, event) {
    if (!this.tooltip) return;
    this.tooltip.innerHTML = this.renderTooltipContent(item);
    this.tooltip.style.display = 'block';
    this.tooltip.setAttribute('aria-hidden', 'false');
    this.positionTooltip(event);
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.style.display = 'none';
    this.tooltip.setAttribute('aria-hidden', 'true');
    this.tooltip.innerHTML = '';
  }

  positionTooltip(event) {
    if (!this.tooltip) return;
    const rect = this.tooltip.getBoundingClientRect();
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    let left = event.clientX + this.config.offsetX;
    let top = event.clientY + this.config.offsetY;

    if (event.clientX > vpW * 0.66) {
      left = event.clientX - rect.width - this.config.offsetX;
    }

    if (left + rect.width + 12 > vpW) left = vpW - rect.width - 12;
    if (top + rect.height + 12 > vpH) top = Math.max(12, vpH - rect.height - 12);

    left = Math.max(8, left);
    top = Math.max(8, top);

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  renderTooltipContent(item) {
    return `
      <div class="tooltip-card">
        <div class="tooltip-header">
          <div class="tooltip-title">${item.name} <span class="name-en">[${item.nameEn || ''}]</span></div>
          <div class="tooltip-source">${item.sourceBook || ''}</div>
        </div>
        <div class="tooltip-meta">
          <span class="tooltip-type">${item.type || ''}</span>
          <span class="tooltip-cost">${item.cost || ''}</span>
          <span class="tooltip-weight">${item.weight || ''}</span>
        </div>
        <div class="tooltip-desc">${item.description || ''}</div>
      </div>
    `;
  }

  destroy() {
    if (this.showTimeout) clearTimeout(this.showTimeout);
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
  }
}

// Expose on window for script loaders
try {
  if (typeof window !== 'undefined') {
    window.ItemTooltip = ItemTooltip;
  }
} catch (e) {
  // ignore
}
