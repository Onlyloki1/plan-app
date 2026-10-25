/* Motor de apps — una sola app que se arma con un archivo de contenido (contenido.json).
   Sin login: los datos quedan guardados en el celular (igual que las apps de Lovable del curso).
   Pantallas: bienvenida → preguntas → "tu plan está listo" → Hoy / Plan / Extras / Progreso / Ajustes. */
(() => {
  const $app = document.getElementById('app');
  const $menu = document.getElementById('menu');
  let C = null;            // contenido del producto
  let S = null;            // estado guardado del usuario
  let CLAVE = 'motor_app';

  // ---------- guardado (en el celular) ----------
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(S)); } catch (e) {} };
  const cargarEstado = () => {
    try { return JSON.parse(localStorage.getItem(CLAVE)) || null; } catch (e) { return null; }
  };
  const nuevoEstado = () => ({ respuestas: {}, inicio: null, hechos: {}, checklist: {}, pesos: [], fotos: [],
                               desbloqueados: [], letraGrande: false, pasoPreg: 0 });

  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hoyISO = () => new Date().toISOString().slice(0, 10);
  const diasEntre = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);
  const N = () => C.plan.length;
  const diaActual = () => S.inicio ? Math.min(N(), diasEntre(S.inicio, hoyISO()) + 1) : 1;
  const diasHechos = () => Object.keys(S.hechos).filter(d => S.hechos[d]).length;
  const nombre = () => (S.respuestas.nombre || '').trim();
  const r = s => s.replace(/\{nombre\}/g, nombre() || '').replace(/\{dias\}/g, N()).replace(/\s+,/g, ',');

  // ---------- arranque ----------
  async function iniciar() {
    const prod = new URLSearchParams(location.search).get('p') || 'contenido';
    C = await fetch(prod.replace(/[^\w-]/g, '') + '.json', { cache: 'no-cache' }).then(x => x.json());
    CLAVE = 'motor_app_' + (C.id || prod);
    S = cargarEstado() || nuevoEstado();
    document.title = C.marca.nombre;
    const raiz = document.documentElement.style;
    Object.entries(C.marca.colores || {}).forEach(([k, v]) => raiz.setProperty('--' + k, v));
    document.querySelector('meta[name=theme-color]').content = (C.marca.colores || {}).pri || '#1f7a5c';
    document.documentElement.classList.toggle('grande', !!S.letraGrande);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    window.addEventListener('hashchange', ruta);
    ruta();
  }

  function ruta() {
    const partes = (location.hash.replace(/^#\/?/, '') || '').split('/');
    const [pag, arg] = partes;
    if (pag === 'desbloquear') return desbloquear(arg);
    const listo = !!S.inicio;
    if (!listo && !['', 'preguntas', 'resultado'].includes(pag)) { location.hash = ''; return; }
    if (listo && (pag === '' || pag === undefined)) { location.hash = '#/hoy'; return; }
    $menu.hidden = !listo || pag === 'dia';
    document.querySelectorAll('#menu a').forEach(a => a.classList.toggle('activo', a.dataset.r === pag));
    window.scrollTo(0, 0);
    ({ '': bienvenida, preguntas, resultado, hoy, plan, dia, biblioteca, modulo, progreso, ajustes }[pag] || hoy)(arg);
  }

  // ---------- 1. bienvenida ----------
  function bienvenida() {
    const V = C.ventajas || [['⏱️', 'Pocos minutos'], ['🏠', 'En tu casa'], ['🙌', 'A tu ritmo']];
    $app.innerHTML = `
      <div class="hero">
        <div class="logo-grande">${esc(C.marca.logo)}</div>
        <div class="marca">${esc(C.marca.nombre)}</div>
        <p>${esc(C.marca.subtitulo)}</p>
      </div>
      <div class="ventajas">${V.map(([e, t]) => `<div><span>${esc(e)}</span>${esc(t)}</div>`).join('')}</div>
      <button class="btn" id="go">Empezar mi plan</button>
      ${C.prueba_social ? `<div class="prueba"><span>💚</span><span>${esc(C.prueba_social)}</span></div>` : ''}
      <p class="mut centro" style="font-size:.85rem;margin-top:14px">Te hacemos unas preguntas rápidas para armar tu plan.</p>`;
    $app.querySelector('#go').onclick = () => { S.pasoPreg = 0; guardar(); location.hash = '#/preguntas'; };
  }

  // ---------- 2. preguntas (onboarding) ----------
  function preguntas() {
    const P = C.preguntas, i = Math.min(S.pasoPreg || 0, P.length - 1), q = P[i];
    const val = S.respuestas[q.id];
    let cuerpo = '';
    if (q.tipo === 'opciones' || q.tipo === 'multiple') {
      cuerpo = q.opciones.map((o, k) => {
        const el = q.tipo === 'multiple' ? (val || []).includes(o.valor) : val === o.valor;
        return `<button class="opcion ${el ? 'elegida' : ''}" data-v="${esc(o.valor)}"><span class="emo">${esc(o.emoji || '•')}</span>${esc(o.texto)}</button>`;
      }).join('');
    } else if (q.tipo === 'numero') {
      const v = val ?? q.defecto;
      cuerpo = `<div class="numero-grande"><span id="nv">${v}</span> <small>${esc(q.unidad || '')}</small></div>
        <input type="range" id="rng" min="${q.min}" max="${q.max}" step="${q.paso || 1}" value="${v}">
        <div class="fila mut" style="font-size:.85rem"><span>${q.min}</span><span style="text-align:right">${q.max}</span></div>`;
    } else if (q.tipo === 'texto') {
      cuerpo = `<input type="text" id="txt" placeholder="${esc(q.placeholder || '')}" value="${esc(val || '')}" autocomplete="given-name">`;
    }
    $app.innerHTML = `
      <div class="fila" style="align-items:center">
        <button class="atras" id="atras" aria-label="Volver" ${i === 0 ? 'disabled' : ''}>←</button>
        <div><div class="barra"><div style="width:${Math.round(100 * (i + 1) / P.length)}%"></div></div>
        <div class="mut" style="font-size:.8rem">Paso ${i + 1} de ${P.length}</div></div>
      </div>
      <h1>${esc(r(q.titulo))}</h1>${q.ayuda ? `<p class="mut">${esc(q.ayuda)}</p>` : ''}
      <div>${cuerpo}</div>
      <button class="btn" id="sig">${i === P.length - 1 ? 'Ver mi plan' : 'Continuar'}</button>`;
    const sig = $app.querySelector('#sig');
    const valido = () => {
      const v = S.respuestas[q.id];
      sig.disabled = q.opcional ? false : (q.tipo === 'multiple' ? !(v && v.length) : (v === undefined || v === ''));
    };
    $app.querySelectorAll('.opcion').forEach(b => b.onclick = () => {
      const v = b.dataset.v;
      if (q.tipo === 'multiple') {
        const arr = new Set(S.respuestas[q.id] || []);
        arr.has(v) ? arr.delete(v) : arr.add(v); S.respuestas[q.id] = [...arr];
        b.classList.toggle('elegida');
      } else {
        S.respuestas[q.id] = v;
        $app.querySelectorAll('.opcion').forEach(x => x.classList.toggle('elegida', x === b));
      }
      guardar(); valido();
      if (q.tipo === 'opciones') setTimeout(() => sig.click(), 250);   // un toque y avanza (menos pasos)
    });
    const rng = $app.querySelector('#rng');
    if (rng) { if (S.respuestas[q.id] === undefined) S.respuestas[q.id] = Number(q.defecto);
      rng.oninput = () => { S.respuestas[q.id] = Number(rng.value); $app.querySelector('#nv').textContent = rng.value; guardar(); }; }
    const txt = $app.querySelector('#txt');
    if (txt) txt.oninput = () => { S.respuestas[q.id] = txt.value; guardar(); valido(); };
    valido();
    sig.onclick = () => {
      if (sig.disabled) return;
      if (i < P.length - 1) { S.pasoPreg = i + 1; guardar(); preguntas(); window.scrollTo(0, 0); }
      else { location.hash = '#/resultado'; }
    };
    $app.querySelector('#atras').onclick = () => { S.pasoPreg = Math.max(0, i - 1); guardar(); preguntas(); };
  }

  // ---------- 3. "tu plan está listo" ----------
  function resultado() {
    $app.innerHTML = `<div class="splash"><div class="logo-grande">${esc(C.marca.logo)}</div>
      <h1>${esc(r(C.resultado.cargando))}</h1><div class="barra" style="width:80%"><div id="bc" style="width:5%"></div></div></div>`;
    let p = 5; const t = setInterval(() => { p += 19; const b = document.getElementById('bc'); if (b) b.style.width = Math.min(p, 100) + '%';
      if (p >= 100) { clearInterval(t); mostrar(); } }, 450);
    function mostrar() {
      const R = C.resultado;
      $app.innerHTML = `
        <div class="cabecera"><div style="font-size:2.4rem">🎉</div>
          <h1 style="color:#fff">${esc(r(R.titulo))}</h1><p class="mut">${esc(r(R.subtitulo))}</p></div>
        <div class="tarjeta"><h2 style="margin-top:0">Hoy vs. en ${N()} días</h2>
          ${R.comparacion.map(c => `<p><b>${esc(c.texto)}</b></p>
            <div class="fila mut" style="font-size:.8rem"><span>Hoy</span><span style="text-align:right">Día ${N()}</span></div>
            <div class="barra"><div style="width:${c.hoy}%;background:#d9a441"></div></div>
            <div class="barra"><div style="width:${c.despues}%"></div></div>`).join('')}
        </div>
        <div class="tarjeta"><h2 style="margin-top:0">Así va a ser tu plan</h2>
          ${R.puntos.map(x => `<p>✅ ${esc(r(x))}</p>`).join('')}</div>
        <button class="btn" id="go">${esc(R.boton)}</button>`;
      $app.querySelector('#go').onclick = () => { S.inicio = hoyISO(); guardar(); location.hash = '#/hoy'; };
    }
  }

  // ---------- 4. Hoy ----------
  function hoy() {
    const d = diaActual(), info = C.plan[d - 1], hecho = !!S.hechos[d];
    const pct = Math.round(100 * diasHechos() / N());
    const ck = S.checklist[d] || {};
    const frase = C.frases[(d - 1) % C.frases.length];
    $app.innerHTML = `
      <div class="cabecera">
        <div class="fila" style="align-items:center">
          <div><p class="mut" style="margin:0">${saludo()}${nombre() ? ', ' + esc(nombre()) : ''} 👋</p>
            <h1 style="color:#fff;margin:.2em 0">Día ${d} de ${N()}</h1>
            <p class="mut" style="margin:0">${diasHechos() === 1 ? '1 día completado' : diasHechos() + ' días completados'}</p></div>
          <div style="flex:0 0 120px"><div class="anillo" style="--p:${pct}%"><span style="color:var(--pri)">${pct}%</span></div></div>
        </div>
      </div>
      <div class="tarjeta">
        <span class="etiqueta">TU RUTINA DE HOY</span>
        <h2 style="margin:.5em 0 .2em">${esc(info.titulo)}</h2>
        <p class="mut">⏱️ ${info.minutos} minutos · ${info.ejercicios.length} ejercicios</p>
        <a class="btn ${hecho ? 'sec' : ''}" href="#/dia/${d}">${hecho ? '✔ Hecho · Repetir' : '▶ Empezar rutina'}</a>
      </div>
      <div class="tarjeta"><h2 style="margin-top:0">Tu lista de hoy</h2>
        ${C.checklist.map((t, k) => `<div class="check ${ck[k] ? 'ok' : ''}" data-k="${k}"><div class="caja">${ck[k] ? '✓' : ''}</div><span class="t">${esc(t)}</span></div>`).join('')}
      </div>
      <div class="tarjeta" style="background:#fff6df;border-color:#f1d58c"><p style="margin:0">💬 <i>${esc(frase)}</i></p></div>
      ${ofertaDestacada()}`;
    $app.querySelectorAll('.check').forEach(el => el.onclick = () => {
      const k = el.dataset.k; S.checklist[d] = S.checklist[d] || {}; S.checklist[d][k] = !S.checklist[d][k]; guardar(); hoy();
    });
  }
  const saludo = () => { const h = new Date().getHours(); return h < 12 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches'; };

  // ---------- 5. rutina del día (con temporizador) ----------
  let reloj = null;
  function dia(nStr) {
    clearInterval(reloj);
    const d = Math.max(1, Math.min(N(), Number(nStr) || diaActual()));
    if (d > diaActual()) { location.hash = '#/plan'; return; }
    const info = C.plan[d - 1];
    const lista = info.ejercicios.map(id => C.ejercicios[id]).filter(Boolean);
    let i = -1;
    pantallaIntro();
    function pantallaIntro() {
      $app.innerHTML = `<a href="#/hoy" class="btn sec" style="width:auto;display:inline-block;padding:10px 18px;min-height:0">← Volver</a>
        <h1>Día ${d}: ${esc(info.titulo)}</h1><p class="mut">⏱️ ${info.minutos} minutos. Solo necesitás ${esc(C.necesitas)}.</p>
        ${info.consejo ? `<div class="aviso">💡 ${esc(info.consejo)}</div>` : ''}
        ${lista.map((e, k) => `<div class="tarjeta ejercicio"><div class="emo">${esc(e.emoji)}</div>
          <div><b>${k + 1}. ${esc(e.nombre)}</b><p class="mut" style="margin:.2em 0">${e.segundos} segundos${e.repes ? ' · ' + esc(e.repes) : ''}</p></div></div>`).join('')}
        <button class="btn" id="go">▶ Empezar</button>
        ${C.aviso_salud ? `<p class="mut" style="font-size:.8rem">${esc(C.aviso_salud)}</p>` : ''}`;
      $app.querySelector('#go').onclick = () => { i = 0; pantallaEjercicio(); };
    }
    function pantallaEjercicio() {
      clearInterval(reloj);
      if (i >= lista.length) return terminar();
      const e = lista[i]; let quedan = e.segundos, pausa = false;
      $app.innerHTML = `<div class="fila" style="align-items:center"><div class="barra"><div style="width:${Math.round(100 * i / lista.length)}%"></div></div>
          <span class="mut" style="flex:0 0 auto">${i + 1}/${lista.length}</span></div>
        <div class="centro"><div style="font-size:4.5rem">${esc(e.emoji)}</div><h1>${esc(e.nombre)}</h1></div>
        <div class="tiempo" id="t">${fmt(quedan)}</div>
        <div class="tarjeta"><ol style="margin:0;padding-left:1.2em">${e.pasos.map(p => `<li style="margin:.3em 0">${esc(p)}</li>`).join('')}</ol>
          ${e.ojo ? `<p class="mut" style="margin-top:.6em">⚠️ ${esc(e.ojo)}</p>` : ''}</div>
        <div class="fila"><button class="btn sec" id="pausa">⏸ Pausa</button><button class="btn" id="sig">Siguiente ▶</button></div>`;
      const $t = $app.querySelector('#t');
      reloj = setInterval(() => { if (pausa) return; quedan--; $t.textContent = fmt(Math.max(0, quedan));
        if (quedan <= 0) { clearInterval(reloj); vibrar(); i++; setTimeout(pantallaEjercicio, 600); } }, 1000);
      $app.querySelector('#pausa').onclick = ev => { pausa = !pausa; ev.target.textContent = pausa ? '▶ Seguir' : '⏸ Pausa'; };
      $app.querySelector('#sig').onclick = () => { i++; pantallaEjercicio(); };
    }
    function terminar() {
      clearInterval(reloj);
      S.hechos[d] = true; guardar();
      $app.innerHTML = `<div class="splash" style="min-height:auto;padding:36px 0 6px"><div class="logo-grande">🏆</div><h1>¡Día ${d} completado!</h1>
        <p class="mut">${esc(C.felicitaciones[(d - 1) % C.felicitaciones.length])}</p>
        <p><b>${diasHechos()} de ${N()}</b> días hechos</p>
        <a class="btn" href="#/hoy">Volver al inicio</a></div>
        ${ofertaDestacada('¿Querés ir más rápido?')}`;
    }
  }
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const vibrar = () => { try { navigator.vibrate && navigator.vibrate(200); } catch (e) {} };

  // ---------- 6. Plan (calendario de N días) ----------
  function plan() {
    const da = diaActual();
    const semanas = [];
    C.plan.forEach((p, k) => { const s = Math.floor(k / 7); (semanas[s] = semanas[s] || []).push([k + 1, p]); });
    $app.innerHTML = `<h1>Tu plan de ${N()} días</h1>
      <div class="barra"><div style="width:${Math.round(100 * diasHechos() / N())}%"></div></div>
      <p class="mut">${diasHechos()} de ${N()} días completados</p>
      ${semanas.map((sem, s) => `<h2>Semana ${s + 1}${C.semanas && C.semanas[s] ? ' · ' + esc(C.semanas[s]) : ''}</h2>
        ${sem.map(([n, p]) => {
          const bloq = n > da, hecho = S.hechos[n];
          return `<a class="tarjeta ejercicio" style="text-decoration:none;color:inherit;display:flex;${bloq ? 'opacity:.45' : ''}" href="${bloq ? 'javascript:void 0' : '#/dia/' + n}">
            <div class="dia ${hecho ? 'hecho' : ''} ${n === da ? 'hoy' : ''}" style="width:54px;height:54px"><small>Día</small>${n}</div>
            <div><b>${esc(p.titulo)}</b><p class="mut" style="margin:.2em 0">${bloq ? '🔒 Se habilita el día ' + n : hecho ? '✔ Hecho' : '⏱️ ' + p.minutos + ' min'}</p></div></a>`;
        }).join('')}`).join('')}`;
  }

  // ---------- 7. Extras: módulos incluidos + upsells ----------
  function ofertaDestacada(titulo) {
    // rota entre los upsells que todavía no compró (uno distinto según el día)
    const pendientes = (C.upsells || []).filter(x => !S.desbloqueados.includes(x.id));
    if (!pendientes.length) return '';
    const u = pendientes[(diaActual() - 1) % pendientes.length];
    return `<div class="tarjeta premium"><span class="etiqueta">⭐ ${esc(titulo || 'RECOMENDADO PARA VOS')}</span>
      <h2 style="margin:.5em 0 .2em">${esc(u.titulo)}</h2><p class="mut">${esc(u.gancho)}</p>
      <a class="btn dorado" href="#/modulo/${u.id}">Ver más</a></div>`;
  }
  function biblioteca() {
    $app.innerHTML = `<h1>Tus extras</h1><p class="mut">Todo lo que viene con tu plan.</p>
      ${C.modulos.map(m => `<a class="tarjeta ejercicio" style="display:flex;text-decoration:none;color:inherit" href="#/modulo/${m.id}">
        <div class="emo">${esc(m.emoji)}</div><div><b>${esc(m.titulo)}</b><p class="mut" style="margin:.2em 0">${esc(m.descripcion)}</p>
        ${m.bonus ? '<span class="etiqueta">BONUS</span>' : ''}</div></a>`).join('')}
      ${(C.upsells || []).length ? `<h2>⭐ Para ir más rápido</h2>` : ''}
      ${(C.upsells || []).map(u => { const ok = S.desbloqueados.includes(u.id);
        return `<a class="tarjeta ejercicio ${ok ? '' : 'premium'}" style="display:flex;text-decoration:none;color:inherit" href="#/modulo/${u.id}">
          <div class="emo">${ok ? esc(u.emoji) : '<span class="candado">🔒</span>'}</div>
          <div><b>${esc(u.titulo)}</b><p class="mut" style="margin:.2em 0">${esc(u.gancho)}</p>
          ${ok ? '<span class="etiqueta" style="background:var(--ok);color:#fff">DESBLOQUEADO</span>' : `<span class="etiqueta">${esc(u.precio)}</span>`}</div></a>`; }).join('')}`;
  }
  function modulo(id) {
    const m = C.modulos.find(x => x.id === id), u = (C.upsells || []).find(x => x.id === id);
    const item = m || u;
    if (!item) { location.hash = '#/biblioteca'; return; }
    const bloqueado = u && !S.desbloqueados.includes(u.id);
    let html = `<a href="#/biblioteca" class="btn sec" style="width:auto;display:inline-block;padding:10px 18px;min-height:0">← Volver</a>
      <div class="centro" style="font-size:3.5rem;margin-top:10px">${esc(item.emoji)}</div><h1 class="centro">${esc(item.titulo)}</h1>`;
    if (bloqueado) {
      const boton = `<p class="centro" style="font-size:1.6rem;font-weight:800;margin:.4em 0 0">${esc(u.precio)}</p>
        <a class="btn dorado" href="${esc(u.link_pago)}" target="_blank" rel="noopener">🔓 Quiero desbloquearlo</a>`;
      html += `<p class="centro mut" style="margin-top:-6px">${esc(u.gancho)}</p>
        ${boton}
        <div class="tarjeta premium"><p>${esc(u.descripcion)}</p>
        ${u.incluye.map(x => `<p>✅ ${esc(x)}</p>`).join('')}</div>
        ${boton}
        <p class="mut centro" style="font-size:.85rem">Pago único. Después de pagar te llega un mail con el botón para abrirlo acá.</p>`;
    } else {
      html += (item.secciones || []).map(s => `<div class="tarjeta"><h2 style="margin-top:0">${esc(s.titulo)}</h2>
        ${(s.items || []).map(x => `<p>${esc(x)}</p>`).join('')}</div>`).join('');
    }
    $app.innerHTML = html;
  }
  function desbloquear(codigo) {
    const u = (C.upsells || []).find(x => x.codigo === codigo);
    if (u && !S.desbloqueados.includes(u.id)) { S.desbloqueados.push(u.id); guardar(); }
    if (!S.inicio) { S.inicio = hoyISO(); guardar(); }
    location.hash = u ? '#/modulo/' + u.id : '#/hoy';
  }

  // ---------- 8. Progreso ----------
  function progreso() {
    const ps = S.pesos.slice(-8);
    const max = Math.max(...ps.map(p => p.valor), 1), min = Math.min(...ps.map(p => p.valor), max);
    $app.innerHTML = `<h1>Tu progreso</h1>
      <div class="tarjeta centro"><div class="anillo" style="--p:${Math.round(100 * diasHechos() / N())}%"><span style="color:var(--pri)">${diasHechos()}/${N()}</span></div>
        <p class="mut">días completados</p></div>
      <div class="tarjeta"><h2 style="margin-top:0">⚖️ Mi peso</h2>
        <div class="fila"><input type="number" id="peso" inputmode="decimal" placeholder="Ej: 72,5"><button class="btn" id="gp" style="margin:0;flex:0 0 120px">Guardar</button></div>
        ${ps.length ? `<div style="display:flex;align-items:flex-end;gap:8px;height:140px;margin-top:14px">${ps.map(p => {
          const h = max === min ? 60 : 20 + 100 * (p.valor - min) / (max - min);
          return `<div style="flex:1;text-align:center;font-size:.7rem"><div style="height:${h}px;background:var(--pri2);border-radius:8px 8px 0 0"></div>${p.valor}<br><span class="mut">${p.fecha.slice(5)}</span></div>`; }).join('')}</div>`
          : '<p class="mut">Anotá tu peso una vez por semana para ver cómo cambia.</p>'}
      </div>
      <div class="tarjeta"><h2 style="margin-top:0">📸 Fotos de antes y ahora</h2>
        <p class="mut">Quedan guardadas solo en tu celular.</p>
        <label class="btn sec" style="margin:0">Agregar foto<input type="file" id="foto" accept="image/*" hidden></label>
        <div class="fila" style="flex-wrap:wrap">${S.fotos.slice(-4).map(f => `<div style="flex:0 0 48%"><img class="foto" src="${f.img}"><p class="mut centro" style="font-size:.8rem">${f.fecha}</p></div>`).join('')}</div>
      </div>`;
    $app.querySelector('#gp').onclick = () => {
      const v = parseFloat(String($app.querySelector('#peso').value).replace(',', '.'));
      if (!v) return; S.pesos.push({ fecha: hoyISO(), valor: v }); guardar(); progreso();
    };
    $app.querySelector('#foto').onchange = ev => {
      const f = ev.target.files[0]; if (!f) return;
      const img = new Image(), rd = new FileReader();
      rd.onload = () => { img.onload = () => {   // se achica para que entre en el celular
        const cv = document.createElement('canvas'), k = Math.min(1, 600 / img.width);
        cv.width = img.width * k; cv.height = img.height * k; cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        S.fotos.push({ fecha: hoyISO(), img: cv.toDataURL('image/jpeg', .7) }); guardar(); progreso(); }; img.src = rd.result; };
      rd.readAsDataURL(f);
    };
  }

  // ---------- 9. Ajustes ----------
  function ajustes() {
    $app.innerHTML = `<h1>Ajustes</h1>
      <div class="tarjeta"><h2 style="margin-top:0">🔠 Tamaño de letra</h2>
        <button class="btn ${S.letraGrande ? '' : 'sec'}" id="lg">${S.letraGrande ? 'Letra grande: SÍ' : 'Poner letra más grande'}</button></div>
      <div class="tarjeta"><h2 style="margin-top:0">📲 Tenerla en el celular</h2>
        <p><b>iPhone:</b> tocá <b>Compartir</b> (el cuadrado con la flecha) y después <b>"Agregar a inicio"</b>.</p>
        <p><b>Android:</b> tocá los <b>3 puntitos</b> arriba a la derecha y después <b>"Instalar app"</b> o <b>"Agregar a pantalla principal"</b>.</p></div>
      <div class="tarjeta"><h2 style="margin-top:0">🆘 ¿Necesitás ayuda?</h2>
        <p>Escribinos a <b>${esc(C.soporte)}</b></p></div>
      <div class="tarjeta"><button class="btn sec" id="reset">Empezar el plan de nuevo</button></div>`;
    $app.querySelector('#lg').onclick = () => { S.letraGrande = !S.letraGrande; guardar();
      document.documentElement.classList.toggle('grande', S.letraGrande); ajustes(); };
    $app.querySelector('#reset').onclick = () => { if (confirm('¿Seguro? Se borra tu avance.')) {
      const des = S.desbloqueados; S = nuevoEstado(); S.desbloqueados = des; guardar(); location.hash = ''; } };
  }

  iniciar().catch(e => { $app.innerHTML = `<div class="splash"><p>No se pudo cargar la app. Revisá tu conexión y volvé a abrir.</p><p class="mut">${esc(e.message)}</p></div>`; });
})();
