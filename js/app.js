var $app = document.getElementById('app');
var F = null; // state form yang sedang dibuka

// ------------------------------------------------------------ router
function rute() {
  var h = location.hash.replace(/^#\/?/, '');
  var p = h.split('/');
  window.scrollTo(0, 0);
  $app.oninput = $app.onchange = $app.onclick = null;
  navAktif(p[0] === 'progres' ? 'progres' : p[0] === 'panduan' ? 'panduan' : 'isi');
  if (p[0] === 'isi' && p[1]) return tampilForm(p[1]);
  if (p[0] === 'selesai' && p[1]) return tampilSelesai(p[1]);
  if (p[0] === 'progres') return tampilProgres();
  if (p[0] === 'panduan') return tampilPanduan();
  return tampilBeranda();
}
function navAktif(k) {
  document.querySelectorAll('[data-nav]').forEach(function (a) {
    a.classList.toggle('aktif', a.getAttribute('data-nav') === k);
  });
}
function muat(teks) { $app.innerHTML = '<div class="muat"><div class="putar"></div><p>' + esc(teks || 'Memuat...') + '</p></div>'; }
function galat(pesan, ulang) {
  $app.innerHTML = '<div class="kartu galat-kotak"><h2>Belum bisa dimuat</h2><p>' + esc(pesan) + '</p>' +
    '<button class="btn utama" id="btnUlang">Coba lagi</button></div>';
  document.getElementById('btnUlang').onclick = ulang;
}
window.addEventListener('hashchange', rute);

// ------------------------------------------------------------ beranda: pilih sekolah
var statusSekolah = {}; // npsn -> {status, butirTerisi}

async function tampilBeranda() {
  muat('Memuat daftar sekolah...');
  var m;
  try { m = await ambilMaster(); } catch (e) { return galat(e.message, tampilBeranda); }
  apiGetProgress().then(function (p) {
    statusSekolah = {};
    p.sekolah.forEach(function (s) { statusSekolah[s.npsn] = s; });
    perbaruiDaftarSekolah(m);
  }).catch(function (e) { console.error('progres beranda', e); });

  var tahapList = Array.from(new Set(m.tim.map(function (t) { return t.tahap; }))).sort();
  var last = bacaLokal('abps_last') || {};
  var tahap = tahapList.indexOf(last.tahap) >= 0 ? last.tahap : tahapList[0];
  var timKey = last.timKey || '';

  function gambar() {
    var timTahap = m.tim.filter(function (t) { return t.tahap === tahap; })
      .sort(function (a, b) { return a.provinsi.localeCompare(b.provinsi) || a.kabKota.localeCompare(b.kabKota); });
    if (!timTahap.some(function (t) { return t.tahap + '|' + t.noTim === timKey; })) timKey = '';
    $app.innerHTML =
      '<div class="kartu">' +
      '<h2>1. Pilih tahap</h2><div class="seg">' +
      tahapList.map(function (t) {
        var contoh = m.tim.filter(function (x) { return x.tahap === t; })[0];
        return '<button class="' + (t === tahap ? 'aktif' : '') + '" data-tahap="' + esc(t) + '"><b>' + esc(t) + '</b><small>' +
          esc(rentangTgl(contoh.tanggalMulai, contoh.tanggalSelesai)) + '</small></button>';
      }).join('') + '</div>' +
      '<h2>2. Pilih kabupaten atau kota Anda</h2>' +
      '<select id="selTim" class="input"><option value="">Pilih...</option>' +
      timTahap.map(function (t) {
        var k = t.tahap + '|' + t.noTim;
        return '<option value="' + esc(k) + '"' + (k === timKey ? ' selected' : '') + '>' + esc(t.kabKota + ' (' + t.provinsi + ', Tim ' + t.noTim + ')') + '</option>';
      }).join('') + '</select>' +
      '</div><div id="boxTim"></div>' +
      '<p class="kecil tengah"><a href="#" id="muatUlangMaster">Muat ulang data sekolah dan petugas</a></p>';
    document.querySelectorAll('[data-tahap]').forEach(function (b) {
      b.onclick = function () { tahap = b.getAttribute('data-tahap'); timKey = ''; simpanLokal('abps_last', { tahap: tahap, timKey: '' }); gambar(); };
    });
    document.getElementById('selTim').onchange = function (e) {
      timKey = e.target.value; simpanLokal('abps_last', { tahap: tahap, timKey: timKey }); perbaruiDaftarSekolah(m);
    };
    document.getElementById('muatUlangMaster').onclick = async function (e) {
      e.preventDefault(); muat('Memuat ulang...');
      try { await apiGet('bersihkanCache'); await ambilMaster(true); toast('Data diperbarui'); } catch (er) { toast(er.message, 'galat'); }
      tampilBeranda();
    };
    perbaruiDaftarSekolah(m);
  }
  window._berandaState = function () { return { tahap: tahap, timKey: timKey }; };
  gambar();
}

function perbaruiDaftarSekolah(m) {
  var box = document.getElementById('boxTim');
  if (!box || !window._berandaState) return;
  var st = window._berandaState();
  if (!st.timKey) { box.innerHTML = ''; return; }
  var no = Number(st.timKey.split('|')[1]);
  var tim = m.tim.filter(function (t) { return t.tahap === st.tahap && t.noTim === no; })[0];
  var sekolah = m.lokus.filter(function (s) { return s.tahap === st.tahap && s.noTim === no; });
  box.innerHTML =
    '<div class="kartu"><h2>Tim ' + tim.noTim + '</h2>' +
    '<p class="kecil">Petugas: ' + esc(tim.petugas.join(', ')) + '<br>Pelaksanaan: ' + esc(rentangTgl(tim.tanggalMulai, tim.tanggalSelesai)) + '</p></div>' +
    '<h2 class="judul-luar">3. Pilih sekolah</h2>' +
    sekolah.map(function (s) {
      var d = bacaLokal('abps_draft_' + s.npsn);
      var ss = statusSekolah[s.npsn];
      var lencana = '';
      if (ss && ss.status === 'selesai') lencana = '<span class="lencana ok">Selesai</span>';
      else if (ss && ss.status === 'draft') lencana = '<span class="lencana sedang">Draft ' + ss.butirTerisi + ' dari ' + ss.totalButir + '</span>';
      else if (ss) lencana = '<span class="lencana">Belum mulai</span>';
      if (d && (!ss || ss.status !== 'selesai')) lencana += ' <span class="lencana info">Ada perubahan di perangkat ini</span>';
      return '<a class="kartu sekolah" href="#/isi/' + esc(s.npsn) + '"><div><b>' + esc(s.nama) + '</b>' +
        '<div class="kecil">NPSN ' + esc(s.npsn) + ' · ' + esc(s.statusBantuan) + ' · ' + esc(s.kategori) + '</div>' +
        '<div class="kecil">Rencana wawancara: ' + esc(tglIndo(s.tanggalWawancara)) + '</div></div><div>' + lencana + '</div></a>';
    }).join('');
}

// ------------------------------------------------------------ form: definisi langkah
function susunLangkah(bank) {
  var l = [{ id: 'hadir', judul: 'Kehadiran', butir: [] }, { id: 'profil', judul: 'Profil sekolah', butir: bank.filter(function (b) { return b.bagian === 'Profil Sekolah'; }) },
    { id: 'praktik', judul: 'Praktik mandiri', butir: bank.filter(function (b) { return b.bagian === 'Praktik Mandiri'; }) }];
  var grup = {};
  bank.filter(function (b) { return b.bagian === 'Pendalaman Indikator'; }).forEach(function (b) {
    (grup[b.kelompok] = grup[b.kelompok] || []).push(b);
  });
  Object.keys(grup).sort().forEach(function (k) {
    l.push({ id: 'pd' + k.charAt(0), judul: 'Pendalaman ' + k.charAt(0), sub: k.replace(/^[A-G]\.\s*/, ''), butir: grup[k] });
  });
  l.push({ id: 'kesimpulan', judul: 'Kesimpulan petugas', butir: bank.filter(function (b) { return b.bagian === 'Kesimpulan Petugas'; }) });
  l.push({ id: 'periksa', judul: 'Periksa dan kirim', butir: [] });
  return l;
}

function hitungTerisi() {
  return F.bank.filter(function (b) { return !kosong(F.jawaban[b.idButir]); }).length;
}
function kekurangan() {
  var k = [];
  F.bank.forEach(function (b) { if (b.wajib && kosong(F.jawaban[b.idButir])) k.push({ kunci: b.idButir, label: b.urutan + '. ' + b.label, langkah: langkahDari(b.idButir) }); });
  if (!F.tanggal) k.push({ kunci: 'tanggal', label: 'Tanggal pelaksanaan', langkah: 0 });
  if (!F.petugas.length) k.push({ kunci: 'petugas', label: 'Petugas yang hadir', langkah: 0 });
  if (!F.responden.length) k.push({ kunci: 'responden', label: 'Minimal satu responden', langkah: 0 });
  F.responden.forEach(function (r, i) { if (kosong(r.nama) || kosong(r.peran)) k.push({ kunci: 'responden' + i, label: 'Responden ke-' + (i + 1) + ': nama dan peran', langkah: 0 }); });
  return k;
}
function langkahDari(id) {
  for (var i = 0; i < F.langkah.length; i++) {
    if (F.langkah[i].butir.some(function (b) { return b.idButir === id; })) return i;
  }
  return 0;
}
function langkahLengkap(i) {
  var l = F.langkah[i];
  if (l.id === 'hadir') return !!F.tanggal && F.petugas.length > 0 && F.responden.length > 0 && F.responden.every(function (r) { return !kosong(r.nama) && !kosong(r.peran); });
  if (l.id === 'periksa') return kekurangan().length === 0;
  return l.butir.every(function (b) { return !b.wajib || !kosong(F.jawaban[b.idButir]); });
}

// ------------------------------------------------------------ form: muat
async function tampilForm(npsn) {
  muat('Membuka isian...');
  var m;
  try { m = await ambilMaster(); } catch (e) { return galat(e.message, function () { tampilForm(npsn); }); }
  var s = m.lokus.filter(function (x) { return x.npsn === npsn; })[0];
  if (!s) return galat('Sekolah dengan NPSN ' + npsn + ' tidak ditemukan.', function () { location.hash = '#/'; });
  var tim = m.tim.filter(function (t) { return t.tahap === s.tahap && t.noTim === s.noTim; })[0];

  var server = null, kabarServer = '';
  try { server = await apiGetIsian(npsn); } catch (e) { kabarServer = 'Data tersimpan di server tidak bisa dibaca (' + e.message + '). Yang tampil dari perangkat ini.'; }
  var lokal = bacaLokal('abps_draft_' + npsn);

  F = {
    npsn: npsn, s: s, tim: tim, bank: m.bank, opsi: m.opsi, petugasMaster: m.petugas, langkah: susunLangkah(m.bank),
    step: 0, status: server ? server.status : 'baru', kotor: false, adaServer: !!server, kabar: kabarServer,
    tanggal: '', petugas: [], pendampingNama: '', pendampingInstansi: '', jawaban: {}, responden: [], lokasiLain: false
  };
  var sumber = null;
  if (lokal && lokal.data) { sumber = lokal.data; F.kotor = true; F.kabar = 'Isian yang belum terkirim dari perangkat ini dimuat kembali.'; }
  else if (server) sumber = server;
  if (sumber) {
    F.tanggal = sumber.tanggalPelaksanaan || sumber.tanggal || '';
    F.petugas = (sumber.petugasHadir || sumber.petugas || []).slice();
    F.pendampingNama = sumber.pendampingNama || '';
    F.pendampingInstansi = sumber.pendampingInstansi || '';
    F.jawaban = Object.assign({}, sumber.jawaban || {});
    F.responden = (sumber.responden || []).map(function (r) { return { nama: r.nama, peran: r.peran, manual: !!r.manual }; });
  }
  if (!F.tanggal) F.tanggal = s.tanggalWawancara || '';
  m.bank.forEach(function (b) { if (b.isiOtomatis === 'jumlahPD' && kosong(F.jawaban[b.idButir])) F.jawaban[b.idButir] = String(s.jumlahPD); });
  // butir lokasi: bila nilai bukan salah satu opsi, anggap "Lainnya"
  m.bank.forEach(function (b) {
    if (b.tipe === 'Pilihan + Lainnya') {
      var ops = (F.opsi[b.opsi] || []).map(function (o) { return o.nilai; });
      var v = F.jawaban[b.idButir];
      F['lain_' + b.idButir] = !kosong(v) && ops.indexOf(v) < 0;
    }
  });
  gambarForm();
}

// ------------------------------------------------------------ form: gambar
function gambarForm() {
  var l = F.langkah[F.step], n = F.langkah.length, total = F.bank.length, terisi = hitungTerisi();
  var persen = Math.round(terisi / total * 100);
  var h = '';
  h += '<div class="kepala-form"><a href="#/" class="kembali">Ganti sekolah</a><div class="nama-sekolah">' + esc(F.s.nama) + '</div>' +
    '<div class="kecil">NPSN ' + esc(F.s.npsn) + ' · ' + esc(F.s.kabKota) + ' · ' + esc(F.s.tahap) + ' Tim ' + F.s.noTim + '</div>' +
    '<div class="bar"><div style="width:' + persen + '%"></div></div>' +
    '<div class="kecil" id="infoTerisi">' + terisi + ' dari ' + total + ' butir terisi (' + persen + '%)' + (F.status === 'selesai' ? ' · sudah dikirim selesai' : '') + '</div>' +
    '<div class="titik">' + F.langkah.map(function (x, i) {
      return '<button class="' + (i === F.step ? 'aktif ' : '') + (langkahLengkap(i) && i < n - 1 ? 'lengkap' : '') + '" data-ke="' + i + '" aria-label="' + esc(x.judul) + '">' + (i + 1) + '</button>';
    }).join('') + '</div></div>';
  if (F.kabar) h += '<div class="info">' + esc(F.kabar) + '</div>';
  h += '<div class="kartu"><div class="kecil">Langkah ' + (F.step + 1) + ' dari ' + n + '</div><h2>' + esc(l.judul) + '</h2>' + (l.sub ? '<p class="sub">' + esc(l.sub) + '</p>' : '');
  if (l.id === 'hadir') h += htmlHadir();
  else if (l.id === 'periksa') h += htmlPeriksa();
  else h += htmlButir(l);
  h += '</div>';
  h += '<div class="navbawah"><button class="btn" data-aksi="mundur"' + (F.step === 0 ? ' disabled' : '') + '>Kembali</button>' +
    (F.status === 'selesai' ? '' : '<button class="btn" data-aksi="draft">Simpan sementara</button>') +
    (F.step < n - 1 ? '<button class="btn utama" data-aksi="maju">Lanjut</button>' : '') + '</div>';
  $app.innerHTML = h;
  pasangForm();
  var da = document.querySelector('.titik .aktif');
  if (da && da.scrollIntoView) da.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function htmlHadir() {
  var h = '';
  h += '<label class="lbl">Tanggal pelaksanaan wawancara</label><input type="date" class="input" data-f="tanggal" value="' + esc(F.tanggal) + '">';
  h += '<label class="lbl">Petugas yang hadir</label><div class="cek-daftar">';
  var daftar = F.tim.petugas.slice();
  F.petugas.forEach(function (p) { if (daftar.indexOf(p) < 0) daftar.push(p); });
  daftar.forEach(function (p) {
    h += '<label class="cek"><input type="checkbox" data-petugas="' + esc(p) + '"' + (F.petugas.indexOf(p) >= 0 ? ' checked' : '') + '><span>' + esc(p) + '</span></label>';
  });
  h += '</div><div class="baris"><input class="input" id="petugasBaru" placeholder="Petugas lain, ketik namanya" list="dlPetugas"><button class="btn" data-aksi="tambahPetugas">Tambah</button></div>' +
    '<datalist id="dlPetugas">' + F.petugasMaster.map(function (p) { return '<option value="' + esc(p.nama) + '">'; }).join('') + '</datalist>';
  h += '<label class="lbl">Pendamping dari KCD</label><input class="input" data-f="pendampingNama" placeholder="Nama pendamping (kosongkan bila tidak ada)" value="' + esc(F.pendampingNama) + '">' +
    '<input class="input" data-f="pendampingInstansi" placeholder="Instansi asal pendamping" value="' + esc(F.pendampingInstansi) + '">';
  h += '<label class="lbl">Responden yang hadir</label><p class="kecil">Ketuk peran untuk menambah responden, lalu ketik namanya. Peran lain bisa ditambahkan sendiri.</p><div class="chips">';
  (F.opsi['Peran Responden'] || []).forEach(function (o) { h += '<button class="chip" data-aksi="tambahPeran" data-peran="' + esc(o.nilai) + '">+ ' + esc(o.nilai) + '</button>'; });
  h += '<button class="chip" data-aksi="tambahLain">+ Peran lain</button></div><div id="daftarResponden">' + htmlResponden() + '</div>';
  return h;
}
function htmlResponden() {
  if (!F.responden.length) return '<p class="kosong-info">Belum ada responden.</p>';
  var ops = (F.opsi['Peran Responden'] || []).map(function (o) { return o.nilai; });
  return F.responden.map(function (r, i) {
    var baku = ops.indexOf(r.peran) >= 0;
    return '<div class="resp"><div class="resp-no">' + (i + 1) + '</div><div class="resp-isi">' +
      '<input class="input" data-r="' + i + '" data-rf="nama" placeholder="Nama responden" value="' + esc(r.nama) + '">' +
      (baku ? '<div class="peran">' + esc(r.peran) + '</div>' : '<input class="input" data-r="' + i + '" data-rf="peran" placeholder="Peran, misalnya Ketua Komite" value="' + esc(r.peran) + '">') +
      '</div><button class="hapus" data-aksi="hapusResp" data-i="' + i + '" aria-label="Hapus responden">Hapus</button></div>';
  }).join('');
}

function htmlButir(l) {
  var h = '', indukTampil = false;
  l.butir.forEach(function (b) {
    var induk = /^Pertanyaan induk:/.test(b.keterangan) ? b.keterangan.replace(/^Pertanyaan induk:\s*/, '') : '';
    if (induk && !indukTampil) { h += '<div class="induk">' + esc(induk) + '</div>'; indukTampil = true; }
    var v = F.jawaban[b.idButir];
    h += '<div class="butir" data-butir="' + esc(b.idButir) + '"><div class="butir-teks"><span class="no">' + b.urutan + '</span>' + esc(b.teks) + (b.wajib ? '' : ' <i>(boleh dikosongkan)</i>') + '</div>';
    if (b.keterangan && !induk) h += '<div class="kecil bantu">' + esc(b.keterangan) + '</div>';
    if (b.tipe === 'Angka') {
      h += '<input class="input" inputmode="numeric" data-j="' + esc(b.idButir) + '" value="' + esc(v) + '" placeholder="Angka">';
    } else if (b.tipe === 'Pilihan') {
      var o = F.opsi[b.opsi] || [];
      h += '<div class="pilih">' + o.map(function (x) {
        return '<label class="kartu-pilih' + (v === x.nilai ? ' aktif' : '') + '"><input type="radio" name="p_' + esc(b.idButir) + '" data-pil="' + esc(b.idButir) + '" value="' + esc(x.nilai) + '"' + (v === x.nilai ? ' checked' : '') + '><b>' + esc(x.nilai) + '</b><span>' + esc(x.keterangan) + '</span></label>';
      }).join('') + '</div>';
    } else if (b.tipe === 'Pilihan + Lainnya') {
      var ops = F.opsi[b.opsi] || [], lain = F['lain_' + b.idButir];
      h += '<div class="chips">' + ops.map(function (x) {
        return '<button class="chip' + (!lain && v === x.nilai ? ' aktif' : '') + '" data-aksi="pilihOpsi" data-j="' + esc(b.idButir) + '" data-nilai="' + esc(x.nilai) + '">' + esc(x.nilai) + '</button>';
      }).join('') + '<button class="chip' + (lain ? ' aktif' : '') + '" data-aksi="pilihLain" data-j="' + esc(b.idButir) + '">Lainnya</button></div>';
      if (lain) h += '<input class="input" data-j="' + esc(b.idButir) + '" value="' + esc(v) + '" placeholder="Ketik jawaban lainnya">';
    } else {
      h += '<textarea class="input area" rows="3" data-j="' + esc(b.idButir) + '" placeholder="Catat jawaban responden">' + esc(v) + '</textarea>' +
        '<button class="chip kecil-chip" data-aksi="tidakAda" data-j="' + esc(b.idButir) + '">Responden tidak punya jawaban</button>';
    }
    h += '</div>';
  });
  return h;
}

function htmlPeriksa() {
  var k = kekurangan(), terisi = hitungTerisi();
  var h = '<p>' + terisi + ' dari ' + F.bank.length + ' butir terisi.</p>';
  if (k.length) {
    h += '<div class="peringatan"><b>' + k.length + ' bagian masih perlu dilengkapi:</b><ul>' + k.map(function (x) {
      return '<li><a href="#" data-ke="' + x.langkah + '">' + esc(x.label) + '</a></li>';
    }).join('') + '</ul></div>';
  } else {
    h += '<div class="info ok">Semua bagian sudah lengkap. Periksa sekali lagi bila perlu, lalu kirim.</div>';
  }
  h += '<button class="btn utama besar" data-aksi="kirim"' + (k.length ? ' disabled' : '') + '>' + (F.status === 'selesai' ? 'Simpan perubahan' : 'Kirim sebagai selesai') + '</button>';
  if (F.status !== 'selesai') h += '<p class="kecil">Belum lengkap? Gunakan Simpan sementara. Isian bisa dilanjutkan kapan saja.</p>';
  return h;
}

// ------------------------------------------------------------ form: interaksi
var simpanOtomatisLokal = debounce(function () { if (F) simpanLokal('abps_draft_' + F.npsn, { at: Date.now(), data: muatan('draft') }); }, 400);

function tandaiKotor() {
  F.kotor = true;
  simpanOtomatisLokal();
  var b = F.bank.length, t = hitungTerisi(), p = Math.round(t / b * 100);
  var info = document.getElementById('infoTerisi');
  if (info) info.textContent = t + ' dari ' + b + ' butir terisi (' + p + '%)' + (F.status === 'selesai' ? ' · sudah dikirim selesai' : '');
  var bar = document.querySelector('.bar > div'); if (bar) bar.style.width = p + '%';
  document.querySelectorAll('.titik button').forEach(function (el, i) {
    el.classList.toggle('lengkap', langkahLengkap(i) && i < F.langkah.length - 1);
  });
}

function muatan(status) {
  return {
    npsn: F.npsn, status: status, tanggalPelaksanaan: F.tanggal, petugasHadir: F.petugas,
    pendampingNama: F.pendampingNama, pendampingInstansi: F.pendampingInstansi,
    jawaban: F.jawaban, responden: F.responden
  };
}

function pasangForm() {
  $app.oninput = function (e) {
    var el = e.target;
    if (el.hasAttribute('data-j')) { F.jawaban[el.getAttribute('data-j')] = el.value; tandaiKotor(); }
    else if (el.hasAttribute('data-f')) { F[el.getAttribute('data-f')] = el.value; tandaiKotor(); }
    else if (el.hasAttribute('data-r')) { F.responden[Number(el.getAttribute('data-r'))][el.getAttribute('data-rf')] = el.value; tandaiKotor(); }
  };
  $app.onchange = function (e) {
    var el = e.target;
    if (el.hasAttribute('data-petugas')) {
      var p = el.getAttribute('data-petugas'), i = F.petugas.indexOf(p);
      if (el.checked && i < 0) F.petugas.push(p);
      if (!el.checked && i >= 0) F.petugas.splice(i, 1);
      tandaiKotor();
    } else if (el.hasAttribute('data-pil')) {
      F.jawaban[el.getAttribute('data-pil')] = el.value; tandaiKotor();
      document.querySelectorAll('[name="' + el.name + '"]').forEach(function (r) { r.parentNode.classList.toggle('aktif', r.checked); });
    }
  };
  $app.onclick = async function (e) {
    var t = e.target.closest('[data-aksi],[data-ke]');
    if (!t) return;
    if (t.hasAttribute('data-ke')) { e.preventDefault(); await pindah(Number(t.getAttribute('data-ke'))); return; }
    var a = t.getAttribute('data-aksi');
    if (a === 'maju') return pindah(F.step + 1);
    if (a === 'mundur') return pindah(F.step - 1);
    if (a === 'draft') return kirim('draft', t);
    if (a === 'kirim') return kirim('selesai', t);
    if (a === 'tambahPetugas') {
      var inp = document.getElementById('petugasBaru'), nm = inp.value.trim();
      if (nm && F.petugas.indexOf(nm) < 0) { F.petugas.push(nm); tandaiKotor(); gambarForm(); }
      return;
    }
    if (a === 'tambahPeran') { F.responden.push({ nama: '', peran: t.getAttribute('data-peran'), manual: false }); tandaiKotor(); return segarkanResponden(true); }
    if (a === 'tambahLain') { F.responden.push({ nama: '', peran: '', manual: true }); tandaiKotor(); return segarkanResponden(true); }
    if (a === 'hapusResp') { F.responden.splice(Number(t.getAttribute('data-i')), 1); tandaiKotor(); return segarkanResponden(false); }
    if (a === 'tidakAda') {
      var id = t.getAttribute('data-j'); F.jawaban[id] = 'Responden tidak memiliki jawaban atau tidak ditanyakan.'; tandaiKotor();
      var ta = document.querySelector('textarea[data-j="' + id + '"]'); if (ta) ta.value = F.jawaban[id]; return;
    }
    if (a === 'pilihOpsi') { var j = t.getAttribute('data-j'); F.jawaban[j] = t.getAttribute('data-nilai'); F['lain_' + j] = false; tandaiKotor(); return gambarForm(); }
    if (a === 'pilihLain') { var j2 = t.getAttribute('data-j'); F['lain_' + j2] = true; F.jawaban[j2] = ''; tandaiKotor(); return gambarForm(); }
  };
}

function segarkanResponden(fokusTerakhir) {
  document.getElementById('daftarResponden').innerHTML = htmlResponden();
  if (fokusTerakhir) {
    var semua = document.querySelectorAll('#daftarResponden [data-rf="nama"]');
    if (semua.length) semua[semua.length - 1].focus();
  }
}

async function pindah(ke) {
  if (ke < 0 || ke >= F.langkah.length) return;
  // simpan ke server diam-diam saat pindah langkah, kecuali sudah berstatus selesai
  if (F.kotor && F.status !== 'selesai' && ada_sesuatu()) {
    simpanLokal('abps_draft_' + F.npsn, { at: Date.now(), data: muatan('draft') });
    apiSimpanIsian(muatan('draft')).then(function () { F.kotor = false; F.adaServer = true; F.status = 'draft'; hapusLokal('abps_draft_' + F.npsn); })
      .catch(function (er) { console.error('simpan otomatis', er); toast('Belum tersimpan di server, aman di perangkat ini.', 'galat'); });
  }
  F.step = ke; F.kabar = ''; gambarForm(); window.scrollTo(0, 0);
}
function ada_sesuatu() { return hitungTerisi() > 0 || F.responden.length > 0 || F.petugas.length > 0; }

async function kirim(status, tombol) {
  if (F.kunci) return;
  F.kunci = true;
  var teksAwal = tombol ? tombol.textContent : '';
  if (tombol) { tombol.disabled = true; tombol.textContent = 'Menyimpan...'; }
  try {
    var r = await apiSimpanIsian(muatan(status));
    F.kotor = false; F.adaServer = true; hapusLokal('abps_draft_' + F.npsn);
    if (status === 'selesai') { F.kunci = false; location.hash = '#/selesai/' + F.npsn; return; }
    F.status = 'draft';
    toast('Tersimpan: ' + r.butirTerisi + ' dari ' + r.totalButir + ' butir');
  } catch (e) {
    var kur = e.kurang ? ' (' + e.kurang.length + ' bagian)' : '';
    toast(e.message + kur, 'galat');
  }
  F.kunci = false;
  if (tombol) { tombol.disabled = false; tombol.textContent = teksAwal; }
}

// ------------------------------------------------------------ konfirmasi selesai
async function tampilSelesai(npsn) {
  var m = await ambilMaster().catch(function () { return null; });
  var s = m && m.lokus.filter(function (x) { return x.npsn === npsn; })[0];
  var lain = s ? m.lokus.filter(function (x) { return x.tahap === s.tahap && x.noTim === s.noTim && x.npsn !== npsn; }) : [];
  $app.innerHTML = '<div class="kartu tengah"><div class="centang">✓</div><h2>Isian terkirim</h2><p>' + esc(s ? s.nama : npsn) + ' sudah tercatat selesai.</p>' +
    lain.map(function (x) { return '<a class="btn utama besar" href="#/isi/' + esc(x.npsn) + '">Lanjut ke ' + esc(x.nama) + '</a>'; }).join('') +
    '<a class="btn besar" href="#/">Kembali ke daftar sekolah</a><a class="btn besar" href="#/progres">Lihat progres</a></div>';
}

// ------------------------------------------------------------ panduan
function tampilPanduan() {
  $app.innerHTML =
    '<div class="kartu panduan"><h2>Panduan petugas</h2>' +
    '<p>Satu sekolah, satu isian. Isi saat wawancara, kirim setelah semua butir terisi.</p>' +
    '<ol>' +
    '<li><b>Pilih sekolah.</b> Buka <a href="#/">Isi instrumen</a>. Pilih tahap, lalu kabupaten atau kota tim Anda, lalu sekolah yang sedang diwawancarai.</li>' +
    '<li><b>Langkah 1, Kehadiran.</b> Periksa tanggal, centang petugas yang hadir, dan ketik nama serta instansi pendamping KCD. Tambah responden dengan mengetuk perannya, lalu ketik namanya. Peran di luar daftar: ketuk <i>Peran lain</i>.</li>' +
    '<li><b>Langkah 2 sampai 11.</b> Isi profil sekolah, praktik mandiri, pendalaman A sampai G, dan kesimpulan petugas. Catat jawaban dengan kata-kata responden. Bila responden tidak punya jawaban, ketuk <i>Responden tidak punya jawaban</i>.</li>' +
    '<li><b>Langkah 12, Periksa dan kirim.</b> Bagian yang belum lengkap tampil sebagai daftar. Ketuk salah satunya untuk langsung ke bagian itu. Bila sudah lengkap, tekan <i>Kirim sebagai selesai</i>.</li>' +
    '<li><b>Selesai.</b> Halaman <i>Isian terkirim</i> muncul. Lanjutkan ke sekolah kedua tim Anda.</li>' +
    '</ol></div>' +
    '<div class="kartu panduan"><h2>Isian aman dari sinyal putus</h2><ul>' +
    '<li>Setiap ketikan tersimpan di perangkat ini. Isian juga dikirim ke server saat pindah langkah atau saat menekan <i>Simpan sementara</i>.</li>' +
    '<li>Sinyal hilang di tengah jalan: lanjut mengetik. Kirim setelah sinyal kembali. Jangan hapus data browser sebelum isian terkirim.</li>' +
    '<li>Melanjutkan isian: buka sekolah yang sama dari komputer ini atau dari perangkat lain. Isian terakhir langsung termuat.</li>' +
    '<li>Mengubah isian yang sudah selesai: buka lagi sekolahnya, ubah, lalu di langkah 12 tekan <i>Simpan perubahan</i>.</li>' +
    '</ul></div>' +
    '<div class="kartu panduan"><h2>Bila ada kendala</h2><ul>' +
    '<li><b>Tombol Kirim tidak aktif.</b> Masih ada bagian kosong. Lihat daftarnya di langkah 12.</li>' +
    '<li><b>Diminta kode akses.</b> Masukkan kode dari koordinator. Kode hanya ditanyakan sekali di perangkat ini.</li>' +
    '<li><b>Sekolah, tim, atau petugas keliru.</b> Hubungi koordinator. Data diubah di spreadsheet master, lalu ketuk <i>Muat ulang data sekolah dan petugas</i> di beranda.</li>' +
    '<li><b>Muncul pesan merah.</b> Foto layar dan kirim ke koordinator.</li>' +
    '</ul></div>' +
    '<details class="kartu panduan"><summary>Untuk koordinator</summary><ul>' +
    '<li>Lokus, tim, petugas, pilihan dropdown, dan pertanyaan diubah di spreadsheet <b>ABPS_Data_Master</b>. Perubahan terbaca aplikasi paling lama 10 menit, atau langsung lewat tombol muat ulang di beranda.</li>' +
    '<li>Hasil isian ada di spreadsheet <b>ABPS_Hasil_Isian</b>. Sheet Rekap Ringkas dan Rekap Pengisian terhitung otomatis. Tab <a href="#/progres">Progres</a> menampilkan hal yang sama untuk petugas.</li>' +
    '<li>Jangan mengubah atau menghapus ID butir (misalnya PD-01) yang sudah ada isiannya.</li>' +
    '<li>Sebelum kegiatan dimulai, hapus baris uji di sheet Isian dan Responden (baris 2 ke bawah).</li>' +
    '</ul></details>';
}

// ------------------------------------------------------------ progres
async function tampilProgres() {
  muat('Memuat progres...');
  var p;
  try { p = await apiGetProgress(); } catch (e) { return galat(e.message, tampilProgres); }
  var fTahap = '', fProv = '';
  function gambar() {
    var tahaps = Array.from(new Set(p.sekolah.map(function (s) { return s.tahap; }))).sort();
    var provs = Array.from(new Set(p.sekolah.map(function (s) { return s.provinsi; }))).sort();
    var data = p.sekolah.filter(function (s) { return (!fTahap || s.tahap === fTahap) && (!fProv || s.provinsi === fProv); });
    var r = { target: data.length, selesai: 0, draft: 0, belum: 0 };
    data.forEach(function (s) { r[s.status]++; });
    var persen = r.target ? Math.round(r.selesai / r.target * 100) : 0;
    var h = '<div class="kartu"><div class="baris"><select id="fTahap" class="input"><option value="">Semua tahap</option>' + tahaps.map(function (t) { return '<option' + (t === fTahap ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>' +
      '<select id="fProv" class="input"><option value="">Semua provinsi</option>' + provs.map(function (t) { return '<option' + (t === fProv ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></div>' +
      '<div class="angka"><div><b>' + r.selesai + '</b><span>Selesai</span></div><div><b>' + r.draft + '</b><span>Draft</span></div><div><b>' + r.belum + '</b><span>Belum mulai</span></div><div><b>' + persen + '%</b><span>dari ' + r.target + ' sekolah</span></div></div>' +
      '<div class="bar"><div style="width:' + persen + '%"></div></div><p class="kecil">Diperbarui ' + esc(p.diambil) + ' · <a href="#" id="segarkan">Segarkan</a></p></div>';
    var peta = {};
    data.forEach(function (s) { var k = s.provinsi + '|' + s.kabKota; (peta[k] = peta[k] || []).push(s); });
    Object.keys(peta).sort().forEach(function (k) {
      var arr = peta[k], dua = k.split('|');
      h += '<div class="kartu"><div class="kab"><b>' + esc(dua[1]) + '</b><span class="kecil">' + esc(dua[0]) + ' · ' + esc(arr[0].tahap) + ' Tim ' + arr[0].noTim + '</span></div>';
      arr.forEach(function (s) {
        var lb = s.status === 'selesai' ? '<span class="lencana ok">Selesai</span>' : s.status === 'draft' ? '<span class="lencana sedang">Draft ' + s.butirTerisi + '/' + s.totalButir + '</span>' : '<span class="lencana">Belum mulai</span>';
        h += '<a class="baris-sek" href="#/isi/' + esc(s.npsn) + '"><div>' + esc(s.nama) + '<div class="kecil">' + (s.level ? esc(s.level) + ' · ' : '') + esc(s.kategori) + '</div></div>' + lb + '</a>';
      });
      h += '</div>';
    });
    $app.innerHTML = h;
    document.getElementById('fTahap').onchange = function (e) { fTahap = e.target.value; gambar(); };
    document.getElementById('fProv').onchange = function (e) { fProv = e.target.value; gambar(); };
    document.getElementById('segarkan').onclick = function (e) { e.preventDefault(); tampilProgres(); };
  }
  gambar();
}

// ------------------------------------------------------------ mulai
window.addEventListener('beforeunload', function (e) {
  if (F && F.kotor && location.hash.indexOf('#/isi/') === 0) { e.preventDefault(); e.returnValue = ''; }
});
rute();
