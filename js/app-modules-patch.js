/* ═══════════════════════════════════════════════
   CCTV Fleet Control — Modules Patch v7.1
   Técnico desde usuarios reales (empresa + base + rol)
═══════════════════════════════════════════════ */

(function patchMods() {

  /* ── Helper: construye options para el select de técnico ── */
  function buildTecnicoOptions(empresa, base, valorActual) {
    const tecnicos = DATA.getTecnicosPorBase(empresa, base);

    let opts = '<option value="">— Seleccionar técnico —</option>';

    if (tecnicos.length > 0) {
      opts += tecnicos.map(t => {
        const label = t.base ? `${t.nombre} (${t.base})` : t.nombre;
        const sel   = t.nombre === valorActual ? 'selected' : '';
        return `<option value="${t.nombre}" ${sel}>${label}</option>`;
      }).join('');
    }

    opts += `<option value="__otro__" ${(!tecnicos.find(t => t.nombre === valorActual) && valorActual) ? 'selected' : ''}>Otro (escribir manualmente)</option>`;

    return { opts, tecnicos };
  }

  /* ── Patch: onBaseChangeRegistro ── */
  MODS.onBaseChangeRegistro = function() {
    const base = document.getElementById('rBase')?.value;
    const emp  = DATA.state.currentEmpresa;
    const sel  = document.getElementById('rTecnicoSel');
    const inp  = document.getElementById('rTecnico');
    if (!sel) return;

    const { opts, tecnicos } = buildTecnicoOptions(emp, base, '');
    sel.innerHTML = opts;

    // Show/hide hint
    let hint = document.getElementById('rTecnicoHint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'rTecnicoHint';
      hint.style.cssText = 'font-size:10px;color:var(--text3);margin-top:4px';
      sel.parentElement.appendChild(hint);
    }
    if (!base) {
      hint.textContent = 'Selecciona una base para ver los técnicos disponibles';
    } else if (tecnicos.length === 0) {
      hint.textContent = `Sin técnicos asignados a ${base} en ${emp}. Usa "Otro" o crea usuarios técnicos.`;
      hint.style.color = 'var(--amber)';
    } else {
      hint.textContent = `${tecnicos.length} técnico(s) disponible(s) en ${base}`;
      hint.style.color = 'var(--text3)';
    }

    if (inp) inp.style.display = 'none';
  };

  /* ── Patch: onTecnicoSelChange ── */
  MODS.onTecnicoSelChange = function() {
    const sel = document.getElementById('rTecnicoSel');
    const inp = document.getElementById('rTecnico');
    if (!sel || !inp) return;
    if (sel.value === '__otro__') {
      inp.style.display = '';
      inp.placeholder = 'Escribe el nombre del técnico';
      inp.focus();
    } else {
      inp.style.display = 'none';
      inp.value = '';
    }
  };

  /* ── Patch: getRegistroTecnicoValue ── */
  MODS.getRegistroTecnicoValue = function() {
    const sel = document.getElementById('rTecnicoSel');
    const inp = document.getElementById('rTecnico');
    if (!sel) return inp ? inp.value.trim() : '';
    if (sel.value === '__otro__' || sel.value === '') return inp ? inp.value.trim() : '';
    return sel.value;
  };

  /* ── Patch selAtencion: reemplaza el campo técnico ── */
  const _origSA = MODS.selAtencion;
  MODS.selAtencion = function(id) {
    _origSA.call(MODS, id);
    setTimeout(() => patchAtencionTecnicoField(id), 40);
  };

  function patchAtencionTecnicoField(id) {
    const f = DATA.state.fallas.find(x => x.id === id);
    if (!f) return;
    const tecInput = document.getElementById('atenTecnico');
    if (!tecInput) return;

    const wrapper = tecInput.parentElement;
    if (!wrapper || wrapper.dataset.patched) return;
    wrapper.dataset.patched = '1';

    const emp         = f.empresa || DATA.state.currentEmpresa;
    const base        = f.base || '';
    const currentVal  = f.tecnico || '';
    const { opts, tecnicos } = buildTecnicoOptions(emp, base, currentVal);

    // Build select
    const sel = document.createElement('select');
    sel.id = 'atenTecnicoSel';
    sel.style.cssText = 'width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-family:var(--font);font-size:13px;padding:9px 12px;outline:none;margin-bottom:6px';
    sel.innerHTML = opts;

    // Hint
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:10px;margin-top:4px;margin-bottom:6px';
    if (base) {
      if (tecnicos.length === 0) {
        hint.style.color = 'var(--amber)';
        hint.textContent = `Sin técnicos en ${base} / ${emp}. Usa "Otro".`;
      } else {
        hint.style.color = 'var(--text3)';
        hint.textContent = `Técnicos de la base ${base} (${emp})`;
      }
    } else {
      hint.style.color = 'var(--text3)';
      hint.textContent = 'Base no especificada — muestra todos los técnicos de la empresa';
    }

    // Hide original input, keep as fallback
    tecInput.style.display = 'none';
    tecInput.id = 'atenTecnicoRaw';
    if (currentVal && !tecnicos.find(t => t.nombre === currentVal)) {
      sel.value = '__otro__';
      tecInput.style.display = '';
      tecInput.value = currentVal;
    }

    wrapper.insertBefore(hint, tecInput);
    wrapper.insertBefore(sel, hint);

    sel.addEventListener('change', () => {
      if (sel.value === '__otro__') {
        tecInput.style.display = '';
        tecInput.value = '';
        tecInput.placeholder = 'Nombre del técnico';
        tecInput.focus();
      } else {
        tecInput.style.display = 'none';
        tecInput.value = '';
      }
    });
  }

  /* ── Patch guardarAtencion ── */
  MODS.guardarAtencion = function() {
    const id = window._currentAtencion;
    if (!id) { UI.toast('Sin reporte seleccionado', 'err'); return; }

    const estatus = document.getElementById('atenEstatus')?.value;
    const tecnico = _getAtenTecnicoValue();
    const resultado = document.getElementById('atenResultado')?.value.trim();

    // Get username of the selected tecnico to store for notifications
    const f = DATA.state.fallas.find(x => x.id === id);
    const emp = f ? f.empresa : DATA.state.currentEmpresa;
    const base = f ? (f.base || '') : '';
    const tecUsers = DATA.getTecnicosPorBase(emp, base);
    const tecUser = tecUsers.find(t => t.nombre === tecnico);

    DATA.actualizarReporte(id, {
      estatus,
      tecnico,
      resultado,
      tecnicoUsername: tecUser ? tecUser.username : (f ? f.tecnicoUsername : '')
    }).then(() => {
      UI.toast('Reporte actualizado');
      UI.updateHeaderCounts();
      if (typeof APP !== 'undefined' && APP.updateNotifBadge) APP.updateNotifBadge();
      APP.showModule('atencion');
    }).catch(error => {
      UI.toast(error.message || 'No se pudo actualizar el reporte', 'err');
    });
  };

  function _getAtenTecnicoValue() {
    const sel = document.getElementById('atenTecnicoSel');
    const raw = document.getElementById('atenTecnicoRaw') || document.getElementById('atenTecnico');
    if (sel) {
      if (sel.value === '__otro__' || sel.value === '') return raw ? raw.value.trim() : '';
      return sel.value;
    }
    return raw ? raw.value.trim() : '';
  }

})();
