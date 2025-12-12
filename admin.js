// === KONEKSI KE SUPABASE ===
const SUPABASE_URL = "https://sjdytaaatjndhgjfsxfc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqZHl0YWFhdGpuZGhnamZzeGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NzI2NDIsImV4cCI6MjA3NTE0ODY0Mn0.-EYx3sDrtfdJAweZO_V_gPHyD-Cqdg6YczuaXzl2J1E";
const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === ELEMEN DOM ===
// Tab Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const manageTabBtns = document.querySelectorAll('.manage-tab-btn');
const manageContents = document.querySelectorAll('.manage-content');

// Form Elements
const filmForm = document.getElementById('filmForm');
const episodeForm = document.getElementById('episodeForm');
const spoilerForm = document.getElementById('spoilerForm');

// Form Titles and Buttons
const filmFormTitle = document.getElementById('filmFormTitle');
const filmSubmitBtn = document.getElementById('filmSubmitBtn');
const filmCancelBtn = document.getElementById('filmCancelBtn');

const episodeFormTitle = document.getElementById('episodeFormTitle');
const episodeSubmitBtn = document.getElementById('episodeSubmitBtn');
const episodeCancelBtn = document.getElementById('episodeCancelBtn');

const spoilerFormTitle = document.getElementById('spoilerFormTitle');
const spoilerSubmitBtn = document.getElementById('spoilerSubmitBtn');
const spoilerCancelBtn = document.getElementById('spoilerCancelBtn');

// Select Elements
const episodeFilmSelect = document.getElementById('episodeFilm');
const spoilerFilmSelect = document.getElementById('spoilerFilm');

// Filter Elements
const episodeFilmFilter = document.getElementById('episodeFilmFilter');
const episodeSearchInput = document.getElementById('episodeSearch');

// Management Lists
const filmsList = document.getElementById('filmsList');
const episodesList = document.getElementById('episodesList');
const spoilersList = document.getElementById('spoilersList');

// Refresh Buttons
const refreshFilmsBtn = document.getElementById('refreshFilms');
const refreshEpisodesBtn = document.getElementById('refreshEpisodes');
const refreshSpoilersBtn = document.getElementById('refreshSpoilers');

// Notification
const notification = document.getElementById('notification');

// Admin Info
const adminEmail = document.getElementById('adminEmail');

// === STATE VARIABLES ===
let isEditingFilm = false;
let isEditingEpisode = false;
let isEditingSpoiler = false;
let allEpisodes = []; // Menyimpan semua episode untuk pencarian
let selectedFilmId = ''; // Untuk menyimpan filter donghua yang dipilih

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', async () => {
  // Cek authentication
  if (!await checkAuth()) {
    return;
  }

  console.log('🔄 Memulai inisialisasi admin...');
  
  // Test koneksi
  const connected = await testConnection();
  if (!connected) {
    showNotification('Koneksi database gagal! Periksa koneksi internet dan Supabase credentials.', 'error');
    return;
  }

  await loadFilmsForSelect();
  await loadAllContent();
  setupEventListeners();
  
  console.log('✅ Admin panel siap digunakan');
});

// === AUTHENTICATION ===
async function checkAuth() {
  try {
    // Cek session dari Supabase Auth
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) throw error;
    
    if (!session || !session.user) {
      window.location.href = 'login.html';
      return false;
    }

    // Verifikasi bahwa user adalah admin
    const isAdmin = await checkAdminUser(session.user.id);
    
    if (!isAdmin) {
      await supabase.auth.signOut();
      window.location.href = 'login.html';
      return false;
    }

    // Tampilkan info admin
    const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
    adminEmail.textContent = `Login sebagai: ${adminUser.email || session.user.email}`;
    
    return true;
  } catch (error) {
    console.error('Auth check error:', error);
    window.location.href = 'login.html';
    return false;
  }
}

async function checkAdminUser(userId) {
  try {
    // Query ke tabel admin_users
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.log('Admin user not found or table not exists:', error.message);
      return false;
    }

    return !!adminUser;
  } catch (error) {
    console.error('Error checking admin user:', error);
    return false;
  }
}

