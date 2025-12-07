// === KONEKSI KE SUPABASE ===
const SUPABASE_URL = "https://sjdytaaatjndhgjfsxfc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqZHl0YWFhdGpuZGhnamZzeGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NzI2NDIsImV4cCI6MjA3NTE0ODY0Mn0.-EYx3sDrtfdJAweZO_V_gPHyD-Cqdg6YczuaXzl2J1E";
const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === ELEMEN DOM ===
const searchInput = document.querySelector("#searchInput");
const filmContainer = document.querySelector("#filmContainer");
const sectionTitle = document.querySelector("#sectionTitle");
const prevBtn = document.querySelector("#prevBtn");
const nextBtn = document.querySelector("#nextBtn");
const pageInfo = document.querySelector("#pageInfo");
const chatButton = document.querySelector("#chatButton");

// === VARIABEL PAGINATION ===
let currentPage = 1;
const itemsPerPage = 9; // 3 baris x 3 kolom = 9 item per halaman
let allFilms = [];
let filteredFilms = [];

// === LOAD FILM SAAT PERTAMA KALI ===
document.addEventListener("DOMContentLoaded", () => {
  // Default ke tab "terbaru" dan reset localStorage
  localStorage.setItem("activeTab", "terbaru");
  
  // Atur tombol aktif - default terbaru
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.target === "terbaru");
  });

  // Muat konten tab terbaru sebagai default
  muatFilmTerbaru();
});

// === FITUR: TAB NAV BUTTON (UNTUKMU & TERBARU) ===
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const target = btn.dataset.target;

    // Simpan tab terakhir ke localStorage
    localStorage.setItem("activeTab", target);

    // Reset ke halaman 1 saat ganti tab
    currentPage = 1;

    if (target === "terbaru") muatFilmTerbaru();
    if (target === "untukmu") muatUntukmu();
  });
});

