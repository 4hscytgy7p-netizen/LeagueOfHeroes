import { featureAnchor, resolveSubclass, classViewUrl, visibleClassFeatures, decodeFeatureHash, classProgressionLevels, classSpellSlotLevels } from '../utils/classPage.ts';
const { classData, allSpells, glossary } = JSON.parse(document.getElementById('class-page-data').textContent);
document.addEventListener('DOMContentLoaded', () => {
    const subclassSelect = document.getElementById('subclass-select');
    const classLore = document.getElementById('class-lore');
    const selectedPanel = document.getElementById('selected-subclass');
    const subclassTitle = document.getElementById('subclass-title');
    const firstLevel = document.getElementById('subclass-first-level');
    const levelFilter = document.getElementById('level-filter');
    const featureCount = document.getElementById('feature-count');
    const featuresContainer = document.getElementById('features-container');
    const featureTemplate = document.getElementById('feature-template');
    const subclassIds = classData.subclasses.map(subclass => subclass.id);
    const storage = {
      get(key) { try { return localStorage.getItem(key); } catch { return null; } },
      set(key, value) { try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* Storage is optional. */ } },
    };
    const explicitLocation = !!location.hash || new URLSearchParams(location.search).has('subclass') || new URLSearchParams(location.search).has('level');
    let currentSubclass = null;
    let pendingFeatureAnchor = null;

    function getFeatureAnchor(featureName, level, isSubclassFeature = false, fallbackIndex = 0) {
      return featureAnchor(featureName || `feature-${fallbackIndex + 1}`, level || fallbackIndex + 1, isSubclassFeature);
    }

    function assignFeatureAnchors() {
      if (!featuresContainer) return;
      const featureElements = Array.from(featuresContainer.querySelectorAll('.feature'));
      featureElements.forEach((featureEl, index) => {
        const heading = featureEl.querySelector('h3');
        const featureName = heading?.textContent?.trim() || `feature-${index + 1}`;
        const levelText = featureEl.querySelector('.feature-level')?.textContent || '';
        const levelMatch = levelText.match(/(\d+)/);
        const level = levelMatch ? Number(levelMatch[1]) : index + 1;
        const isSubclassFeature = featureEl.classList.contains('subclass-feature');
        const anchor = featureEl.id || getFeatureAnchor(featureName, level, isSubclassFeature, index);
        featureEl.id = anchor;
        featureEl.setAttribute('data-feature-anchor', anchor);
      });
    }

    function getCurrentFeatureAnchor() {
      return decodeFeatureHash(location.hash);
    }

    function scrollToFeatureAnchor(anchor, behavior = 'auto') {
      if (!anchor) return;
      const target = document.getElementById(anchor);
      if (!target) return;
      if (target.tagName === 'DETAILS') target.open = true;
      if (Number(target.dataset.level) > Number(levelFilter.value)) {
        levelFilter.value = '20';
        applyLevelFilter(true);
      }
      const part = new URLSearchParams(window.location.search).get('featurePart');
      const nested = part && Array.from(target.querySelectorAll('details.collapsible-item'))
        .find(detail => detail.querySelector('summary')?.textContent?.trim() === part);
      if (nested) nested.open = true;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) behavior = 'auto';
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      (nested || target).scrollIntoView({ behavior, block: 'start' });
      target.classList.add('is-targeted');
      window.setTimeout(() => target.classList.remove('is-targeted'), 1800);
    }

    function buildFeatureUrl(featureAnchor = '') {
      const url = new URL(window.location.href);
      if (featureAnchor) {
        url.hash = featureAnchor;
      } else {
        url.hash = '';
      }
      return url.toString();
    }

    function showCopyTooltip(btnEl, message = 'Ссылка скопирована!') {
      let tip = document.querySelector('.copy-tooltip');
      if (!tip) {
        tip = document.createElement('div');
        tip.className = 'copy-tooltip';
        tip.setAttribute('role', 'status');
        tip.setAttribute('aria-live', 'polite');
        document.body.appendChild(tip);
      }
      tip.textContent = message;
      tip.style.opacity = '0';
      tip.style.display = 'block';

      const btnRect = btnEl.getBoundingClientRect();
      requestAnimationFrame(() => {
        const tipRect = tip.getBoundingClientRect();
        let left = btnRect.left + (btnRect.width / 2) - (tipRect.width / 2);
        let top = btnRect.top - tipRect.height - 8;
        if (top < 8) top = btnRect.bottom + 8;
        left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
        tip.style.opacity = '1';
      });

      clearTimeout(tip._hideTimeout);
      tip._hideTimeout = setTimeout(() => {
        tip.style.opacity = '0';
        setTimeout(() => { tip.style.display = 'none'; }, 250);
      }, 900);
    }

    function fallbackCopy(text, btn, restore) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        if (typeof restore === 'function') restore();
        try { showCopyTooltip(btn); } catch (e) { /* ignore */ }
      } catch (err) {
        window.prompt('Скопируйте текст вручную:', text);
      }
      ta.remove();
    }

    function syncSidebarSelection() {
      const activeAnchor = getCurrentFeatureAnchor();
      document.querySelectorAll('.sidebar-feature-link').forEach(link => {
        link.classList.toggle('is-active', link.getAttribute('data-feature-anchor') === activeAnchor);
      });
      document.querySelectorAll('.subclass-item').forEach(item => {
        item.classList.toggle('is-selected', item.getAttribute('data-subclass-id') === (currentSubclass || ''));
      });
      document.querySelectorAll('.subclass-card').forEach(card => {
        if (card.dataset.selectSubclass === currentSubclass) card.setAttribute('aria-current', 'true');
        else card.removeAttribute('aria-current');
      });
    }

    // Create tooltip element and initialize inline tooltip handlers
    const tooltipEl = document.createElement('div');
    tooltipEl.id = 'spell-tooltip';
    tooltipEl.style.display = 'none';
    tooltipEl.style.position = 'fixed';
    tooltipEl.style.zIndex = '10000';
    document.body.appendChild(tooltipEl);

    const tooltipConfig = { offsetX: 12, offsetY: 12, fadeInDelay: 220, fadeOutDelay: 120 };
    let tooltipShowTimeout = null;
    let tooltipHideTimeout = null;
    let currentSpellLink = null;
    let isHoveringTooltip = false;

    tooltipEl.addEventListener('mouseenter', () => {
      isHoveringTooltip = true;
      if (tooltipHideTimeout) {
        clearTimeout(tooltipHideTimeout);
        tooltipHideTimeout = null;
      }
    });

    tooltipEl.addEventListener('mouseleave', () => {
      isHoveringTooltip = false;
      scheduleHide();
    });

    document.addEventListener('mouseover', (e) => {
      const target = e.target;
      const link = target.closest ? target.closest('.spell-link, .state-link') : null;

      if (link) {
        if (tooltipHideTimeout) {
          clearTimeout(tooltipHideTimeout);
          tooltipHideTimeout = null;
        }

        currentSpellLink = link;

        if (link.classList.contains('spell-link') && link.dataset.spellId) {
          const spellId = link.dataset.spellId;
          tooltipShowTimeout = setTimeout(() => {
            const spell = allSpells.find(s => s.id === spellId);
            if (spell) {
              showTooltip(spell, e);
            }
          }, tooltipConfig.fadeInDelay);
        } else if (link.classList.contains('state-link')) {
          const ruleId = link.dataset.ruleId || (link.getAttribute && (link.getAttribute('href')||'').split('#')[1]);
          tooltipShowTimeout = setTimeout(() => {
            const rule = (glossary || []).find(r => r.id === ruleId || r.name === ruleId);
            if (rule) showStateTooltip(rule, e);
          }, tooltipConfig.fadeInDelay);
        }
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target;
      const link = target.closest ? target.closest('.spell-link, .state-link') : null;

      if (link) {
        if (tooltipShowTimeout) {
          clearTimeout(tooltipShowTimeout);
          tooltipShowTimeout = null;
        }

        const relatedTarget = e.relatedTarget;
        if (relatedTarget && (relatedTarget === tooltipEl || tooltipEl.contains(relatedTarget))) {
          return;
        }

        scheduleHide();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!tooltipEl || tooltipEl.style.display === 'none') return;
      const target = e.target;
      const link = target.closest ? target.closest('.spell-link, .state-link') : null;
      if (link === currentSpellLink) {
        positionTooltip(e);
      }
    });

    function scheduleHide() {
      tooltipHideTimeout = setTimeout(() => {
        if (!isHoveringTooltip) hideTooltip();
      }, tooltipConfig.fadeOutDelay);
    }

    function showTooltip(spell, event) {
      // Ensure this is the regular (spell) tooltip style
      if (tooltipEl && tooltipEl.classList) tooltipEl.classList.remove('state-tooltip');
      tooltipEl.innerHTML = renderTooltipContent(spell);
      tooltipEl.style.display = 'block';
      tooltipEl.setAttribute('aria-hidden', 'false');
      positionTooltip(event);
    }

    function hideTooltip() {
      tooltipEl.style.display = 'none';
      tooltipEl.setAttribute('aria-hidden', 'true');
      tooltipEl.innerHTML = '';
      currentSpellLink = null;
      if (tooltipEl && tooltipEl.classList) tooltipEl.classList.remove('state-tooltip');
    }

    function positionTooltip(event) {
      const rect = tooltipEl.getBoundingClientRect();
      const vpW = window.innerWidth;
      const vpH = window.innerHeight;

      let left = event.clientX + tooltipConfig.offsetX;
      let top = event.clientY + tooltipConfig.offsetY;

      // If the cursor is on the right side of the viewport, prefer showing
      // the tooltip to the left of the cursor so it doesn't cover the link.
      if (event.clientX > vpW * 0.66) {
        left = event.clientX - rect.width - tooltipConfig.offsetX;
      }

      if (left + rect.width + 12 > vpW) {
        left = vpW - rect.width - 12;
      }

      if (top + rect.height + 12 > vpH) {
        top = Math.max(12, vpH - rect.height - 12);
      }

      left = Math.max(8, left);
      top = Math.max(8, top);

      // Avoid covering the hovered link if possible
      try {
        if (currentSpellLink && currentSpellLink.getBoundingClientRect) {
          const linkRect = currentSpellLink.getBoundingClientRect();
          const wouldOverlap = !(left + rect.width < linkRect.left || left > linkRect.right || top + rect.height < linkRect.top || top > linkRect.bottom);
          if (wouldOverlap) {
            // Move tooltip to the left of the link if there's space
            const altLeft = linkRect.left - rect.width - 8;
            if (altLeft > 8) left = altLeft;
            else {
              // otherwise try moving above the link
              const altTop = linkRect.top - rect.height - 8;
              if (altTop > 8) top = altTop;
            }
          }
        }
      } catch (e) {
        // ignore
      }

      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;
    }

    function renderTooltipContent(spell) {
      const levelText = spell.level === 'cantrip' ? 'Заговор' : `${spell.level} уровень`;
      const components = formatComponents(spell.components || {});

      return `
        <div class="tooltip-card">
          <div class="tooltip-header">
            <div class="tooltip-title">${spell.name} <span class="name-en">[${spell.nameEn}]</span></div>
            <div class="tooltip-source">${(spell.source && spell.source.book) || ''}${spell.source && spell.source.page ? ', стр. ' + spell.source.page : ''}</div>
          </div>
          <div class="tooltip-meta">
            <span class="tooltip-level">${levelText}</span>
            <span class="tooltip-school">${spell.school || ''}</span>
          </div>
          <div class="tooltip-attrs">
            <div><strong>Время:</strong> ${spell.castingTime || ''}</div>
            <div><strong>Дистанция:</strong> ${spell.range || ''}</div>
            <div><strong>Компоненты:</strong> ${components}</div>
            <div><strong>Длительность:</strong> ${spell.duration || ''}</div>
          </div>
          <div class="tooltip-desc">${spell.description || ''}</div>
        </div>
      `;
    }

    function formatComponents(components) {
      const parts = [];
      if (components.verbal) parts.push('В');
      if (components.somatic) parts.push('С');
      if (components.material) parts.push(`М (${components.material})`);
      return parts.join(', ');
    }

    // State tooltip rendering
    function showStateTooltip(rule, event) {
      // Mark tooltip as a "state" tooltip so CSS can style it differently
      if (tooltipEl && tooltipEl.classList) tooltipEl.classList.add('state-tooltip');
      tooltipEl.innerHTML = renderStateTooltipContent(rule);
      tooltipEl.style.display = 'block';
      tooltipEl.setAttribute('aria-hidden', 'false');
      positionTooltip(event);
    }

    function renderStateTooltipContent(rule) {
      const title = rule.name || '';
      const cat = rule.category ? `<span class="tooltip-source">${rule.category}</span>` : '';
      const body = rule.html || rule.description || '';
      return `
        <div class="tooltip-card">
          <div class="tooltip-header">
            <div class="tooltip-title">${title}</div>
            ${cat}
          </div>
          <div class="tooltip-desc">${body}</div>
        </div>
      `;
    }

    // Linkify server-rendered feature content (but NOT the top-level class
    // description). Markers in features should become links and get tooltip hooks.
    try {
      linkifySpellsInNode(featuresContainer, allSpells);
      try { linkifyStatesInNode(featuresContainer, glossary); } catch (e) { /* ignore */ }
    } catch (e) {
      console.error('initial linkify failed', e);
    }

    // Replace plain text occurrences inside text nodes with anchor links to spells
    // Replace the first occurrence of `name` inside `textNode` with an anchor.
    // Returns the "after" text node so callers can continue processing the rest
    // of the original text (allows multiple replacements inside the same node).
    function replaceTextNodeWithLink(textNode, name, id) {
      const idx = textNode.nodeValue.indexOf(name);
      if (idx === -1) return null;

      const parent = textNode.parentNode;
      if (!parent) return null;

      const beforeText = textNode.nodeValue.slice(0, idx);
      const afterText = textNode.nodeValue.slice(idx + name.length);

      const before = document.createTextNode(beforeText);
      const link = document.createElement('a');
      link.href = `/spells/${encodeURIComponent(id)}`;
      link.className = 'spell-link';
      link.dataset.spellId = id;
      link.textContent = name;
      const after = document.createTextNode(afterText);

      parent.insertBefore(before, textNode);
      parent.insertBefore(link, textNode);
      parent.insertBefore(after, textNode);
      parent.removeChild(textNode);

      return after;
    }

    function linkifySpellsInNode(container, spellsList) {
      if (!container) return;

      // First, add class/dataset to existing anchors with /spells/ in href
      const anchors = container.querySelectorAll('a[href*="/spells"], a[data-spell-id]');
      anchors.forEach(a => {
        if (!a.classList.contains('spell-link')) {
          if (a.dataset && a.dataset.spellId) {
            a.classList.add('spell-link');
          } else {
            const href = a.getAttribute('href') || '';
            const m = href.match(/\/spells\/(.+?)(?:[\/\?#]|$)/);
            if (m) {
              a.classList.add('spell-link');
              a.dataset.spellId = decodeURIComponent(m[1]);
            }
          }
        }
      });

      // Then walk text nodes and replace exact spell name occurrences with anchors
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      let node;
      while (node = walker.nextNode()) { // eslint-disable-line no-cond-assign
        textNodes.push(node);
      }

      const markerRe = /\[spell:([^\]|]+)(?:\|([^\]]+))?\]/;
      for (const tNode of textNodes) {
        // skip whitespace-only
        if (!tNode.nodeValue || !tNode.nodeValue.trim()) continue;
        // don't touch if parent is an anchor
        if (tNode.parentElement && tNode.parentElement.closest('a')) continue;
        // First handle explicit markers like [spell:speak-with-animals|Label]
        const m = tNode.nodeValue.match(markerRe);
        if (m) {
          const id = m[1];
          const label = m[2] || (spellsList.find(s => s.id === id)?.name || id);
          const replacedNode = replaceTextNodeWithLink(tNode, m[0], id);
          if (replacedNode) {
            const anchors = container.querySelectorAll(`a.spell-link[data-spell-id="${id}"]`);
            if (anchors.length) anchors[anchors.length - 1].textContent = label;
            // continue processing the remainder of this original node (after the marker)
            let cursor = replacedNode;
            // try to find additional markers in the remainder
            while (cursor && cursor.nodeValue && markerRe.test(cursor.nodeValue)) {
              const mm = cursor.nodeValue.match(markerRe);
              if (!mm) break;
              const id2 = mm[1];
              const label2 = mm[2] || (spellsList.find(s => s.id === id2)?.name || id2);
              const nextAfter = replaceTextNodeWithLink(cursor, mm[0], id2);
              if (nextAfter) {
                const a2 = container.querySelectorAll(`a.spell-link[data-spell-id="${id2}"]`);
                if (a2.length) a2[a2.length - 1].textContent = label2;
                cursor = nextAfter;
                continue;
              }
              break;
            }
            continue;
          }
        }

        // For plain-name matching we apply a light-weight context heuristic to
        // reduce false positives: only auto-link when the node looks like a
        // comma-separated list or contains recommendation words (e.g. "Рекомендуются").
        const nodeText = tNode.nodeValue;
        const lowerText = nodeText.toLowerCase();
        // Detect lists: comma-separated, recommendation phrases, or simple
        // conjunction lists using 'и' (e.g. "A и B" or "A, B и C"). We look
        // for capitalized words around 'и' to reduce false positives in prose.
        const hasComma = nodeText.includes(',');
        const hasRecommend = /рекоменду/i.test(lowerText);
        const hasConjunctionList = /[A-ZА-ЯЁ][^\n]{0,40}\s+и\s+[A-ZА-ЯЁ]/.test(nodeText);
        const hasKnowPhrase = /вы знаете/i.test(lowerText);
        // If the text node is inside a table, treat it as list-like (tables often contain spell lists)
        let isInTable = false;
        let hasLevelHeader = false;
        try {
          const tbl = tNode.parentElement && tNode.parentElement.closest ? tNode.parentElement.closest('table') : null;
          if (tbl) {
            isInTable = true;
            const ths = Array.from(tbl.querySelectorAll('th'));
            hasLevelHeader = ths.some(th => /Уровень\s*\d+/i.test((th.textContent||'').trim()));
          }
        } catch (e) {
          // ignore DOM errors
        }

        const looksLikeList = hasComma || hasRecommend || hasConjunctionList || hasKnowPhrase || isInTable || hasLevelHeader;

        if (!looksLikeList) continue;

        // Collect candidate spells that appear in the node's text.
        const candidates = spellsList.filter(s => nodeText.indexOf(s.name) !== -1);
        if (candidates.length === 0) continue;

        // For reliable multi-replacement, find all non-overlapping occurrences
        // of candidate names in the node, left-to-right, and rebuild the node
        // content with links inserted.
        const matches = [];
        for (const cand of candidates) {
          let start = 0;
          while (true) {
            const idx = nodeText.indexOf(cand.name, start);
            if (idx === -1) break;
            // boundary checks (not part of larger word)
            const leftChar = idx > 0 ? nodeText[idx - 1] : '';
            const rightChar = idx + cand.name.length < nodeText.length ? nodeText[idx + cand.name.length] : '';
            const leftOk = leftChar === '' || /[\s\(\[\.,;:\-–—]/.test(leftChar);
            const rightOk = rightChar === '' || /[\s\)\]\.,;:\-–—]/.test(rightChar);
            if (leftOk && rightOk) {
              matches.push({ index: idx, name: cand.name, id: cand.id, length: cand.name.length });
            }
            start = idx + cand.name.length;
          }
        }

        if (matches.length === 0) continue;

          // Prefer longer spell names when overlaps occur (e.g. "Дружба" vs "Дружба с животными").
          // Select non-overlapping matches by accepting longer matches first,
          // then sort chosen matches by index for assembly.
          matches.sort((a, b) => {
            if (b.length !== a.length) return b.length - a.length; // longer first
            return a.index - b.index;
          });
          const occupied = new Array(nodeText.length).fill(false);
          const chosen = [];
          for (const m2 of matches) {
            let conflict = false;
            for (let p = m2.index; p < m2.index + m2.length; p++) {
              if (occupied[p]) { conflict = true; break; }
            }
            if (!conflict) {
              chosen.push(m2);
              for (let p = m2.index; p < m2.index + m2.length; p++) occupied[p] = true;
            }
          }
          // sort chosen by index ascending for correct reconstruction
          chosen.sort((a, b) => a.index - b.index);

        // Rebuild node content
        const parent = tNode.parentNode;
        if (!parent) continue;
        let pos = 0;
        const frag = document.createDocumentFragment();
        for (const m of chosen) {
          if (m.index > pos) {
            frag.appendChild(document.createTextNode(nodeText.slice(pos, m.index)));
          }
          const a = document.createElement('a');
          a.href = `/spells/${encodeURIComponent(m.id)}`;
          a.className = 'spell-link';
          a.dataset.spellId = m.id;
          a.textContent = m.name;
          frag.appendChild(a);
          pos = m.index + m.length;
        }
        if (pos < nodeText.length) frag.appendChild(document.createTextNode(nodeText.slice(pos)));
        parent.insertBefore(frag, tNode);
        parent.removeChild(tNode);
      }
    }

    function linkifyStatesInNode(container, glossaryList) {
      if (!container || !glossaryList) return;

      // Annotate existing anchors linking to glossary
      const anchors = container.querySelectorAll('a[href*="/glossary"], a[data-rule-id], a[data-glossary-id]');
      anchors.forEach(a => {
        if (!a.classList.contains('state-link')) {
          const href = a.getAttribute && a.getAttribute('href') || '';
          let id = a.dataset && (a.dataset.ruleId || a.dataset.glossaryId) || null;
          if (!id && href.indexOf('#') !== -1) {
            id = href.split('#')[1];
          }
          if (id) {
            a.classList.add('state-link');
            a.dataset.ruleId = id;
          }
        }
      });

      // Build list of state glossary entries
      const states = (glossaryList || []).filter(g => (g.category || '').toLowerCase() === 'состояния');
      if (!states.length) return;

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      let node;
      while (node = walker.nextNode()) { // eslint-disable-line no-cond-assign
        textNodes.push(node);
      }

      for (const tNode of textNodes) {
        if (!tNode.nodeValue || !tNode.nodeValue.trim()) continue;
        if (tNode.parentElement && tNode.parentElement.closest('a')) continue;

        const nodeText = tNode.nodeValue;
        const lowerText = nodeText.toLowerCase();

        // Extra stems for known problematic states (handles inflected forms)
        const extraStems = {
          bloodied: ['окровавлен', 'окровавл'],
          exhaustion: ['истощен', 'истощ']
        };

        // Collect candidate states that either contain the exact name or a known stem
        const candidates = states.filter(s => {
          const name = (s.name || '').toLowerCase();
          if (!name) return false;
          if (lowerText.indexOf(name) !== -1) return true;
          const stems = extraStems[s.id] || [];
          return stems.some(st => lowerText.indexOf(st) !== -1);
        });
        if (candidates.length === 0) continue;

        const matches = [];
        for (const cand of candidates) {
          const name = cand.name || '';
          const lname = name.toLowerCase();
          const stems = (extraStems[cand.id] || []).slice();
          // search patterns: prefer full name first, then stems
          const patterns = [lname].concat(stems);
          for (const pat of patterns) {
            let start = 0;
            while (true) {
              const idx = lowerText.indexOf(pat, start);
              if (idx === -1) break;
              // If pattern is a stem (shorter than the full name), expand to full word
              let end = idx + pat.length;
              // expand right to include trailing cyrillic letters (inflection)
              while (end < nodeText.length && /[A-Za-zА-Яа-яЁё]/.test(nodeText[end])) end++;
              const actualText = nodeText.slice(idx, end);
              const leftChar = idx > 0 ? nodeText[idx - 1] : '';
              const rightChar = end < nodeText.length ? nodeText[end] : '';
              const leftOk = leftChar === '' || /[\s\(\[\.,;:\-–—]/.test(leftChar);
              const rightOk = rightChar === '' || /[\s\)\]\.,;:\-–—]/.test(rightChar);
              if (leftOk && rightOk) {
                matches.push({ index: idx, name: actualText, id: cand.id, length: actualText.length });
              }
              start = idx + pat.length;
            }
          }
        }
        if (matches.length === 0) continue;

        matches.sort((a, b) => {
          if (b.length !== a.length) return b.length - a.length;
          return a.index - b.index;
        });
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
        chosen.sort((a, b) => a.index - b.index);

        const parent = tNode.parentNode;
        if (!parent) continue;
        let pos = 0;
        const frag = document.createDocumentFragment();
        for (const m of chosen) {
          if (m.index > pos) frag.appendChild(document.createTextNode(nodeText.slice(pos, m.index)));
          const a = document.createElement('a');
          a.href = `/glossary#${encodeURIComponent(m.id)}`;
          a.className = 'state-link';
          a.dataset.ruleId = m.id;
          a.textContent = m.name;
          frag.appendChild(a);
          pos = m.index + m.length;
        }
        if (pos < nodeText.length) frag.appendChild(document.createTextNode(nodeText.slice(pos)));
        parent.insertBefore(frag, tNode);
        parent.removeChild(tNode);
      }
    }

    function createTableElement(tableText) {
      const rows = tableText.split('\n').filter(row => row.trim());
      const table = document.createElement('table');
      table.className = 'spell-table';

      // Check if this is a header-data table format
      const hasHeaders = rows.length > 1 && (
        rows[0].includes('\t') || 
        rows[0].split(/\s{2,}/).length > 1
      );

      if (hasHeaders) {
        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        const headers = rows[0].includes('\t') 
          ? rows[0].split('\t') 
          : rows[0].split(/\s{2,}/);
        
        headers.forEach(header => {
          const th = document.createElement('th');
          th.textContent = header.trim();
          headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        rows.slice(1).forEach(row => {
          const tr = document.createElement('tr');
          const cells = row.includes('\t') 
            ? row.split('\t') 
            : row.split(/\s{2,}/);
          
          cells.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell.trim();
            tr.appendChild(td);
          });
          
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
      } else {
        // Fallback for simple row-based tables
        const tbody = document.createElement('tbody');
        rows.forEach(row => {
          const tr = document.createElement('tr');
          const cells = row.includes('\t') 
            ? row.split('\t') 
            : row.split(/\s{2,}/);
          
          cells.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell.trim();
            tr.appendChild(td);
          });
          
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
      }

      return table;
    }

    function appendCreatureSlot(container, record) {
      if (!record.statBlockIds?.length) return;
      if (record.statBlockNote) {
        const note = document.createElement('p');
        note.className = 'creature-context-note';
        note.textContent = record.statBlockNote;
        container.appendChild(note);
      }
      const slot = document.createElement('div');
      slot.dataset.creatureIds = JSON.stringify(record.statBlockIds);
      container.appendChild(slot);
    }

    function createFeatureElement(feature, isSubclassFeature = false) {
      const template = featureTemplate.content.cloneNode(true);
      const featureElement = template.querySelector('.feature');
      featureElement.dataset.level = feature.level;
      featureElement.tabIndex = -1;
      
      if (isSubclassFeature) {
        featureElement.classList.add('subclass-feature');
        const selectedSubclass = classData.subclasses.find(
          subclass => subclass.id === currentSubclass
        );
        featureElement.dataset.subclassName = selectedSubclass?.name || '';
        const origin = document.createElement('p');
        origin.className = 'feature-origin';
        origin.textContent = `Умение подкласса · ${selectedSubclass?.name || ''}`;
        featureElement.querySelector('.feature-header').after(origin);
      }
      
      featureElement.querySelector('h3').textContent = feature.name;
      // Inject copy button for dynamically created features so subclass features
      // also get the copy control just like server-rendered ones.
      const headerEl = featureElement.querySelector('.feature-header');
      const actions = document.createElement('details');
      actions.className = 'feature-actions';
      const actionLabel = document.createElement('summary');
      actionLabel.textContent = 'Действия';
      actionLabel.setAttribute('aria-label', `Действия с умением «${feature.name}»`);
      const menu = document.createElement('div');
      menu.className = 'feature-actions-menu';
      actions.append(actionLabel, menu);
      headerEl.appendChild(actions);
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'copy-feature-btn';
      copyBtn.setAttribute('aria-label', 'Скопировать ссылку');
      copyBtn.textContent = 'Скопировать ссылку';
      // Ensure dynamically created button has expected visual styling
      menu.appendChild(copyBtn);

      const copyDescriptionBtn = document.createElement('button');
      copyDescriptionBtn.type = 'button';
      copyDescriptionBtn.className = 'copy-feature-btn';
      copyDescriptionBtn.dataset.action = 'copy-description';
      copyDescriptionBtn.setAttribute('aria-label', 'Скопировать описание');
      copyDescriptionBtn.textContent = 'Скопировать описание';
      menu.appendChild(copyDescriptionBtn);

      featureElement.querySelector('.feature-level').textContent = `${feature.level} уровень`;
      
      const descriptionContainer = featureElement.querySelector('.feature-description');
      
      if (feature.collapsible) {
        // Render any textual description first (server renders this too)
        if (Array.isArray(feature.description)) {
          feature.description.forEach(paragraph => {
            const p = document.createElement('p');
            p.textContent = paragraph;
            descriptionContainer.appendChild(p);
          });
        } else if (feature.description) {
          (feature.description || '').split('\n').forEach(paragraph => {
            const p = document.createElement('p');
            p.textContent = paragraph;
            descriptionContainer.appendChild(p);
          });
        }

        const collapsibleContent = document.createElement('div');
        collapsibleContent.className = 'collapsible-content';

        // helpful debugging when testing in browser
        try { console.debug('createFeatureElement: collapsible for', feature.name, feature.collapsible); } catch (e) { /* ignore */ }

        feature.collapsible.forEach(item => {
          const details = document.createElement('details');
          details.className = 'collapsible-item';
          
          const summary = document.createElement('summary');
          summary.textContent = item.title;
          details.appendChild(summary);
          
          const description = document.createElement('div');
          description.className = 'collapsible-description';
          
          if (item.tableData) {
            // If there's a textual description, render it first (support array or string)
            if (Array.isArray(item.description)) {
              item.description.forEach(paragraph => {
                const p = document.createElement('p');
                p.textContent = paragraph;
                description.appendChild(p);
              });
            } else if (item.description) {
              (item.description || '').split('\n').forEach(paragraph => {
                const p = document.createElement('p');
                p.textContent = paragraph;
                description.appendChild(p);
              });
            }

            // Create table from structured data
            const table = document.createElement('table');
            table.className = 'spell-table';
            
            // Create header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            item.tableData.headers.forEach(header => {
              const th = document.createElement('th');
              th.textContent = header;
              headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // Create body
            const tbody = document.createElement('tbody');
            item.tableData.rows.forEach(row => {
              const tr = document.createElement('tr');
              row.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell;
                tr.appendChild(td);
              });
              tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            
            description.appendChild(table);
          } else {
            // Regular text content: support both arrays and strings
            if (Array.isArray(item.description)) {
              item.description.forEach(paragraph => {
                const p = document.createElement('p');
                p.textContent = paragraph;
                description.appendChild(p);
              });
            } else {
              (item.description || '').split('\n').forEach(paragraph => {
                const p = document.createElement('p');
                p.textContent = paragraph;
                description.appendChild(p);
              });
            }
          }
          
          appendCreatureSlot(description, item);
          details.appendChild(description);
          collapsibleContent.appendChild(details);
        });

        descriptionContainer.appendChild(collapsibleContent);

        // Ensure newly created collapsible content is linkified and annotated for item tooltips
        try {
          linkifySpellsInNode(collapsibleContent, allSpells);
          try { linkifyStatesInNode(collapsibleContent, glossary); } catch (e) { /* ignore */ }
        } catch (e) {
          console.error('linkify collapsed failed', e);
        }
        try {
          const inst = window.__itemTooltipInstance;
          if (inst && typeof inst.annotateItemAnchors === 'function') inst.annotateItemAnchors(collapsibleContent);
        } catch (err) {
          // non-fatal
        }
      } else if (feature.name.toLowerCase().includes('таблица')) {
        const table = createTableElement(feature.description || '');
        descriptionContainer.appendChild(table);
      } else {
        (feature.description || '').split('\n').forEach(paragraph => {
          const p = document.createElement('p');
          p.textContent = paragraph;
          descriptionContainer.appendChild(p);
            // After building description, linkify spell anchors and plain names safely
            try {
              linkifySpellsInNode(descriptionContainer, allSpells);
              try { linkifyStatesInNode(descriptionContainer, glossary); } catch (e) { /* ignore */ }
            } catch (e) {
              // non-fatal
              console.error('linkify error', e);
            }
        });
      }

      appendCreatureSlot(descriptionContainer, feature);
      descriptionContainer.querySelectorAll('table').forEach(table => {
        const wrapper = document.createElement('div');
        wrapper.className = 'feature-table-scroll';
        wrapper.tabIndex = 0;
        wrapper.setAttribute('role', 'region');
        wrapper.setAttribute('aria-label', `Таблица умения «${feature.name}»`);
        table.before(wrapper);
        wrapper.appendChild(table);
      });

      return featureElement;
    }

    function updateFeatures(subclassId) {
      if (!featuresContainer || !featureTemplate) return;

      const features = visibleClassFeatures(classData, subclassId);

      const title = featuresContainer.querySelector('h2');
      featuresContainer.innerHTML = '';
      featuresContainer.appendChild(title);

      features.forEach(({ feature, subclass }) => {
        const featureElement = createFeatureElement(feature, subclass);
        featuresContainer.appendChild(featureElement);
      });
      assignFeatureAnchors();
      applyLevelFilter();
      // Ensure spell links and tooltip hooks are set after rendering
      try {
        linkifySpellsInNode(featuresContainer, allSpells);
        try { linkifyStatesInNode(featuresContainer, glossary); } catch (e) { /* ignore */ }
        try {
          const inst = window.__itemTooltipInstance;
          if (inst && typeof inst.annotateItemAnchors === 'function') {
            inst.annotateItemAnchors(featuresContainer);
          }
        } catch (err) {
          // non-fatal
        }
      } catch (e) {
        console.error('linkify after updateFeatures failed', e);
      }
    }

    function applyLevelFilter(writeUrl = false) {
      const maxLevel = Number(levelFilter.value) || 20;
      const features = Array.from(featuresContainer.querySelectorAll('.feature'));
      for (const feature of features) feature.hidden = Number(feature.dataset.level) > maxLevel;
      document.querySelectorAll('.class-table tbody tr[data-level]').forEach(row => { row.hidden = Number(row.dataset.level) > maxLevel; });
      featureCount.textContent = `Умений: ${features.filter(feature => !feature.hidden).length} из ${features.length} · ${maxLevel === 20 ? 'все уровни' : `до ${maxLevel} уровня`}`;
      if (writeUrl) {
        const url = new URL(location.href);
        if (maxLevel < 20) url.searchParams.set('level', String(maxLevel)); else url.searchParams.delete('level');
        const target = document.getElementById(decodeFeatureHash(url.hash));
        if (target && Number(target.dataset.level) > maxLevel) {
          url.hash = '';
          url.searchParams.delete('featurePart');
        }
        history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
      }
    }

    function restoreLevelFilter() {
      const level = Number(new URLSearchParams(location.search).get('level'));
      levelFilter.value = Number.isInteger(level) && level >= 1 && level <= 20 ? String(level) : '20';
    }

    function updateProgression(subclassId) {
      const levels = classProgressionLevels(classData, subclassId);
      const spellLevels = classSpellSlotLevels(levels);
      const table = document.querySelector('#class-progression-table table');
      const slotGroup = table.querySelector('[data-spell-slot-group]');
      if (slotGroup) {
        slotGroup.hidden = !spellLevels.length;
        slotGroup.colSpan = spellLevels.length || 1;
        table.querySelector('[data-spell-slot-levels]').hidden = !spellLevels.length;
        table.querySelectorAll('thead tr:first-child > th:not([data-spell-slot-group])').forEach(cell => {
          cell.rowSpan = spellLevels.length ? 2 : 1;
        });
        table.querySelectorAll('[data-spell-slot]').forEach(cell => {
          const slot = Number(cell.dataset.spellSlot);
          cell.hidden = !spellLevels.includes(slot);
          if (cell.tagName === 'TD') {
            const level = levels.find(level => level.level === Number(cell.parentElement.dataset.level));
            cell.textContent = String(level?.spellSlots?.[slot] || '—');
          }
        });
      }
      const visible = visibleClassFeatures(classData, subclassId);
      const subclass = classData.subclasses.find(item => item.id === subclassId);
      document.querySelectorAll('[data-progression-features]').forEach(cell => {
        const level = classData.levels.find(level => level.level === Number(cell.dataset.level));
        if (!level) return;
        const specialized = subclass?.features.filter(feature => feature.level === level.level) || [];
        const entries = [];
        for (const name of level.features) {
          if (/подкласс/i.test(name) && specialized.length) continue;
          const entry = visible.find(entry => entry.feature.name === name && entry.feature.level === level.level);
          entries.push({ name, entry });
        }
        for (const feature of specialized) entries.push({ name: feature.name, entry: { feature, subclass: true } });
        // A dash is a placeholder, not an additional ability.
        const items = entries.length > 1 ? entries.filter(entry => entry.name !== '—' && entry.name !== '-') : entries;
        cell.replaceChildren();
        items.forEach(({ name, entry }, index) => {
          if (index) cell.appendChild(document.createTextNode(', '));
          if (!entry) { cell.appendChild(document.createTextNode(name)); return; }
          const link = document.createElement('a');
          const anchor = featureAnchor(entry.feature.name, entry.feature.level, entry.subclass);
          link.href = `#${anchor}`;
          link.dataset.featureAnchor = anchor;
          link.textContent = name;
          cell.appendChild(link);
        });
      });
    }

    function applySubclass(subclassId, { historyMode = 'none', anchor = '', focus = false } = {}) {
      const subclass = classData.subclasses.find(item => item.id === subclassId);
      currentSubclass = subclass?.id || '';
      subclassSelect.value = currentSubclass;
      storage.set(`class-${classData.id}-subclass`, currentSubclass || null);
      selectedPanel.hidden = !subclass;
      subclassTitle.textContent = subclass ? `${subclass.name} [${subclass.nameEn}]` : '';
      firstLevel.textContent = subclass?.features.length ? `Первые умения подкласса: ${Math.min(...subclass.features.map(feature => feature.level))} уровень` : '';
      document.querySelectorAll('[data-subclass-material]').forEach(panel => { panel.hidden = panel.dataset.subclassMaterial !== currentSubclass; });
      classLore.innerHTML = subclass ? subclass.description.split('\n').filter(Boolean).map(paragraph => `<p>${paragraph}</p>`).join('') : '';
      document.title = subclass ? `${subclass.name} — ${classData.name} | League of Heroes 5.5E` : `${classData.name} | League of Heroes 5.5E`;
      if (historyMode !== 'none') {
        const url = classViewUrl(location.href, currentSubclass, anchor);
        const existing = `${location.pathname}${location.search}${location.hash}`;
        if (historyMode === 'replace' || url !== existing) history[historyMode === 'push' ? 'pushState' : 'replaceState']({ subclassId: currentSubclass }, '', url);
      }
      pendingFeatureAnchor = anchor;
      updateFeatures(currentSubclass);
      updateProgression(currentSubclass);
      syncSidebarSelection();
      if (pendingFeatureAnchor) {
        scrollToFeatureAnchor(pendingFeatureAnchor);
        pendingFeatureAnchor = null;
      }
      if (focus && !anchor) { subclassTitle.focus({ preventScroll: true }); document.getElementById('subclass-panel').scrollIntoView({ block: 'start' }); }
    }

    subclassSelect.addEventListener('change', () => applySubclass(subclassSelect.value, { historyMode: 'push' }));
    levelFilter.addEventListener('change', () => applyLevelFilter(true));
    window.addEventListener('popstate', () => {
      restoreLevelFilter();
      applySubclass(resolveSubclass(location.search, null, subclassIds), { anchor: getCurrentFeatureAnchor() });
    });
    window.addEventListener('hashchange', () => {
      scrollToFeatureAnchor(getCurrentFeatureAnchor());
      syncSidebarSelection();
    });
    
    // Save scroll position periodically and on page unload
    function saveScrollPosition() {
      storage.set(`class-${classData.id}-scroll`, window.scrollY.toString());
    }
    
    // Load saved scroll position
    function loadScrollPosition() {
      if (explicitLocation || location.hash) return;
      const savedScroll = storage.get(`class-${classData.id}-scroll`);
      if (savedScroll && Number.isFinite(Number(savedScroll))) {
        // Use setTimeout to ensure DOM is fully rendered
        setTimeout(() => {
          window.scrollTo(0, parseInt(savedScroll));
        }, 100);
      }
    }
    
    // Save scroll position on scroll (throttled)
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(saveScrollPosition, 150);
    });
    
    // Save scroll position before page unload
    window.addEventListener('beforeunload', saveScrollPosition);
    
    // Initialize saved states
    document.querySelectorAll('[data-client-controls]').forEach(element => { element.hidden = false; });
    document.querySelectorAll('a[data-select-subclass]').forEach(link => {
      const url = new URL(link.href);
      url.hash = 'subclass-panel';
      link.href = `${url.pathname}${url.search}${url.hash}`;
    });
    subclassSelect.setAttribute('aria-describedby', 'subclass-help');
    restoreLevelFilter();
    applySubclass(resolveSubclass(location.search, storage.get(`class-${classData.id}-subclass`), subclassIds), { historyMode: 'replace', anchor: getCurrentFeatureAnchor() });
    loadScrollPosition();
    
    // Scroll to top button functionality
    const scrollToTopButton = document.getElementById('scroll-to-top');
    
    function toggleScrollButton() {
      if (scrollToTopButton) {
        if (window.scrollY > 300) {
          scrollToTopButton.classList.add('visible');
        } else {
          scrollToTopButton.classList.remove('visible');
        }
      }
    }
    
    function scrollToTop() {
      window.scrollTo({
        top: 0,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
    }
    
    // Show/hide button based on scroll position
    window.addEventListener('scroll', toggleScrollButton);
    
    // Scroll to top when button is clicked
    scrollToTopButton?.addEventListener('click', scrollToTop);
    
    // Initial check for button visibility
    toggleScrollButton();

    document.addEventListener('click', (e) => {
      const sidebarFeature = e.target.closest ? e.target.closest('.sidebar-feature-link') : null;
      const subclassChoice = e.target.closest ? e.target.closest('[data-select-subclass]') : null;
      const progressionFeature = e.target.closest ? e.target.closest('[data-progression-features] a[data-feature-anchor]') : null;
      const btn = e.target.closest ? e.target.closest('.copy-feature-btn') : null;
      const descriptionBtn = e.target.closest ? e.target.closest('.copy-feature-btn[data-action="copy-description"]') : null;

      // Keep ordinary links available for opening a specialization in a new tab.
      if ((subclassChoice || progressionFeature) && (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0)) return;
      if (subclassChoice) {
        e.preventDefault();
        const catalog = document.querySelector('.subclass-catalog');
        if (catalog) catalog.open = false;
        applySubclass(subclassChoice.dataset.selectSubclass, { historyMode: 'push', focus: true });
        return;
      }
      if (progressionFeature) {
        e.preventDefault();
        applySubclass(currentSubclass, { historyMode: 'push', anchor: progressionFeature.dataset.featureAnchor });
        return;
      }

      if (sidebarFeature) {
        e.preventDefault();
        const featureAnchor = sidebarFeature.getAttribute('data-feature-anchor') || '';
        const subclassId = sidebarFeature.getAttribute('data-subclass-id') || currentSubclass || '';
        applySubclass(subclassId, { historyMode: 'push', anchor: featureAnchor });
        return;
      }

      if (descriptionBtn) {
        const featureEl = descriptionBtn.closest('.feature');
        if (!featureEl) return;

        const featureName =
          featureEl.querySelector('.feature-header h3')?.textContent?.trim() || '';

        const levelText =
          featureEl.querySelector('.feature-level')?.textContent?.trim() || '';

        const description =
          featureEl.querySelector('.feature-description')?.innerText?.trim() || '';

        const subclassName =
          featureEl.getAttribute('data-subclass-name')?.trim() || '';

        const sourceLine = subclassName
          ? `${classData.name} — ${subclassName} — ${levelText}`
          : `${classData.name} ${levelText}`;

        const textToCopy = [
          featureName,
          sourceLine,
          description
        ].filter(Boolean).join('\n\n');

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(textToCopy).then(() => {
            showCopyTooltip(descriptionBtn, 'Описание скопировано!');
          }).catch(() => {
            fallbackCopy(
              textToCopy,
              descriptionBtn,
              () => showCopyTooltip(descriptionBtn, 'Описание скопировано!')
            );
          });
        } else {
          fallbackCopy(
            textToCopy,
            descriptionBtn,
            () => showCopyTooltip(descriptionBtn, 'Описание скопировано!')
          );
        }
        return;
      }

      if (!btn) return;
      const featureEl = btn.closest('.feature');
      if (!featureEl) return;

      const featureAnchor = featureEl.id || featureEl.getAttribute('data-feature-anchor') || '';
      const linkToCopy = featureAnchor ? buildFeatureUrl(featureAnchor) : buildFeatureUrl();

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(linkToCopy).then(() => {
          showCopyTooltip(btn);
        }).catch(() => {
          fallbackCopy(linkToCopy, btn, () => { showCopyTooltip(btn); });
        });
      } else {
        fallbackCopy(linkToCopy, btn, () => { showCopyTooltip(btn); });
      }
    });

    // Initialize shared item tooltip using utility (load script and use window.ItemTooltip)
    (function ensureItemTooltipAndInit(){
      function ensureItemTooltip(){
        return new Promise((resolve,reject)=>{
          if (window.ItemTooltip) return resolve(window.ItemTooltip);
          if (document.querySelector('script[data-item-tooltip]')){
            const check = setInterval(()=>{ if (window.ItemTooltip){ clearInterval(check); resolve(window.ItemTooltip); } },50);
            setTimeout(()=>{ clearInterval(check); reject(new Error('timeout loading itemTooltip')); },5000);
            return;
          }
          const s = document.createElement('script');
          s.src = '/js/itemTooltip.js';
          s.async = true;
          s.setAttribute('data-item-tooltip','1');
          s.onload = ()=> resolve(window.ItemTooltip);
          s.onerror = (e)=> reject(e);
          document.head.appendChild(s);
        });
      }

      // Will hold initialized instance so other code can call annotateItemAnchors
      let _itemTooltipInstance = null;

      ensureItemTooltip().then(ItemTooltip => {
        try {
          const itemTooltipEl = document.createElement('div');
          itemTooltipEl.id = 'item-tooltip';
          itemTooltipEl.style.display = 'none';
          itemTooltipEl.style.position = 'fixed';
          itemTooltipEl.style.zIndex = '10000';
          document.body.appendChild(itemTooltipEl);

          const ItemCtor = ItemTooltip;
          const itemTooltip = new ItemCtor({
            offsetX: tooltipConfig.offsetX,
            offsetY: tooltipConfig.offsetY,
            fadeInDelay: tooltipConfig.fadeInDelay,
            fadeOutDelay: tooltipConfig.fadeOutDelay
          });
          itemTooltip.init(itemTooltipEl);
          _itemTooltipInstance = itemTooltip;
          // expose for other scripts/tests
          window.__itemTooltipInstance = itemTooltip;

          // Annotate any existing content (featuresContainer may contain item links)
          try {
            if (typeof itemTooltip.annotateItemAnchors === 'function') {
              itemTooltip.annotateItemAnchors(document.body);
            }
          } catch (e) {
            console.warn('annotateItemAnchors failed', e);
          }
        } catch (e) {
          console.error('item tooltip init failed', e);
        }
      }).catch(err => console.error('failed loading itemTooltip script', err));
    })();
  });
