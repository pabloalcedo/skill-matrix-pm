/*!
 * PM Radar – Autoevaluación de Product Manager
 * Cuestionario basado en hechos. Todo se calcula en el navegador: no se envía nada a ningún servidor.
 */
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* ---------- Utilidades ---------- */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    setAttrs(node, attrs);
    appendChildren(node, children);
    return node;
  }

  function svg(tag, attrs, children) {
    var node = document.createElementNS(SVG_NS, tag);
    setAttrs(node, attrs);
    appendChildren(node, children);
    return node;
  }

  function setAttrs(node, attrs) {
    if (!attrs) return;
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') node.textContent = v;
      else if (k === 'onclick') node.addEventListener('click', v);
      else node.setAttribute(k, v === true ? '' : v);
    });
  }

  function appendChildren(node, children) {
    if (children === null || children === undefined) return;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
  }

  function round(n) { return Math.round(n); }

  function signed(n) { return (n > 0 ? '+' : '') + round(n); }

  // Brecha sin signo: el color indica si falta (rojo) o no (verde)
  function gapText(g) { return g === null ? '—' : String(Math.abs(round(g))); }
  function gapClass(g) { return g === null ? null : (g > 0 ? 'is-gap' : 'is-ok'); }

  function storageGet(key) {
    try { var raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* sin almacenamiento */ }
  }

  function storageRemove(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* sin almacenamiento */ }
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = el('textarea', { style: 'position:fixed;top:-1000px;opacity:0' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }

  function downloadFile(name, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function csvCell(v) {
    var s = v === null || v === undefined ? '' : String(v);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /* ---------- Puntuación ---------- */

  // Escala 1-5 → 0-100 (1 = 0, 2 = 25, 3 = 50, 4 = 75, 5 = 100)
  function scale5(v) { return v ? (v - 1) * 25 : null; }

  function computeResults(data, state) {
    var axes = data.ejes.map(function (eje) {
      var qs = data.preguntas.filter(function (q) { return q.eje === eje.id; });
      var sum = 0, answered = 0, na = 0, zeros = 0;
      qs.forEach(function (q) {
        var a = state.answers[q.id];
        if (a === 'na') { na++; return; }
        if (typeof a === 'number') {
          sum += a; answered++;
          if (a === 0) zeros++;
        }
      });
      var scored = answered > 0 && na <= qs.length / 2;
      var capacity = scored ? (sum / (3 * answered)) * 100 : null;
      var importance = scale5(state.importance[eje.id]);
      var perception = scale5(state.perception[eje.id]);
      return {
        eje: eje,
        questions: qs,
        capacity: capacity,
        importance: importance,
        perception: perception,
        gap: scored && importance !== null ? importance - capacity : null,
        zeros: zeros,
        na: na,
        scored: scored
      };
    });

    var scoredAxes = axes.filter(function (a) { return a.scored; });

    function byCapacity(a, b) {
      return (a.capacity - b.capacity) || (b.zeros - a.zeros);
    }

    function byGap(a, b) {
      return (b.gap - a.gap) || byCapacity(a, b);
    }

    var hasPositiveGap = scoredAxes.some(function (a) { return a.gap > 0; });
    var focus = hasPositiveGap
      ? scoredAxes.slice().sort(byGap).slice(0, 2)
      : scoredAxes.slice().sort(byCapacity).slice(0, 2);

    var focusByCapacity = scoredAxes.slice().sort(byCapacity).slice(0, 2);
    var focusByPerception = axes.filter(function (a) { return a.perception !== null; })
      .sort(function (a, b) { return a.perception - b.perception; }).slice(0, 2);

    return {
      axes: axes,
      focus: focus,
      focusMode: hasPositiveGap ? 'gap' : 'capacity',
      focusByCapacity: focusByCapacity,
      focusByPerception: focusByPerception
    };
  }

  /* ---------- Radar SVG ---------- */

  function radarChart(results) {
    var W = 480, H = 380, cx = W / 2, cy = H / 2 + 4, R = 140;
    var n = results.axes.length;

    function point(i, value) {
      var angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
      var r = (Math.max(0, Math.min(100, value || 0)) / 100) * R;
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    }

    function polygon(values) {
      return values.map(function (v, i) { return point(i, v).join(','); }).join(' ');
    }

    var root = svg('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      class: 'pmr-radar',
      role: 'img',
      'aria-label': 'Radar de capacidad e importancia por eje: ' + results.axes.map(function (a) {
        return a.eje.nombre + ' capacidad ' + (a.scored ? round(a.capacity) : 'sin puntuar') +
          ', importancia ' + (a.importance === null ? '-' : round(a.importance));
      }).join('; ')
    });

    // Rejilla
    [25, 50, 75, 100].forEach(function (level) {
      root.appendChild(svg('polygon', {
        points: polygon(results.axes.map(function () { return level; })),
        class: 'pmr-grid' + (level === 100 ? ' pmr-grid-outer' : '')
      }));
    });
    results.axes.forEach(function (a, i) {
      var p = point(i, 100);
      root.appendChild(svg('line', { x1: cx, y1: cy, x2: p[0], y2: p[1], class: 'pmr-grid' }));
    });

    // Importancia (línea discontinua) y capacidad (área)
    root.appendChild(svg('polygon', {
      points: polygon(results.axes.map(function (a) { return a.importance; })),
      class: 'pmr-imp'
    }));
    root.appendChild(svg('polygon', {
      points: polygon(results.axes.map(function (a) { return a.scored ? a.capacity : 0; })),
      class: 'pmr-cap'
    }));
    results.axes.forEach(function (a, i) {
      var p = point(i, a.scored ? a.capacity : 0);
      root.appendChild(svg('circle', { cx: p[0], cy: p[1], r: 4, class: 'pmr-cap-dot' }));
    });

    // Etiquetas
    var focusIds = results.focus.map(function (f) { return f.eje.id; });
    results.axes.forEach(function (a, i) {
      var p = point(i, 100);
      var dx = p[0] - cx, dy = p[1] - cy;
      var anchor = Math.abs(dx) < 1 ? 'middle' : (dx > 0 ? 'start' : 'end');
      var x = p[0] + (dx > 1 ? 10 : dx < -1 ? -10 : 0);
      var y = p[1] + (dy < -1 ? -30 : dy > 1 ? 24 : -6);
      var isFocus = focusIds.indexOf(a.eje.id) !== -1;
      var label = svg('text', { x: x, y: y, 'text-anchor': anchor, class: 'pmr-axis-label' + (isFocus ? ' is-focus' : '') });
      label.appendChild(svg('tspan', { x: x, dy: 0, text: a.eje.corto }));
      label.appendChild(svg('tspan', {
        x: x, dy: '1.25em', class: 'pmr-axis-value',
        text: a.scored ? String(round(a.capacity)) : 'sin puntuar'
      }));
      root.appendChild(label);
    });

    return root;
  }

  /* ---------- Componente ---------- */

  function PmRadar(container) {
    var dataNode = container.querySelector('script.pmr-data');
    if (!dataNode) return;
    try { this.data = JSON.parse(dataNode.textContent); }
    catch (e) { container.textContent = 'No se han podido cargar las preguntas.'; return; }

    this.container = container;
    this.discovery = container.getAttribute('data-discovery') === '1';
    this.storageKey = 'pmr-' + (this.data.version || '0') + '-' + window.location.pathname;
    this.view = el('div', { class: 'pmr-view' });
    container.appendChild(this.view);
    this.state = storageGet(this.storageKey) || this.freshState();
    this.render();
  }

  PmRadar.prototype.freshState = function () {
    return { step: 'intro', qIndex: 0, perception: {}, importance: {}, answers: {}, startedAt: null, finishedAt: null };
  };

  PmRadar.prototype.save = function () { storageSet(this.storageKey, this.state); };

  PmRadar.prototype.go = function (patch) {
    var self = this;
    Object.keys(patch).forEach(function (k) { self.state[k] = patch[k]; });
    this.save();
    this.render();
    var top = this.container.getBoundingClientRect().top;
    if (top < 0) this.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  PmRadar.prototype.render = function () {
    this.view.innerHTML = '';
    var step = this.state.step;
    var node =
      step === 'context' ? this.renderContext() :
      step === 'q' ? this.renderQuestion() :
      step === 'results' ? this.renderResults() :
      this.renderIntro();
    this.view.appendChild(node);
    var focusTarget = this.view.querySelector('[data-autofocus]');
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  };

  /* Intro */
  PmRadar.prototype.renderIntro = function () {
    var self = this;
    var total = this.data.preguntas.length;
    var inProgress = Object.keys(this.state.answers).length > 0;
    return el('div', { class: 'pmr-card pmr-intro' }, [
      el('p', { class: 'pmr-eyebrow', text: 'Autoevaluación · ' + total + ' preguntas · 10-12 minutos' }),
      el('h2', { class: 'pmr-title', text: this.data.titulo || 'Autoevaluación de Product Manager' }),
      el('p', { text: 'No te pregunta lo bueno que crees que eres. Te pregunta qué has hecho de verdad en los últimos meses, y con eso calcula dónde te conviene enfocarte.' }),
      el('ul', { class: 'pmr-list' }, [
        el('li', { text: 'Responde por lo que pasó, no por lo que harías.' }),
        el('li', { text: 'Si ahora no trabajas como PM, responde por tu último puesto de PM.' }),
        el('li', { text: 'Es anónimo: tus respuestas no salen de este navegador.' })
      ]),
      el('div', { class: 'pmr-actions' }, [
        el('button', {
          type: 'button', class: 'pmr-btn pmr-btn-primary', 'data-autofocus': inProgress ? null : true,
          text: inProgress ? 'Empezar de nuevo' : 'Empezar',
          onclick: function () {
            var fresh = self.freshState();
            fresh.step = 'context';
            fresh.startedAt = Date.now();
            self.state = fresh;
            self.go({});
          }
        }),
        inProgress ? el('button', {
          type: 'button', class: 'pmr-btn pmr-btn-secondary', 'data-autofocus': true, text: 'Continuar donde lo dejé',
          onclick: function () { self.go({ step: self.state.finishedAt ? 'results' : 'q' }); }
        }) : null
      ])
    ]);
  };

  /* Contexto: percepción (solo discovery) e importancia */
  PmRadar.prototype.renderContext = function () {
    var self = this;
    var st = this.state;

    function scaleRow(label, store, ejeId, lowLabel, highLabel) {
      var group = el('div', { class: 'pmr-scale', role: 'radiogroup', 'aria-label': label });
      for (var v = 1; v <= 5; v++) {
        (function (val) {
          var selected = store[ejeId] === val;
          group.appendChild(el('button', {
            type: 'button', role: 'radio', 'aria-checked': selected ? 'true' : 'false',
            class: 'pmr-scale-btn' + (selected ? ' is-selected' : ''), text: String(val),
            onclick: function () {
              store[ejeId] = val;
              self.save();
              self.render();
            }
          }));
        })(v);
      }
      return el('div', { class: 'pmr-scale-row' }, [
        el('p', { class: 'pmr-scale-label', text: label }),
        group,
        el('div', { class: 'pmr-scale-ends' }, [el('span', { text: '1 · ' + lowLabel }), el('span', { text: '5 · ' + highLabel })])
      ]);
    }

    var complete = this.data.ejes.every(function (e) {
      return st.importance[e.id] && (!self.discovery || st.perception[e.id]);
    });

    return el('div', { class: 'pmr-card' }, [
      el('p', { class: 'pmr-eyebrow', text: 'Antes de empezar' }),
      el('h2', { class: 'pmr-title', text: self.discovery ? 'Tu punto de partida' : '¿Qué pide tu puesto?' }),
      el('p', {
        text: self.discovery
          ? 'Para cada área, indica cómo te ves hoy y cuánto importa en tu puesto. Cómo te ves no cuenta en el resultado: sirve para compararlo con los hechos.'
          : 'Para cada área, indica cuánto importa en tu puesto. Sirve para priorizar dónde enfocarte.'
      }),
      el('div', { class: 'pmr-context' }, this.data.ejes.map(function (e) {
        return el('div', { class: 'pmr-context-item' }, [
          el('h3', { class: 'pmr-context-title', text: e.nombre }),
          el('p', { class: 'pmr-muted', text: e.descripcion }),
          self.discovery ? scaleRow('¿Cómo te ves hoy?', st.perception, e.id, 'muy flojo', 'muy fuerte') : null,
          scaleRow('¿Cuánto importa en tu puesto?', st.importance, e.id, 'casi nada', 'es crítico')
        ]);
      })),
      el('div', { class: 'pmr-actions' }, [
        el('button', { type: 'button', class: 'pmr-btn pmr-btn-secondary', text: 'Atrás', onclick: function () { self.go({ step: 'intro' }); } }),
        el('button', {
          type: 'button', class: 'pmr-btn pmr-btn-primary', disabled: !complete,
          text: complete ? 'Ir a las preguntas' : 'Completa todas las áreas',
          onclick: function () { if (complete) self.go({ step: 'q', qIndex: 0 }); }
        })
      ])
    ]);
  };

  /* Preguntas */
  PmRadar.prototype.renderQuestion = function () {
    var self = this;
    var qs = this.data.preguntas;
    var i = Math.min(this.state.qIndex, qs.length - 1);
    var q = qs[i];
    var eje = this.data.ejes.filter(function (e) { return e.id === q.eje; })[0];
    var current = this.state.answers[q.id];
    var locked = false;

    function choose(value) {
      if (locked) return;
      locked = true;
      self.state.answers[q.id] = value;
      self.save();
      self.render();
      setTimeout(function () {
        if (i + 1 < qs.length) self.go({ qIndex: i + 1 });
        else self.go({ step: 'results', finishedAt: Date.now() });
      }, 220);
    }

    var options = q.opciones.map(function (text, idx) {
      var selected = current === idx;
      return el('button', {
        type: 'button', role: 'radio', 'aria-checked': selected ? 'true' : 'false',
        class: 'pmr-option' + (selected ? ' is-selected' : ''),
        'data-autofocus': (current === undefined && idx === 0) || selected ? true : null,
        onclick: function () { choose(idx); }
      }, [el('span', { class: 'pmr-option-mark', 'aria-hidden': 'true' }), el('span', { text: text })]);
    });
    if (q.na) {
      var naSelected = current === 'na';
      options.push(el('button', {
        type: 'button', role: 'radio', 'aria-checked': naSelected ? 'true' : 'false',
        class: 'pmr-option pmr-option-na' + (naSelected ? ' is-selected' : ''),
        'data-autofocus': naSelected ? true : null,
        onclick: function () { choose('na'); }
      }, [el('span', { class: 'pmr-option-mark', 'aria-hidden': 'true' }), el('span', { text: 'No aplica en mi puesto' })]));
    }

    var pct = round((i / qs.length) * 100);

    return el('div', { class: 'pmr-card' }, [
      el('div', { class: 'pmr-progress-meta' }, [
        el('span', { text: eje.nombre }),
        el('span', { text: (i + 1) + ' de ' + qs.length })
      ]),
      el('div', { class: 'pmr-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) }, [
        el('div', { class: 'pmr-progress-bar', style: 'width:' + pct + '%' })
      ]),
      el('h2', { class: 'pmr-question', id: 'pmr-q-' + q.id.replace('.', '-'), text: q.texto }),
      el('div', { class: 'pmr-options', role: 'radiogroup', 'aria-labelledby': 'pmr-q-' + q.id.replace('.', '-') }, options),
      el('div', { class: 'pmr-actions' }, [
        el('button', {
          type: 'button', class: 'pmr-btn pmr-btn-secondary', text: 'Anterior',
          onclick: function () { if (i === 0) self.go({ step: 'context' }); else self.go({ qIndex: i - 1 }); }
        }),
        current !== undefined && i + 1 < qs.length ? el('button', {
          type: 'button', class: 'pmr-btn pmr-btn-ghost', text: 'Siguiente',
          onclick: function () { self.go({ qIndex: i + 1 }); }
        }) : null
      ])
    ]);
  };

  /* Resultados */
  PmRadar.prototype.renderResults = function () {
    var self = this;
    var res = computeResults(this.data, this.state);

    function answerText(q) {
      var a = self.state.answers[q.id];
      if (a === 'na') return 'No aplica';
      return typeof a === 'number' ? q.opciones[a] : 'Sin responder';
    }

    function weakestQuestions(axis) {
      return axis.questions
        .filter(function (q) { return typeof self.state.answers[q.id] === 'number' && self.state.answers[q.id] < 3; })
        .sort(function (a, b) { return self.state.answers[a.id] - self.state.answers[b.id]; })
        .slice(0, 2);
    }

    var focusCards = res.focus.map(function (axis, idx) {
      var weak = weakestQuestions(axis);
      return el('div', { class: 'pmr-focus' }, [
        el('div', { class: 'pmr-focus-head' }, [
          el('span', { class: 'pmr-focus-rank', text: String(idx + 1) }),
          el('div', {}, [
            el('h3', { class: 'pmr-focus-title', text: axis.eje.nombre }),
            el('p', { class: 'pmr-muted', text: axis.eje.descripcion })
          ])
        ]),
        el('div', { class: 'pmr-stats' }, [
          stat('Capacidad', round(axis.capacity)),
          stat('Importancia', round(axis.importance)),
          stat('Brecha', gapText(axis.gap), gapClass(axis.gap))
        ]),
        weak.length ? el('div', { class: 'pmr-weak' }, [
          el('p', { class: 'pmr-weak-title', text: 'Lo que más te resta aquí' })
        ].concat(weak.map(function (q) {
          return el('div', { class: 'pmr-weak-item' }, [
            el('p', { class: 'pmr-weak-q', text: q.texto }),
            el('p', {}, [el('span', { class: 'pmr-tag', text: 'Tu respuesta' }), ' ' + answerText(q)]),
            el('p', {}, [el('span', { class: 'pmr-tag pmr-tag-target', text: 'PM de 10' }), ' ' + q.opciones[3]]),
            q.porQue ? el('div', { class: 'pmr-advice' }, [
              el('p', { class: 'pmr-advice-label', text: 'Por qué importa' }),
              el('p', { text: q.porQue })
            ]) : null,
            q.siguientePaso && q.siguientePaso[self.state.answers[q.id]] ? el('div', { class: 'pmr-advice pmr-advice-step' }, [
              el('p', { class: 'pmr-advice-label', text: 'Tu siguiente paso' }),
              el('p', { text: q.siguientePaso[self.state.answers[q.id]] })
            ]) : null,
            q.beneficio ? el('div', { class: 'pmr-advice' }, [
              el('p', { class: 'pmr-advice-label', text: 'Qué ganas' }),
              el('p', { text: q.beneficio })
            ]) : null
          ]);
        }))) : null
      ]);
    });

    function stat(label, value, extra) {
      return el('div', { class: 'pmr-stat' + (extra ? ' ' + extra : '') }, [
        el('span', { class: 'pmr-stat-value', text: String(value) }),
        el('span', { class: 'pmr-stat-label', text: label })
      ]);
    }

    var unscored = res.axes.filter(function (a) { return !a.scored; });

    var table = el('table', { class: 'pmr-table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', { text: 'Área' }), el('th', { text: 'Capacidad' }), el('th', { text: 'Importancia' }), el('th', { text: 'Brecha' })
      ])),
      el('tbody', {}, res.axes.map(function (a) {
        return el('tr', {}, [
          el('td', { text: a.eje.nombre }),
          el('td', { text: a.scored ? String(round(a.capacity)) : '—' }),
          el('td', { text: a.importance === null ? '—' : String(round(a.importance)) }),
          el('td', { text: gapText(a.gap), class: gapClass(a.gap) })
        ]);
      }))
    ]);

    var children = [
      el('p', { class: 'pmr-eyebrow', text: 'Resultado' }),
      el('h2', { class: 'pmr-title', text: 'Tu radar de PM' }),
      el('p', { text: 'La capacidad (0-100) sale de tus respuestas. La línea discontinua es lo que importa en tu puesto. Donde la línea queda fuera del área, hay brecha.' }),
      el('div', { class: 'pmr-radar-wrap' }, radarChart(res)),
      el('div', { class: 'pmr-legend' }, [
        el('span', { class: 'pmr-legend-item' }, [el('span', { class: 'pmr-swatch pmr-swatch-cap' }), 'Capacidad']),
        el('span', { class: 'pmr-legend-item' }, [el('span', { class: 'pmr-swatch pmr-swatch-imp' }), 'Importancia en tu puesto'])
      ]),
      el('h3', { class: 'pmr-section-title', text: 'Dónde enfocarte' }),
      res.focusMode === 'capacity'
        ? el('p', { class: 'pmr-note', text: 'Ninguna área está por debajo de lo que pide tu puesto. Te mostramos las 2 con menos capacidad.' })
        : el('p', { class: 'pmr-muted', text: 'Las 2 áreas con más distancia entre lo que pide tu puesto y lo que haces hoy.' }),
      el('div', { class: 'pmr-focus-list' }, focusCards),
      unscored.length ? el('p', { class: 'pmr-note', text: 'Sin puntuar por tener demasiadas respuestas "No aplica": ' + unscored.map(function (a) { return a.eje.nombre; }).join(', ') + '.' }) : null,
      el('h3', { class: 'pmr-section-title', text: 'Todas las áreas' }),
      table,
      el('p', { class: 'pmr-gap-legend' }, [
        el('span', { class: 'pmr-dot is-gap' }), 'Brecha: tu puesto pide más de lo que haces hoy',
        el('span', { class: 'pmr-dot is-ok' }), 'Sin brecha: estás a la altura o por encima'
      ])
    ];

    if (this.discovery) children.push(this.renderShare(res));

    children.push(el('div', { class: 'pmr-actions' }, [
      el('button', { type: 'button', class: 'pmr-btn pmr-btn-secondary', text: 'Revisar respuestas', onclick: function () { self.go({ step: 'q', qIndex: 0 }); } }),
      el('button', {
        type: 'button', class: 'pmr-btn pmr-btn-ghost', text: 'Volver a empezar',
        onclick: function () { storageRemove(self.storageKey); self.state = self.freshState(); self.go({}); }
      })
    ]));

    return el('div', { class: 'pmr-card pmr-results' }, children);
  };

  /* Modo discovery: solo botones para enviar los resultados. El análisis va en la exportación, no en pantalla. */
  PmRadar.prototype.renderShare = function (res) {
    var self = this;
    var minutes = this.state.startedAt && this.state.finishedAt
      ? Math.max(1, round((this.state.finishedAt - this.state.startedAt) / 60000)) : null;
    var status = el('p', { class: 'pmr-status', role: 'status', 'aria-live': 'polite' });

    return el('div', { class: 'pmr-share' }, [
      el('p', { class: 'pmr-share-title', text: 'Envía tus resultados' }),
      el('p', { class: 'pmr-muted', text: 'Si alguien te ha pedido que hagas este cuestionario, cópialos o descárgalos y envíaselos.' }),
      el('div', { class: 'pmr-actions pmr-actions-left' }, [
        el('button', {
          type: 'button', class: 'pmr-btn pmr-btn-secondary', text: 'Copiar resultados',
          onclick: function () {
            copyText(self.summaryText(res, minutes)).then(
              function () { status.textContent = 'Copiado. Pégalo en un mensaje o email.'; },
              function () { status.textContent = 'No se ha podido copiar. Usa "Descargar CSV".'; }
            );
          }
        }),
        el('button', {
          type: 'button', class: 'pmr-btn pmr-btn-secondary', text: 'Descargar CSV',
          onclick: function () {
            var stamp = new Date().toISOString().slice(0, 10);
            downloadFile('pm-radar-' + stamp + '.csv', '\ufeff' + self.csv(res, minutes), 'text/csv;charset=utf-8');
          }
        })
      ]),
      status
    ]);
  };

  PmRadar.prototype.summaryText = function (res, minutes) {
    var self = this;
    var lines = ['PM Radar · resultados (' + new Date().toLocaleDateString('es-ES') + ')', ''];
    res.axes.forEach(function (a) {
      lines.push(a.eje.nombre + ': capacidad ' + (a.scored ? round(a.capacity) : '—') +
        ' · importancia ' + (a.importance === null ? '—' : round(a.importance)) +
        ' · brecha ' + (a.gap === null ? '—' : signed(a.gap)) +
        ' · cómo me veo ' + (a.perception === null ? '—' : round(a.perception)));
    });
    lines.push('');
    lines.push('Áreas a mejorar (brecha): ' + res.focus.map(function (a) { return a.eje.nombre; }).join(' + '));
    lines.push('Por capacidad: ' + res.focusByCapacity.map(function (a) { return a.eje.nombre; }).join(' + '));
    lines.push('Por percepción: ' + res.focusByPerception.map(function (a) { return a.eje.nombre; }).join(' + '));
    lines.push('Tiempo: ' + (minutes ? minutes + ' min' : '—'));
    lines.push('');
    lines.push('Respuestas:');
    this.data.preguntas.forEach(function (q) {
      var a = self.state.answers[q.id];
      lines.push(q.id + ' · ' + (a === 'na' ? 'NA' : (typeof a === 'number' ? a + ' pts · ' + q.opciones[a] : '—')));
    });
    return lines.join('\n');
  };

  PmRadar.prototype.csv = function (res, minutes) {
    var self = this;
    var header = ['fecha', 'tiempo_min'];
    var row = [new Date().toISOString(), minutes || ''];
    res.axes.forEach(function (a) {
      var id = a.eje.id;
      header.push(id + '_percepcion', id + '_importancia', id + '_capacidad', id + '_brecha');
      row.push(
        a.perception === null ? '' : round(a.perception),
        a.importance === null ? '' : round(a.importance),
        a.scored ? round(a.capacity) : '',
        a.gap === null ? '' : round(a.gap)
      );
    });
    function ids(list) { return list.map(function (a) { return a.eje.id; }).join('+'); }
    header.push('foco_brecha', 'foco_capacidad', 'foco_percepcion');
    row.push(ids(res.focus), ids(res.focusByCapacity), ids(res.focusByPerception));
    this.data.preguntas.forEach(function (q) {
      header.push('p' + q.id);
      var a = self.state.answers[q.id];
      row.push(a === undefined ? '' : a);
    });
    return header.map(csvCell).join(',') + '\n' + row.map(csvCell).join(',') + '\n';
  };

  /* ---------- Arranque ---------- */

  function init() {
    var nodes = document.querySelectorAll('.pmr:not([data-pmr-ready])');
    Array.prototype.forEach.call(nodes, function (node) {
      node.setAttribute('data-pmr-ready', '1');
      new PmRadar(node);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