async function logout() {
  if (confirm('Apakah Anda yakin ingin logout?')) {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('adminLoggedIn');
      localStorage.removeItem('adminUser');
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect anyway
      localStorage.removeItem('adminLoggedIn');
      localStorage.removeItem('adminUser');
      window.location.href = 'login.html';
    }
  }
}

// === DEBUG FUNCTIONS ===
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('film')
      .select('count')
      .limit(1);

    if (error) throw error;
    
    console.log('✅ Koneksi Supabase berhasil');
    showNotification('Koneksi database berhasil!', 'success');
    return true;
  } catch (error) {
    console.error('❌ Koneksi Supabase gagal:', error);
    return false;
  }
}

async function testAddFilm() {
  const testData = {
    title: 'Test Donghua ' + Date.now(),
    description: 'Ini adalah donghua test untuk debugging',
    image_url: 'https://via.placeholder.com/360x640/0090cc/ffffff?text=Thumbnail+9:16',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    duration: 24,
    total_episodes: 12,
    release_year: 2024,
    genre: ['Action', 'Test'],
    status: 'Ongoing',
    rating: 0.00,
    total_views: 0
  };

  try {
    const { data, error } = await supabase
      .from('film')
      .insert([testData])
      .select();

    if (error) throw error;
    
    console.log('✅ Test film berhasil ditambahkan:', data);
    showNotification('Test film berhasil ditambahkan!', 'success');
    await loadFilmsForSelect();
    await loadFilms();
    return true;
  } catch (error) {
    console.error('❌ Test film gagal:', error);
    showNotification(`Test gagal: ${error.message}`, 'error');
    return false;
  }
}

// === EVENT LISTENERS ===
function setupEventListeners() {
  // Tab Navigation
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });

  // Manage Tab Navigation
  manageTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const manageId = btn.dataset.manage;
      switchManageTab(manageId);
    });
  });

  // Form Submissions
  filmForm.addEventListener('submit', handleFilmSubmit);
  episodeForm.addEventListener('submit', handleEpisodeSubmit);
  spoilerForm.addEventListener('submit', handleSpoilerSubmit);

  // Cancel Buttons
  filmCancelBtn.addEventListener('click', cancelFilmEdit);
  episodeCancelBtn.addEventListener('click', cancelEpisodeEdit);
  spoilerCancelBtn.addEventListener('click', cancelSpoilerEdit);

  // Refresh Buttons
  refreshFilmsBtn.addEventListener('click', () => loadFilms());
  refreshEpisodesBtn.addEventListener('click', () => loadEpisodes());
  refreshSpoilersBtn.addEventListener('click', () => loadSpoilers());

  // Filter and Search Events
  episodeFilmFilter.addEventListener('change', (e) => {
    selectedFilmId = e.target.value;
    filterAndSearchEpisodes();
  });

  episodeSearchInput.addEventListener('input', (e) => {
    setTimeout(() => {
      filterAndSearchEpisodes();
    }, 300);
  });

  episodeSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      filterAndSearchEpisodes();
    }
  });
}

// === TAB MANAGEMENT ===
function switchTab(tabId) {
  // Update tab buttons
  tabBtns.forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

  // Update tab contents
  tabContents.forEach(content => content.classList.remove('active'));
  document.getElementById(`${tabId}-tab`).classList.add('active');

  // Load content for manage tab
  if (tabId === 'manage') {
    loadAllContent();
  }
}