// === AMBIL EPISODE TERBARU DARI SEMUA FILM ===
async function ambilEpisodeTerbaru() {
  // Ambil semua episode terbaru dari setiap film, diurutkan berdasarkan created_at terbaru
  const { data: episodes, error } = await supabase
    .from("episode")
    .select(`
      episode_number,
      video_url,
      created_at,
      film (
        id,
        title,
        image_url,
        latest_episode
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Gagal mengambil episode terbaru:", error);
    return [];
  }

  // Kelompokkan berdasarkan film_id untuk mendapatkan episode terbaru per film
  const filmMap = new Map();
  
  episodes.forEach(episode => {
    if (!episode.film) return;
    
    const filmId = episode.film.id;
    
    if (!filmMap.has(filmId)) {
      filmMap.set(filmId, {
        id: filmId,
        title: episode.film.title,
        image_url: episode.film.image_url,
        latest_episode: episode.film.latest_episode,
        latest_episode_number: episode.episode_number,
        latest_episode_url: episode.video_url,
        episode_created_at: episode.created_at
      });
    }
  });

  return Array.from(filmMap.values())
    .sort((a, b) => new Date(b.episode_created_at) - new Date(a.episode_created_at));
}

// === TAMPILKAN FILM DENGAN PAGINATION ===
function tampilkanFilm(daftarFilm) {
  filmContainer.innerHTML = "";

  if (daftarFilm.length === 0) {
    filmContainer.innerHTML = "<p style='color: gray; text-align: center; padding: 20px;'>Tidak ada donghua ditemukan.</p>";
    updatePagination(0);
    return;
  }

  // Hitung total halaman
  const totalPages = Math.ceil(daftarFilm.length / itemsPerPage);
  
  // Batasi halaman maksimum
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  // Potong data untuk halaman saat ini
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, daftarFilm.length);
  const filmsToShow = daftarFilm.slice(startIndex, endIndex);

  filmsToShow.forEach(film => {
    const card = document.createElement("div");
    card.classList.add("film-card");

    // Format episode dengan menambahkan "EP" di depan angka episode terbaru
    const episodeText = film.latest_episode_number ? `EP ${film.latest_episode_number}` : 'EP 1';
    
    // Link langsung ke episode terbaru
    const episodeLink = film.latest_episode_url ? 
      `film.html?id=${film.id}&episode=latest` : 
      `film.html?id=${film.id}`;
    
    card.innerHTML = `
      <a href="${episodeLink}">
        <div class="thumbnail-container">
          <img src="${film.image_url}" alt="${film.title}" onerror="this.src='https://via.placeholder.com/300x400/333/fff?text=No+Image'">
          <div class="episode-badge">${episodeText}</div>
        </div>
        <h4>${film.title}</h4>
      </a>
    `;

    filmContainer.appendChild(card);
  });

  updatePagination(daftarFilm.length);
}

// === UPDATE PAGINATION ===
function updatePagination(totalItems) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages}`;
  
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

// === FITUR: FILM TERBARU (EPISODE TERBARU) ===
async function muatFilmTerbaru() {
  sectionTitle.textContent = "Episode Terbaru";
  allFilms = await ambilEpisodeTerbaru();
  filteredFilms = [...allFilms];
  tampilkanFilm(allFilms);
}

// === FITUR: UNTUKMU (Acak berbeda setiap refresh) ===
async function muatUntukmu() {
  sectionTitle.textContent = "Untukmu";
  const data = await ambilEpisodeTerbaru();

  // Acak urutan film agar setiap refresh berbeda
  const acak = data
    .map(f => ({ f, sort: Math.random() })) // kasih nilai acak
    .sort((a, b) => a.sort - b.sort)        // urutkan secara random
    .map(({ f }) => f)
    .slice(0, 99); // batasi maksimal 99 thumbnail

  allFilms = acak;
  filteredFilms = [...acak];
  tampilkanFilm(acak);
}

// === FITUR: PENCARIAN ===
searchInput.addEventListener("input", async (e) => {
  const keyword = e.target.value.toLowerCase();
  currentPage = 1; // Reset ke halaman 1 saat pencarian
  
  if (keyword === "") {
    // Kembali ke tab aktif sebelumnya
    const activeTab = localStorage.getItem("activeTab") || "terbaru";
    if (activeTab === "terbaru") {
      sectionTitle.textContent = "Episode Terbaru";
      filteredFilms = [...allFilms];
      tampilkanFilm(allFilms);
    } else {
      sectionTitle.textContent = "Untukmu";
      tampilkanFilm(filteredFilms);
    }
    return;
  }

  sectionTitle.textContent = `Hasil untuk "${keyword}"`;

  // Pencarian dengan mengambil data episode terbaru juga
  const { data: films, error } = await supabase
    .from("film")
    .select(`
      *,
      episode (
        episode_number,
        created_at,
        video_url
      )
    `)
    .ilike("title", `%${keyword}%`);

  if (error) {
    console.error(error);
    return;
  }

  // Untuk setiap film hasil pencarian, cari episode terbaru
  const filmsWithLatestEpisode = await Promise.all(
    films.map(async (film) => {
      const { data: latestEpisode, error: episodeError } = await supabase
        .from("episode")
        .select("episode_number, video_url")
        .eq("film_id", film.id)
        .order("episode_number", { ascending: false })
        .limit(1)
        .single();

      if (!episodeError && latestEpisode) {
        return {
          ...film,
          latest_episode_number: latestEpisode.episode_number,
          latest_episode_url: latestEpisode.video_url
        };
      }

      return {
        ...film,
        latest_episode_number: film.latest_episode || 1,
        latest_episode_url: film.video_url
      };
    })
  );

  filteredFilms = filmsWithLatestEpisode;
  tampilkanFilm(filmsWithLatestEpisode);
});

// === PAGINATION HANDLER ===
prevBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    tampilkanFilm(filteredFilms);
  }
});

nextBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(filteredFilms.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    tampilkanFilm(filteredFilms);
  }
});

// === CHAT BUTTON HANDLER ===
if (chatButton) {
  chatButton.addEventListener("click", () => {
    window.location.href = "chat.html";
  });
}