function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function tglIndo(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return '';
  return Number(m[3]) + ' ' + BULAN[Number(m[2]) - 1] + ' ' + m[1];
}
function rentangTgl(a, b) {
  if (!a) return '';
  if (!b || a === b) return tglIndo(a);
  var x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a), y = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b);
  if (x && y && x[2] === y[2] && x[1] === y[1]) return Number(x[3]) + ' sampai ' + tglIndo(b);
  return tglIndo(a) + ' sampai ' + tglIndo(b);
}

function debounce(fn, ms) {
  var t;
  return function () {
    var a = arguments, self = this;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(self, a); }, ms);
  };
}

function kosong(v) { return v === undefined || v === null || String(v).trim() === ''; }

var toastTimer;
function toast(pesan, jenis) {
  var el = document.getElementById('toast');
  if (!el) return;
  el.textContent = pesan;
  el.className = 'toast tampil ' + (jenis || '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.className = 'toast'; }, jenis === 'galat' ? 6000 : 2600);
}

function simpanLokal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.error('simpanLokal', k, e); } }
function bacaLokal(k) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function hapusLokal(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