function switchManageTab(manageId) {
  // Update manage tab buttons
  manageTabBtns.forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-manage="${manageId}"]`).classList.add('active');

  // Update manage contents
  manageContents.forEach(content => content.classList.remove('active'));
  document.getElementById(`${manageId}-manage`).classList.add('active');
}

// === LOAD DATA FOR SELECTS ===
async function loadFilmsForSelect() {
  try {
    const { data: films, error } = await supabase
      .from('film')
      .select('id, title')
      .order('title');

    if (error) throw error;

    // Clear existing options
    episodeFilmSelect.innerHTML = '<option value="">Pilih Donghua...</option>';
    spoilerFilmSelect.innerHTML = '<option value="">Pilih Donghua...</option>';
    episodeFilmFilter.innerHTML = '<option value="">Semua Donghua</option>';

    // Add film options
    films.forEach(film => {
      const option = document.createElement('option');
      option.value = film.id;
      option.textContent = film.title;
      
      episodeFilmSelect.appendChild(option.cloneNode(true));
      spoilerFilmSelect.appendChild(option.cloneNode(true));
      
      // For filter
      const filterOption = option.cloneNode(true);
      episodeFilmFilter.appendChild(filterOption);
    });

    console.log(`✅ Loaded ${films.length} films for select`);
  } catch (error) {
    console.error('Error loading films for select:', error);
    showNotification('Gagal memuat daftar donghua', 'error');
  }
}

// === FORM HANDLERS ===
async function handleFilmSubmit(e) {
  e.preventDefault();
  
  const submitBtn = filmForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  
  // Set loading state
  submitBtn.disabled = true;
  submitBtn.classList.add('loading');
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
  
  try {
    const formData = new FormData(filmForm);
    const filmId = formData.get('id');
    
    const filmData = {
      title: formData.get('title').trim(),
      description: formData.get('description')?.trim() || '',
      image_url: formData.get('image_url').trim(),
      video_url: formData.get('video_url').trim(),
      duration: formData.get('duration') ? parseInt(formData.get('duration')) : null,
      total_episodes: formData.get('total_episodes') ? parseInt(formData.get('total_episodes')) : 1,
      release_year: formData.get('release_year') ? parseInt(formData.get('release_year')) : null,
      genre: formData.get('genre') ? 
        formData.get('genre').split(',').map(g => g.trim()).filter(g => g !== '') : [],
      status: formData.get('status') || 'Ongoing'
    };

    // Validasi required fields
    if (!filmData.title || !filmData.image_url || !filmData.video_url) {
      throw new Error('Harap isi semua field yang wajib diisi!');
    }

    // Validasi URL
    if (!isValidUrl(filmData.image_url) || !isValidUrl(filmData.video_url)) {
      throw new Error('URL tidak valid. Pastikan menggunakan format https://');
    }

    let result;
    if (isEditingFilm && filmId) {
      // Update existing film
      const { data, error } = await supabase
        .from('film')
        .update(filmData)
        .eq('id', filmId)
        .select();

      if (error) throw error;
      result = data;
      showNotification('Donghua berhasil diperbarui!', 'success');
    } else {
      // Insert new film
      filmData.rating = 0.00;
      filmData.total_views = 0;

      const { data, error } = await supabase
        .from('film')
        .insert([filmData])
        .select();

      if (error) throw error;
      result = data;
      showNotification('Donghua berhasil ditambahkan!', 'success');
    }

    filmForm.reset();
    cancelFilmEdit();
    await loadFilmsForSelect();
    await loadFilms();
    
  } catch (error) {
    console.error('Error saving film:', error);
    showNotification(`Gagal menyimpan donghua: ${error.message}`, 'error');
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
    submitBtn.innerHTML = originalText;
  }
}

async function handleEpisodeSubmit(e) {
  e.preventDefault();
  
  const submitBtn = episodeForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  
  // Set loading state
  submitBtn.disabled = true;
  submitBtn.classList.add('loading');
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
  
  try {
    const formData = new FormData(episodeForm);
    const episodeId = formData.get('id');
    
    const episodeData = {
      film_id: parseInt(formData.get('film_id')),
      episode_number: parseInt(formData.get('episode_number')),
      title: formData.get('title').trim(),
      video_url: formData.get('video_url').trim(),
      duration: formData.get('duration') ? parseInt(formData.get('duration')) : null,
      is_free: formData.get('is_free') === 'on'
    };

    // Validasi required fields
    if (!episodeData.film_id || !episodeData.episode_number || !episodeData.title || !episodeData.video_url) {
      throw new Error('Harap isi semua field yang wajib diisi!');
    }

    // Validasi URL
    if (!isValidUrl(episodeData.video_url)) {
      throw new Error('URL video tidak valid. Pastikan menggunakan format https://');
    }

    let result;
    if (isEditingEpisode && episodeId) {
      // Update existing episode
      const { data, error } = await supabase
        .from('episode')
        .update(episodeData)
        .eq('id', episodeId)
        .select();

      if (error) throw error;
      result = data;
      showNotification('Episode berhasil diperbarui!', 'success');
    } else {
      // Insert new episode
      episodeData.views = 0;

      const { data, error } = await supabase
        .from('episode')
        .insert([episodeData])
        .select();

      if (error) throw error;
      result = data;
      showNotification('Episode berhasil ditambahkan!', 'success');
    }

    episodeForm.reset();
    cancelEpisodeEdit();
    await loadEpisodes();
    
  } catch (error) {
    console.error('Error saving episode:', error);
    showNotification(`Gagal menyimpan episode: ${error.message}`, 'error');
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
    submitBtn.innerHTML = originalText;
  }
}

async function handleSpoilerSubmit(e) {
  e.preventDefault();
  
  const submitBtn = spoilerForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  
  // Set loading state
  submitBtn.disabled = true;
  submitBtn.classList.add('loading');
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
  
  try {
    const formData = new FormData(spoilerForm);
    const spoilerId = formData.get('id');
    
    const spoilerData = {
      film_id: parseInt(formData.get('film_id')),
      title: formData.get('title').trim(),
      description: formData.get('description')?.trim() || '',
      video_url: formData.get('video_url').trim(),
      duration: formData.get('duration') ? parseInt(formData.get('duration')) : null
    };

    // Validasi required fields
    if (!spoilerData.film_id || !spoilerData.title || !spoilerData.video_url) {
      throw new Error('Harap isi semua field yang wajib diisi!');
    }

    // Validasi URL
    if (!isValidUrl(spoilerData.video_url)) {
      throw new Error('URL video tidak valid. Pastikan menggunakan format https://');
    }

    let result;
    if (isEditingSpoiler && spoilerId) {
      // Update existing spoiler
      const { data, error } = await supabase
        .from('spoiler')
        .update(spoilerData)
        .eq('id', spoilerId)
        .select();

      if (error) throw error;
      result = data;
      showNotification('Spoiler berhasil diperbarui!', 'success');
    } else {
      // Insert new spoiler
      spoilerData.views = 0;
      spoilerData.likes = 0;
      spoilerData.comments = 0;

      const { data, error } = await supabase
        .from('spoiler')
        .insert([spoilerData])
        .select();

      if (error) throw error;
      result = data;
      showNotification('Spoiler berhasil ditambahkan!', 'success');
    }

    spoilerForm.reset();
    cancelSpoilerEdit();
    await loadSpoilers();
    
  } catch (error) {
    console.error('Error saving spoiler:', error);
    showNotification(`Gagal menyimpan spoiler: ${error.message}`, 'error');
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
    submitBtn.innerHTML = originalText;
  }
}

// === EDIT FUNCTIONS ===
function editFilm(film) {
  isEditingFilm = true;
  
  // Fill form with film data
  document.getElementById('filmId').value = film.id;
  document.getElementById('filmTitle').value = film.title;
  document.getElementById('filmDescription').value = film.description || '';
  document.getElementById('filmImageUrl').value = film.image_url;
  document.getElementById('filmVideoUrl').value = film.video_url;
  document.getElementById('filmDuration').value = film.duration || '';
  document.getElementById('filmTotalEpisodes').value = film.total_episodes || 1;
  document.getElementById('filmReleaseYear').value = film.release_year || '';
  document.getElementById('filmGenre').value = Array.isArray(film.genre) ? film.genre.join(', ') : film.genre || '';
  document.getElementById('filmStatus').value = film.status || 'Ongoing';
  
  // Update UI for edit mode
  filmFormTitle.textContent = 'Edit Donghua';
  filmSubmitBtn.innerHTML = '<i class="fas fa-save"></i> Update Donghua';
  filmCancelBtn.style.display = 'inline-flex';
  
  // Switch to film tab
  switchTab('film');
}

function editEpisode(episode) {
  isEditingEpisode = true;
  
  // Fill form with episode data
  document.getElementById('episodeId').value = episode.id;
  document.getElementById('episodeFilm').value = episode.film_id;
  document.getElementById('episodeNumber').value = episode.episode_number;
  document.getElementById('episodeTitle').value = episode.title;
  document.getElementById('episodeVideoUrl').value = episode.video_url;
  document.getElementById('episodeDuration').value = episode.duration || '';
  document.getElementById('episodeIsFree').checked = episode.is_free;
  
  // Update UI for edit mode
  episodeFormTitle.textContent = 'Edit Episode';
  episodeSubmitBtn.innerHTML = '<i class="fas fa-save"></i> Update Episode';
  episodeCancelBtn.style.display = 'inline-flex';
  
  // Switch to episode tab
  switchTab('episode');
}

function editSpoiler(spoiler) {
  isEditingSpoiler = true;
  
  // Fill form with spoiler data
  document.getElementById('spoilerId').value = spoiler.id;
  document.getElementById('spoilerFilm').value = spoiler.film_id;
  document.getElementById('spoilerTitle').value = spoiler.title;
  document.getElementById('spoilerDescription').value = spoiler.description || '';
  document.getElementById('spoilerVideoUrl').value = spoiler.video_url;
  document.getElementById('spoilerDuration').value = spoiler.duration || '';
  
  // Update UI for edit mode
  spoilerFormTitle.textContent = 'Edit Spoiler';
  spoilerSubmitBtn.innerHTML = '<i class="fas fa-save"></i> Update Spoiler';
  spoilerCancelBtn.style.display = 'inline-flex';
  
  // Switch to spoiler tab
  switchTab('spoiler');
}

// === CANCEL EDIT FUNCTIONS ===
function cancelFilmEdit() {
  isEditingFilm = false;
  filmForm.reset();
  filmFormTitle.textContent = 'Tambah Donghua Baru';
  filmSubmitBtn.innerHTML = '<i class="fas fa-plus"></i> Tambah Donghua';
  filmCancelBtn.style.display = 'none';
}

function cancelEpisodeEdit() {
  isEditingEpisode = false;
  episodeForm.reset();
  episodeFormTitle.textContent = 'Tambah Episode Baru';
  episodeSubmitBtn.innerHTML = '<i class="fas fa-plus"></i> Tambah Episode';
  episodeCancelBtn.style.display = 'none';
}

function cancelSpoilerEdit() {
  isEditingSpoiler = false;
  spoilerForm.reset();
  spoilerFormTitle.textContent = 'Tambah Spoiler/Preview';
  spoilerSubmitBtn.innerHTML = '<i class="fas fa-plus"></i> Tambah Spoiler';
  spoilerCancelBtn.style.display = 'none';
}

// === LOAD MANAGEMENT CONTENT ===
async function loadAllContent() {
  await loadFilms();
  await loadEpisodes();
  await loadSpoilers();
}

async function loadFilms() {
  filmsList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Memuat donghua...</p></div>';

  try {
    const { data: films, error } = await supabase
      .from('film')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (films.length === 0) {
      filmsList.innerHTML = '<div class="empty-state"><i class="fas fa-film"></i><h4>Belum ada donghua</h4><p>Tambah donghua pertama Anda</p></div>';
      return;
    }

    filmsList.innerHTML = '';
    films.forEach(film => {
      const filmElement = createFilmItem(film);
      filmsList.appendChild(filmElement);
    });

    console.log(`✅ Loaded ${films.length} films`);
  } catch (error) {
    console.error('Error loading films:', error);
    filmsList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal memuat donghua</p></div>';
  }
}

async function loadEpisodes() {
  episodesList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Memuat episode...</p></div>';

  try {
    const { data: episodes, error } = await supabase
      .from('episode')
      .select(`
        *,
        film:film_id (
          title
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Simpan semua episode untuk pencarian
    allEpisodes = episodes;

    if (episodes.length === 0) {
      episodesList.innerHTML = '<div class="empty-state"><i class="fas fa-play-circle"></i><h4>Belum ada episode</h4><p>Tambah episode pertama Anda</p></div>';
      return;
    }

    // Tampilkan semua episode secara default
    displayEpisodes(episodes);

    console.log(`✅ Loaded ${episodes.length} episodes`);
  } catch (error) {
    console.error('Error loading episodes:', error);
    episodesList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal memuat episode</p></div>';
  }
}

