/* Lobby Lockout — original artwork and puzzle, no runtime dependencies. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const STORAGE = 'lobby-lockout-floor27-v2';
  let state = Puzzle.fresh();
  let selected = null, view = 'room', returnView = 'room', toastTimer, audio;
  let sound = true, hintLevel = 0, arrival = [], modalPreviousFocus;
  try { state = Puzzle.restore(JSON.parse(localStorage.getItem(STORAGE))); sound = localStorage.getItem(STORAGE + '-sound') !== 'off'; } catch (_) {}
  const save = () => { try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch (_) {} };
  const sprite = type => `<span class="sprite ${type}" aria-hidden="true"></span>`;
  const cardPrint = '<div class="cardPrint"><small>STAFF · SERVICE ROUTE</small><b>○ △ □</b><em>READ LEFT TO RIGHT</em></div>';
  function resize() {
    const w = window.visualViewport?.width || innerWidth;
    const h = window.visualViewport?.height || innerHeight;
    const scale = Math.min(w / 480, h / 720, 1.5);
    $('stage').style.transform = `translate(-50%,-50%) scale(${scale})`;
  }
  resize(); addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize);
  function tone(freq, duration = .08, type = 'sine', delay = 0, gain = .055) {
    if (!sound) return;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const osc = audio.createOscillator(), volume = audio.createGain();
      const t = audio.currentTime + delay;
      osc.type = type; osc.frequency.setValueAtTime(freq, t);
      volume.gain.setValueAtTime(.001, t); volume.gain.exponentialRampToValueAtTime(gain, t + .008);
      volume.gain.exponentialRampToValueAtTime(.001, t + duration);
      osc.connect(volume); volume.connect(audio.destination); osc.start(t); osc.stop(t + duration + .01);
    } catch (_) {}
  }
  function effect(kind) {
    if (kind === 'deny') { tone(130, .13, 'triangle'); tone(105, .15, 'triangle', .13); }
    else if (['power','scan','pickup'].includes(kind)) { tone(660,.09); tone(990,.15,'sine',.10); }
    else if (kind === 'unlock' || kind === 'win') { tone(523,.22); tone(659,.22,'sine',.18); tone(784,.4,'sine',.36); }
    else if (kind === 'screw') { tone(180,.06,'triangle'); tone(230,.08,'triangle',.07); }
    else if (kind === 'slide') tone(110,.18,'triangle',0,.025);
    else tone(520,.035,'sine',0,.022);
    if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive) && ['power','pickup','unlock'].includes(kind)) navigator.vibrate(25);
  }
  function toast(text, ms = 3100) {
    clearTimeout(toastTimer);
    $('toast').textContent = text;
    $('toast').classList.toggle('show', !!text);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), ms);
  }
  function run(action, value) {
    const before = state;
    const result = Puzzle.act(state, action, value);
    state = result.state; save(); effect(result.effect);
    if (result.message) toast(result.message);
    if (!state.coin && selected === 'coin') selected = null;
    render();
    if (!before.hatch && state.hatch) show('circuit');
    if (!before.unlocked && state.unlocked) arrive();
    if (!before.complete && state.complete) win();
    return result;
  }
  function show(next) {
    view = next;
    for (const id of ['room','panel','inspection']) $(id).hidden = id !== next;
    if (['directory','card','circuit'].includes(next)) {
      $('inspection').hidden = false;
      renderInspection();
    }
    $('back').hidden = next === 'room';
    $('back').setAttribute('aria-label', next === 'panel' || next === 'directory' ? 'Return to the lobby' : 'Return to the keypad');
    $('toast').classList.remove('show');
    render();
  }
  function goBack() {
    if (view === 'card') show(returnView);
    else if (view === 'circuit') show('panel');
    else show('room');
    effect('tap');
  }
  function selectItem(type) {
    if (type === 'card' && selected === type) { returnView = view; show('card'); return; }
    selected = selected === type ? null : type;
    render(); effect('tap');
    if (selected === 'coin') toast('Brass token selected.');
    if (selected === 'card') toast('Staff card selected. Tap it again to inspect.');
  }
  function render() {
    $('mat').classList.toggle('moved', state.mat);
    $('coin').hidden = !(state.mat && !state.coin && !state.hatch);
    if (!arrival.length) $('doors').classList.toggle('open', state.unlocked);
    $('doors').disabled = state.unlocked;
    if (state.unlocked && !arrival.length) { $('display').textContent = '27'; $('enter').hidden = false; }
    else if (!state.unlocked) { $('display').textContent = '31'; $('enter').hidden = true; }
    $('readerLight').classList.toggle('on',state.power);
    $('panelLight').classList.toggle('on',state.power);
    $('maintenance').hidden = !state.hatch;
    for(let i = 0; i < 2; i++) {
      $('screw'+i).classList.toggle('loose',state.screws[i]);
      $('screw'+i).hidden = state.hatch;
    }
    if (state.unlocked) $('screen').innerHTML = '<small>ACCESS GRANTED</small><span class="granted">Go to elevator C ↑</span>';
    else if (state.scanned) $('screen').innerHTML = `<small>ENTER SERVICE ROUTE</small><span class="code">${state.code.padEnd(6,'_')}</span>`;
    else $('screen').innerHTML = '<small>PRESENT YOUR ACCESS CARD</small><svg class="screenKey" viewBox="0 0 120 44" aria-hidden="true"><defs><linearGradient id="keyMetal" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".5" stop-color="#d8e0e6"/><stop offset="1" stop-color="#9faab4"/></linearGradient></defs><path d="M12 6h29l9 10h54l10 8-7 7-7-5-7 6-7-5-6 6-8-6H49L39 38H12L5 30V14Z" fill="url(#keyMetal)" stroke="#687986" stroke-width="1.7"/><path d="M15 13h9v17h-9Z" fill="#a9bac9" stroke="#fff"/><path d="M33 9v25M52 19h51" fill="none" stroke="#fff" stroke-width="1.5"/></svg>';
    const items = [state.coin ? 'coin' : null, state.card ? 'card' : null, null, null];
    for(let i = 0; i < 4; i++) {
      const el = $('slot'+i), item = items[i];
      el.innerHTML = item ? sprite(item) : '';
      el.classList.toggle('selected',!!item && item === selected);
      el.setAttribute('aria-label',item ? (item === 'coin' ? 'Brass token' : 'Staff access card') + (selected === item ? ', selected' : '') : `Empty inventory slot ${i+1}`);
      el.setAttribute('aria-pressed', String(!!item && item === selected));
      el.dataset.item = item || '';
    }
    if (view === 'circuit') renderCircuit();
  }
  function trace(mask) {
    const ends = [[50,0],[100,50],[50,100],[0,50]];
    return ends.filter((_,d) => mask & (1<<d)).map(([x,y]) => `M50 50 L${x} ${y}`).join(' ');
  }
  function renderCircuit() {
    const flow = Puzzle.circuit(state.rotations);
    $('tiles').innerHTML = flow.masks.map((m,i) => `<button class="tile ${flow.live.includes(i)?'live':''}" data-tile="${i}" aria-label="Rotate circuit tile, row ${Math.floor(i/3)+1}, column ${i%3+1}${flow.live.includes(i)?', powered':''}" ${state.power?'disabled':''}><svg viewBox="0 0 100 100" aria-hidden="true"><path d="${trace(m)}" fill="none" stroke="#071b10" stroke-width="17"/><path d="${trace(m)}" fill="none" stroke="${flow.live.includes(i)?'#f1c96a':'#9a814e'}" stroke-width="10"/><path d="${trace(m)}" fill="none" stroke="${flow.live.includes(i)?'#fff0a0':'#c1a46a'}" stroke-width="2"/><circle cx="50" cy="50" r="12" fill="#6c7452" stroke="#c1b18a" stroke-width="3"/><circle cx="50" cy="50" r="5" fill="#263a25"/></svg></button>`).join('');
    $('output').classList.toggle('on',state.power);
    $('circuitNote').innerHTML = `<span class="led ${state.power?'on':''}"></span>${state.power?'READER ONLINE · 12V':'ROTATE CONTACTS · CONNECT 12V TO READER'}`;
    $('cardPocket').classList.toggle('empty',state.card);
    $('cardPocket').disabled = state.card;
    $('cardPocket').innerHTML = state.card ? '' : sprite('card') + 'STAFF ACCESS CARD<br>PROPERTY OF BUILDING SERVICES';
    $('cardPocket').setAttribute('aria-label',state.card?'Empty card compartment':'Take the staff access card');
  }
  function renderInspection() {
    if (view === 'directory') {
      $('inspection').innerHTML = '<div class="plaque"><h2>FLOOR DIRECTORY</h2><div class="dirRow"><span>△</span><span>24</span></div><div class="dirRow"><span>□</span><span>32</span></div><div class="dirRow"><span>○</span><span>18</span></div><p>BUILDING SERVICES · LIFT C</p></div>';
    } else if (view === 'card') {
      $('inspection').innerHTML = `<div class="cardInspect sprite card">${cardPrint}</div><p class="cardCaption">The back of the staff card.<br>Three symbols are printed in a row.</p><button class="inspectUse" id="useCard">Select card</button>`;
    } else if (view === 'circuit') {
      $('inspection').innerHTML = '<div class="enclosure"><h2>CARD READER · SERVICE PANEL</h2><div class="pcb"><span class="pcbLabel">12V IN →</span><span class="pcbLabel out">→ READER</span><span class="terminal start"></span><span id="output" class="terminal end"></span><div id="tiles" class="tileGrid"></div><span class="screwDecor"></span></div><div id="circuitNote" class="boardNote"></div><button id="cardPocket" class="cardPocket"></button></div>';
      renderCircuit();
    }
  }
  function reader() {
    if (selected === 'card') run('scan');
    else if (state.hatch && !state.power) show('circuit');
    else if (state.scanned) toast('Card accepted. Enter the service route.');
    else if (state.power) toast('Select your staff card, then present it here.');
    else toast('No response. Two slotted screws hold the cover.');
  }
  function screw(i) {
    if (selected !== 'coin') { toast('A slotted screw. A thin metal edge could turn it.'); effect('tap'); }
    else run('screw',i);
  }
  function arrive() {
    show('room'); $('doors').classList.remove('open'); $('enter').hidden = true;
    const values = ['30','29','28','27'];
    values.forEach((n,i) => arrival.push(setTimeout(() => { $('display').textContent = n; tone(220,.035,'sine',0,.02); }, 700 + i*650)));
    arrival.push(setTimeout(() => {
      $('doors').classList.add('open'); tone(784,.4); tone(659,.6,'sine',.4);
    },3100));
    arrival.push(setTimeout(() => { $('enter').hidden = false; arrival = []; },4900));
  }
  function openModal(content) {
    modalPreviousFocus = document.activeElement;
    $('modal').innerHTML = `<div class="dialog">${content}</div>`;
    $('modal').hidden = false;
    $('modal').querySelector('button')?.focus();
  }
  function closeModal() { $('modal').hidden = true; modalPreviousFocus?.focus(); }
  function menu() {
    openModal(`<h2>FLOOR 27</h2><p>Lobby Lockout</p><button data-modal="resume">Resume</button><button data-modal="sound">Sound: ${sound?'on':'off'}</button><button data-modal="hint">A small hint</button><button data-modal="restart" class="secondary">Restart this floor</button><small>An original fan-made escape puzzle inspired by<br>100 Floors and a real destination keypad.</small>`);
  }
  function hint() {
    const hints = !state.coin && !state.hatch
      ? ['Some things in this room can slide.','Look down at the floor.','Move the mat and inspect what is underneath.']
      : !state.hatch ? ['The reader is silent, but the touchscreen works.','Inspect how the reader cover is attached.','Select the token and use its edge on both slotted screws.']
      : !state.power ? ['Follow the power from the left terminal.','Each contact turns when you tap it. Neighbouring ends must meet.','Make one continuous copper path from 12V IN to READER.']
      : !state.card ? ['There is more than wiring in the compartment.','Inspect the pocket under the circuit.','Take the staff card.']
      : !state.scanned ? ['The reader is ready for a real credential.','Select the card in your inventory. Tap it a second time to inspect it.','With the card selected, tap the card-reader symbol.']
      : ['The marks on the card belong somewhere else in the room.','Compare the card with the floor directory.','Read the directory numbers in the order shown on the card.'];
    const n = Math.min(hintLevel++,2);
    openModal(`<h2>A SMALL HINT</h2><p class="hintText">${hints[n]}</p><button data-modal="resume">Back to the floor</button><button data-modal="hint" class="secondary">A little more help</button>`);
  }
  function confirmRestart() {
    openModal('<h2>START AGAIN?</h2><p>Restart this floor from the beginning?</p><button data-modal="resume">Keep playing</button><button data-modal="reset" class="secondary">Restart floor</button>');
  }
  function reset() {
    arrival.forEach(clearTimeout); arrival = [];
    state = Puzzle.fresh(); selected = null; hintLevel = 0; save(); closeModal(); show('room'); toast('Find a way into elevator C.');
  }
  function win() {
    openModal('<div class="winMark">↑</div><h1>FLOOR CLEAR</h1><p>The elevator is yours.</p><button data-modal="reset">Play again</button><button data-modal="resume" class="secondary">Back to the elevator</button>');
  }
  $('panelHot').onclick = () => { effect('tap'); show('panel'); };
  $('directory').onclick = () => { effect('tap'); show('directory'); };
  $('back').onclick = goBack;
  $('coin').onclick = () => run('coin');
  $('doors').onclick = () => { $('doors').classList.remove('rattle'); void $('doors').offsetWidth; $('doors').classList.add('rattle'); effect('deny'); toast('The elevator is waiting for authorisation.'); };
  $('enter').onclick = () => run('enter');
  $('reader').onclick = reader;
  $('screw0').onclick = () => screw(0); $('screw1').onclick = () => screw(1);
  $('maintenance').onclick = () => show('circuit');
  $('helpKey').onclick = () => toast('STAFF: present card, then enter service route. * clears · − deletes.',4300);
  $('lockKey').onclick = () => run('clear');
  $('accessibility').onclick = () => { tone(659,.25); tone(523,.35,'sine',.3); toast('The call chimes, but the elevator remains locked.'); };
  const keyValues = ['1','2','3','4','5','6','7','8','9','*','0','-'];
  keyValues.forEach((value,i) => {
    const button = document.createElement('button');
    button.style.left = `${147+(i%3)*65.5}px`; button.style.top = `${155+Math.floor(i/3)*57}px`;
    button.setAttribute('aria-label',value === '*'?'Clear code':value === '-'?'Delete last digit':`Key ${value}`);
    button.onclick = () => {
      if (value === '*') run('clear'); else if (value === '-') run('backspace');
      else { const r = run('digit',value); if (r.effect === 'deny') { $('screen').classList.remove('error'); void $('screen').offsetWidth; $('screen').classList.add('error'); } }
    };
    $('keys').appendChild(button);
  });
  $('inspection').onclick = e => {
    const tile = e.target.closest('[data-tile]');
    if (tile) run('rotate',Number(tile.dataset.tile));
    else if (e.target.closest('#cardPocket') && !state.card) {
      run('card'); selected = 'card'; returnView = 'circuit'; show('card');
    } else if (e.target.closest('#useCard')) { selected = 'card'; show(returnView); toast('Staff card selected.'); }
  };
  // Items support both tap-to-select and direct dragging onto the reader or a screw.
  let drag = null, suppressSlotClick = false;
  for(let i = 0; i < 4; i++) {
    const slot = $('slot'+i);
    slot.onclick = () => { if (suppressSlotClick) { suppressSlotClick = false; return; } if (slot.dataset.item) selectItem(slot.dataset.item); };
    slot.onpointerdown = e => {
      if (!slot.dataset.item) return;
      drag = {type:slot.dataset.item,x:e.clientX,y:e.clientY,moved:false,ghost:null}; slot.setPointerCapture(e.pointerId);
    };
    slot.onpointermove = e => {
      if (!drag) return;
      if (Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8 && !drag.moved) {
        drag.moved = true; drag.ghost = document.createElement('div'); drag.ghost.className = `sprite ${drag.type}`;
        Object.assign(drag.ghost.style,{position:'fixed',width:'65px',height:'65px',zIndex:100,pointerEvents:'none',filter:'drop-shadow(0 5px 5px #0008)'}); document.body.appendChild(drag.ghost);
      }
      if (drag.ghost) { drag.ghost.style.left = `${e.clientX-32}px`; drag.ghost.style.top = `${e.clientY-32}px`; }
    };
    slot.onpointerup = e => {
      if (!drag) return;
      if (drag.moved) {
        suppressSlotClick = true; selected = drag.type; drag.ghost?.remove();
        const target = document.elementFromPoint(e.clientX,e.clientY)?.closest('button');
        if (target?.id === 'reader' && drag.type === 'card') reader();
        else if (/^screw[01]$/.test(target?.id || '') && drag.type === 'coin') screw(Number(target.id.slice(-1)));
        else toast(drag.type === 'card'?'Staff card selected.':'Brass token selected.');
        render();
      }
      drag = null;
    };
    slot.onpointercancel = () => { drag?.ghost?.remove(); drag = null; };
    slot.style.touchAction = 'none';
  }
  let matStart = null, matWasDragged = false;
  $('mat').onpointerdown = e => { matStart = {x:e.clientX,y:e.clientY}; matWasDragged = false; $('mat').setPointerCapture(e.pointerId); };
  $('mat').onpointermove = e => {
    if (matStart && !matWasDragged && Math.hypot(e.clientX-matStart.x,e.clientY-matStart.y)>18) { matWasDragged = true; run('mat'); }
  };
  $('mat').onpointerup = () => { matStart = null; };
  $('mat').onpointercancel = () => { matStart = null; };
  $('mat').onclick = () => { if (!matWasDragged) run('mat'); matWasDragged = false; };
  $('menu').onclick = menu; $('restart').onclick = confirmRestart;
  $('modal').onclick = e => {
    const action = e.target.closest('[data-modal]')?.dataset.modal;
    if (action === 'resume') closeModal();
    if (action === 'sound') { sound = !sound; try { localStorage.setItem(STORAGE+'-sound',sound?'on':'off'); } catch (_) {} menu(); }
    if (action === 'hint') hint();
    if (action === 'restart') confirmRestart();
    if (action === 'reset') reset();
  };
  addEventListener('keydown',e => {
    if (!$('modal').hidden) {
      if (e.key === 'Escape') { closeModal(); e.preventDefault(); }
      if (e.key === 'Tab') {
        const buttons = [...$('modal').querySelectorAll('button')];
        if (e.shiftKey && document.activeElement === buttons[0]) { buttons.at(-1).focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === buttons.at(-1)) { buttons[0].focus(); e.preventDefault(); }
      }
      return;
    }
    if (e.key === 'Escape' && view !== 'room') { goBack(); e.preventDefault(); }
    if (view === 'panel') {
      if (/^\d$/.test(e.key)) { run('digit',e.key); e.preventDefault(); }
      if (e.key === 'Backspace') { run('backspace'); e.preventDefault(); }
      if (e.key === '*') { run('clear'); e.preventDefault(); }
    }
  });
  const images = [...document.images].map(img => img.complete ? Promise.resolve() : new Promise(resolve => {img.onload=resolve;img.onerror=resolve;}));
  Promise.all(images).then(() => {
    $('loading').hidden = true; render();
    if (state.complete) win(); else if (!state.moves) toast('Find a way into elevator C.',3500);
  });
  show('room');
})();
