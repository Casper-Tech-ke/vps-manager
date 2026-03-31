;(function (W, D, C) {
  'use strict';

  /* ── anti-iframe (always active, even for the owner) ─────────── */
  try {
    if (W.top !== W.self) { W.top.location = W.self.location; }
  } catch (e) {
    W.location.href = 'about:blank';
  }

  /* ── owner bypass ────────────────────────────────────────────── */
  function isOwner() {
    try {
      return !!(
        localStorage.getItem('xcm_owner') ||
        sessionStorage.getItem('xcm_api_key')
      );
    } catch (e) {
      return false;
    }
  }

  if (isOwner()) return;   /* ← owner exits here, no restrictions */

  /* ── silence console ────────────────────────────────────────── */
  var _noop = function () {};
  ['log','debug','info','warn','error','table','dir','dirxml',
   'assert','group','groupCollapsed','groupEnd','count','countReset',
   'clear','time','timeEnd','timeLog','timeStamp','trace',
   'profile','profileEnd'].forEach(function (m) {
    try { C[m] = _noop; } catch (e) {}
  });

  /* ── keyboard shortcuts ─────────────────────────────────────── */
  D.addEventListener('keydown', function (e) {
    if (isOwner()) return;
    var k  = e.key  || '';
    var kU = k.toUpperCase();
    var ct = e.ctrlKey || e.metaKey;
    var sh = e.shiftKey;
    if (k === 'F12')                          { e.preventDefault(); e.stopPropagation(); }
    if (ct && sh && /^[IJCKM]$/.test(kU))    { e.preventDefault(); e.stopPropagation(); }
    if (ct && kU === 'U')                     { e.preventDefault(); e.stopPropagation(); }
    if (ct && !sh && kU === 'S')              { e.preventDefault(); e.stopPropagation(); }
    if (ct && !sh && kU === 'P')              { e.preventDefault(); e.stopPropagation(); }
  }, true);

  /* ── right-click block ──────────────────────────────────────── */
  D.addEventListener('contextmenu', function (e) {
    if (isOwner()) return;
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    e.preventDefault();
  }, true);

  /* ── drag block ─────────────────────────────────────────────── */
  D.addEventListener('dragstart', function (e) {
    if (isOwner()) return;
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    e.preventDefault();
  }, true);

  /* ── disable text selection ─────────────────────────────────── */
  var _style = D.createElement('style');
  _style.id = 'xcm-sec-style';
  _style.textContent =
    '*:not(input):not(textarea):not([contenteditable]):not([contenteditable] *)' +
    '{ -webkit-user-select:none!important; user-select:none!important; }' +
    'input,textarea,[contenteditable]{ -webkit-user-select:text!important; user-select:text!important; }';
  D.head && D.head.appendChild(_style);

  /* ── lift text-selection restriction once owner logs in ─────── */
  setInterval(function () {
    if (!isOwner()) return;
    var s = D.getElementById('xcm-sec-style');
    if (s) s.remove();
  }, 2000);

}(window, document, console));