async function loadSpoilers() {
  spoilersList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Memuat spoiler...</p></div>';

  try {
    const { data: spoilers, error } = await supabase
      .from('spoiler')
      .select(`
        *,
        film:film_id (
          title
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (spoilers.length === 0) {
      spoilersList.innerHTML = '<div class="empty-state"><i class="fas fa-eye"></i><h4>Belum ada spoiler</h4><p>Tambah spoiler pertama Anda</p></div>';
      return;
    }

    spoilersList.innerHTML = '';
    spoilers.forEach(spoiler => {
      const spoilerElement = createSpoilerItem(spoiler);
      spoilersList.appendChild(spoilerElement);
    });

    console.log(`✅ Loaded ${spoilers.length} spoilers`);
  } catch (error) {
    console.error('Error loading spoilers:', error);
    spoilersList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal memuat spoiler</p></div>';
  }
}

// === FILTER AND SEARCH FUNCTIONS ===
function filterAndSearchEpisodes() {
  if (allEpisodes.length === 0) {
    return;
  }

  let filteredEpisodes = [...allEpisodes];
  const searchTerm = episodeSearchInput.value.toLowerCase().trim();

  // Filter berdasarkan donghua
  if (selectedFilmId) {
    filteredEpisodes = filteredEpisodes.filter(episode => 
      episode.film_id == selectedFilmId
    );
  }

  // Filter berdasarkan pencarian
  if (searchTerm) {
    filteredEpisodes = filteredEpisodes.filter(episode => 
      episode.title.toLowerCase().includes(searchTerm) ||
      episode.film.title.toLowerCase().includes(searchTerm) ||
      episode.episode_number.toString().includes(searchTerm)
    );
  }

  // Tampilkan hasil filter
  displayEpisodes(filteredEpisodes);
}

function displayEpisodes(episodes) {
  episodesList.innerHTML = '';

  if (episodes.length === 0) {
    episodesList.innerHTML = '<div class="empty-state"><i class="fas fa-play-circle"></i><h4>Tidak ada episode</h4><p>Tidak ditemukan episode yang sesuai dengan filter</p></div>';
    return;
  }

  episodes.forEach(episode => {
    const episodeElement = createEpisodeItem(episode);
    episodesList.appendChild(episodeElement);
  });
}

// === CREATE CONTENT ITEMS ===
function createFilmItem(film) {
  const div = document.createElement('div');
  div.className = 'content-item';
  div.innerHTML = `
    <div class="content-item-header">
      <div>
        <div class="content-item-title">${film.title}</div>
        <div class="content-item-meta">
          <span>⭐ ${film.rating || '0.0'}</span>
          <span>👁️ ${film.total_views || 0} views</span>
          <span>🎬 ${film.total_episodes || 0} episodes</span>
          <span>📅 ${film.release_year || '-'}</span>
          <span>${film.status}</span>
        </div>
      </div>
      <div class="content-item-actions">
        <button class="btn-warning" onclick="editFilm(${JSON.stringify(film).replace(/"/g, '&quot;')})">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn-danger" onclick="deleteFilm(${film.id})">
          <i class="fas fa-trash"></i> Hapus
        </button>
      </div>
    </div>
    ${film.description ? `<div class="content-item-description">${film.description}</div>` : ''}
    <div class="content-item-meta">
      <span><strong>Thumbnail:</strong> ${film.image_url ? '✅' : '❌'}</span>
      <span><strong>Trailer:</strong> ${film.video_url ? '✅' : '❌'}</span>
      ${film.genre && film.genre.length > 0 ? `<span><strong>Genre:</strong> ${film.genre.join(', ')}</span>` : ''}
    </div>
  `;
  return div;
}

function createEpisodeItem(episode) {
  const div = document.createElement('div');
  div.className = 'content-item';
  div.innerHTML = `
    <div class="content-item-header">
      <div>
        <div class="content-item-title">${episode.film.title} - Episode ${episode.episode_number}</div>
        <div class="content-item-meta">
          <span>${episode.title}</span>
          <span>⏱️ ${episode.duration ? formatDuration(episode.duration) : '-'}</span>
          <span>👁️ ${episode.views || 0} views</span>
          <span>${episode.is_free ? '🆓 Gratis' : '🔒 Premium'}</span>
        </div>
      </div>
      <div class="content-item-actions">
        <button class="btn-warning" onclick="editEpisode(${JSON.stringify(episode).replace(/"/g, '&quot;')})">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn-danger" onclick="deleteEpisode(${episode.id})">
          <i class="fas fa-trash"></i> Hapus
        </button>
      </div>
    </div>
    <div class="content-item-meta">
      <span><strong>URL Video:</strong> ${episode.video_url ? '✅' : '❌'}</span>
    </div>
  `;
  return div;
}

function createSpoilerItem(spoiler) {
  const div = document.createElement('div');
  div.className = 'content-item';
  div.innerHTML = `
    <div class="content-item-header">
      <div>
        <div class="content-item-title">${spoiler.film.title} - ${spoiler.title}</div>
        <div class="content-item-meta">
          <span>⏱️ ${spoiler.duration ? formatDuration(spoiler.duration) : '-'}</span>
          <span>👁️ ${spoiler.views || 0} views</span>
          <span>❤️ ${spoiler.likes || 0} likes</span>
          <span>💬 ${spoiler.comments || 0} comments</span>
        </div>
      </div>
      <div class="content-item-actions">
        <button class="btn-warning" onclick="editSpoiler(${JSON.stringify(spoiler).replace(/"/g, '&quot;')})">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn-danger" onclick="deleteSpoiler(${spoiler.id})">
          <i class="fas fa-trash"></i> Hapus
        </button>
      </div>
    </div>
    ${spoiler.description ? `<div class="content-item-description">${spoiler.description}</div>` : ''}
    <div class="content-item-meta">
      <span><strong>URL Video:</strong> ${spoiler.video_url ? '✅' : '❌'}</span>
    </div>
  `;
  return div;
}

// === DELETE FUNCTIONS ===
async function deleteFilm(filmId) {
  if (!confirm('Apakah Anda yakin ingin menghapus donghua ini? Episode dan spoiler terkait juga akan dihapus.')) {
    return;
  }

  try {
    const { error } = await supabase
      .from('film')
      .delete()
      .eq('id', filmId);

    if (error) throw error;

    showNotification('Donghua berhasil dihapus!', 'success');
    await loadFilms();
    await loadFilmsForSelect();
    await loadEpisodes();
  } catch (error) {
    console.error('Error deleting film:', error);
    showNotification(`Gagal menghapus donghua: ${error.message}`, 'error');
  }
}

async function deleteEpisode(episodeId) {
  if (!confirm('Apakah Anda yakin ingin menghapus episode ini?')) {
    return;
  }

  try {
    const { error } = await supabase
      .from('episode')
      .delete()
      .eq('id', episodeId);

    if (error) throw error;

    showNotification('Episode berhasil dihapus!', 'success');
    await loadEpisodes();
  } catch (error) {
    console.error('Error deleting episode:', error);
    showNotification(`Gagal menghapus episode: ${error.message}`, 'error');
  }
}

async function deleteSpoiler(spoilerId) {
  if (!confirm('Apakah Anda yakin ingin menghapus spoiler ini?')) {
    return;
  }

  try {
    const { error } = await supabase
      .from('spoiler')
      .delete()
      .eq('id', spoilerId);

    if (error) throw error;

    showNotification('Spoiler berhasil dihapus!', 'success');
    await loadSpoilers();
  } catch (error) {
    console.error('Error deleting spoiler:', error);
    showNotification(`Gagal menghapus spoiler: ${error.message}`, 'error');
  }
}

// === HELPER FUNCTIONS ===
function showNotification(message, type = 'success') {
  notification.textContent = message;
  notification.className = `notification ${type} show`;
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 5000);
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}