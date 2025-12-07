// === KONEKSI KE SUPABASE ===
const SUPABASE_URL = "https://sjdytaaatjndhgjfsxfc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqZHl0YWFhdGpuZGhnamZzeGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NzI2NDIsImV4cCI6MjA3NTE0ODY0Mn0.-EYx3sDrtfdJAweZO_V_gPHyD-Cqdg6YczuaXzl2J1E";
const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Cloudflare R2 Configuration
const CLOUDFLARE_R2_BASE_URL = "https://pub-97e59aa214094a8abdf6ba4437f78b21.r2.dev";

// === ELEMEN DOM ===
const videoPlayer = document.getElementById('videoPlayer');
const videoSource = document.getElementById('videoSource');
const filmTitle = document.getElementById('filmTitle');
const episodeTitle = document.getElementById('episodeTitle');
const filmViews = document.getElementById('filmViews');
const filmRating = document.getElementById('filmRating');
const filmYear = document.getElementById('filmYear');
const filmStatus = document.getElementById('filmStatus');
const filmDescription = document.getElementById('filmDescription');
const episodesList = document.getElementById('episodesList');
const recommendationsContainer = document.getElementById('recommendationsContainer');
const commentsList = document.getElementById('commentsList');
const commentInput = document.getElementById('commentInput');
const submitComment = document.getElementById('submitComment');
const scrollIndicator = document.getElementById('episodesScrollIndicator');

// Action Buttons
const likeBtn = document.getElementById('likeBtn');
const favoriteBtn = document.getElementById('favoriteBtn');
const shareBtn = document.getElementById('shareBtn');

// === VARIABEL GLOBAL ===
let currentFilmId = null;
let currentEpisodeId = null;
let currentFilmData = null;
let currentEpisodeData = null;
let isPlaying = false;
let isLiked = false;
let isFavorited = false;
let allEpisodes = [];
const INITIAL_EPISODES_TO_SHOW = 3;

// === LOAD FILM DETAIL SAAT PAGE LOAD ===
document.addEventListener('DOMContentLoaded', async () => {
  // Ambil ID film dari URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  currentFilmId = urlParams.get('id');
  const episodeParam = urlParams.get('episode');

  if (!currentFilmId) {
    alert('Film tidak ditemukan!');
    window.location.href = 'index.html';
    return;
  }

  await loadFilmDetail(currentFilmId);
  await loadEpisodes(currentFilmId);
  await loadRecommendations();
  await loadComments(currentFilmId);

  // Setup autoplay dengan muted terlebih dahulu
  videoPlayer.autoplay = true;
  videoPlayer.muted = true;
  videoPlayer.playsinline = true;

  // Handle episode parameter
  if (episodeParam === 'latest') {
    await playLatestEpisode();
  } else if (episodeParam) {
    await playEpisode(episodeParam);
  } else {
    // Jika tidak ada parameter episode, mainkan episode terbaru
    await playLatestEpisode();
  }

  // Setup event listeners
  setupEventListeners();
});

// === LOAD DETAIL FILM ===
async function loadFilmDetail(filmId) {
  const { data: film, error } = await supabase
    .from('film')
    .select('*')
    .eq('id', filmId)
    .single();

  if (error) {
    console.error('Error loading film:', error);
    return;
  }

  currentFilmData = film;

  // Update UI dengan data film
  filmTitle.textContent = film.title;
  filmDescription.textContent = film.description;
  filmViews.textContent = `${film.total_views} views`;
  filmRating.textContent = `⭐ ${film.rating}`;
  filmYear.textContent = film.release_year;
  filmStatus.textContent = film.status;

  // Update watch history
  await updateWatchHistory(filmId);

  // Check like dan favorite status
  await checkUserInteraction();
}

// === LOAD EPISODES ===
async function loadEpisodes(filmId) {
  const { data: episodes, error } = await supabase
    .from('episode')
    .select('*')
    .eq('film_id', filmId)
    .order('episode_number', { ascending: false }); // Urut dari episode terbaru

  if (error) {
    console.error('Error loading episodes:', error);
    return;
  }

  allEpisodes = episodes;
  episodesList.innerHTML = '';

  if (!episodes || episodes.length === 0) {
    episodesList.innerHTML = '<p class="no-episodes">Belum ada episode.</p>';
    scrollIndicator.style.display = 'none';
    return;
  }

  // Tampilkan 3 episode pertama (terbaru)
  const episodesToShow = episodes.slice(0, INITIAL_EPISODES_TO_SHOW);
  
  episodesToShow.forEach(episode => {
    const episodeElement = createEpisodeElement(episode, false);
    episodesList.appendChild(episodeElement);
  });

  // Jika ada lebih dari 3 episode, tampilkan sisanya
  if (episodes.length > INITIAL_EPISODES_TO_SHOW) {
    const remainingEpisodes = episodes.slice(INITIAL_EPISODES_TO_SHOW);
    
    remainingEpisodes.forEach(episode => {
      const episodeElement = createEpisodeElement(episode, true);
      episodesList.appendChild(episodeElement);
    });

    // Tampilkan scroll indicator
    scrollIndicator.style.display = 'block';
  } else {
    scrollIndicator.style.display = 'none';
  }
}

// === CREATE EPISODE ELEMENT ===
function createEpisodeElement(episode, isHidden = false) {
  const episodeElement = document.createElement('div');
  episodeElement.className = `episode-item ${isHidden ? 'hidden-episode' : ''}`;
  episodeElement.dataset.episodeId = episode.id;
  
  if (isHidden) {
    episodeElement.style.display = 'none';
  }
  
  episodeElement.innerHTML = `
    <div class="episode-info">
      <span class="episode-number">Episode ${episode.episode_number}</span>
      <span class="episode-title-text">${episode.title}</span>
      <div class="episode-meta">
        <span class="episode-duration">${formatDuration(episode.duration)}</span>
        <span class="episode-release">${formatReleaseDate(episode.release_date)}</span>
      </div>
    </div>
  `;
  
  // Add click event untuk memutar episode
  episodeElement.addEventListener('click', async () => {
    await playEpisode(episode.id);
    updateActiveEpisode();
  });
  
  return episodeElement;
}

// === PLAY LATEST EPISODE ===
async function playLatestEpisode() {
  if (!allEpisodes || allEpisodes.length === 0) {
    // Fallback ke trailer jika tidak ada episode
    if (currentFilmData && currentFilmData.video_url) {
      videoSource.src = getCloudflareR2Url(currentFilmData.video_url);
      videoPlayer.load();
      episodeTitle.textContent = "Trailer";
      
      // Unmute dan play otomatis
      videoPlayer.muted = false;
      try {
        await videoPlayer.play();
        isPlaying = true;
      } catch (err) {
        console.log('Autoplay blocked:', err);
      }
    }
    return;
  }

  // Ambil episode terbaru (nomor tertinggi)
  const latestEpisode = allEpisodes[0];
  await playEpisode(latestEpisode.id);
}

// === PLAY EPISODE ===
async function playEpisode(episodeId) {
  const { data: episode, error } = await supabase
    .from('episode')
    .select('*')
    .eq('id', episodeId)
    .single();

  if (error) {
    console.error('Error loading episode:', error);
    return;
  }

  currentEpisodeId = episodeId;
  currentEpisodeData = episode;
  
  // Gunakan Cloudflare R2 URL
  const videoUrl = getCloudflareR2Url(episode.video_url);
  videoSource.src = videoUrl;
  videoPlayer.load();
  
  // Unmute dan play otomatis
  videoPlayer.muted = false;
  
  try {
    await videoPlayer.play();
    isPlaying = true;
  } catch (err) {
    console.log('Autoplay blocked:', err);
    // Fallback: user harus klik manual
  }
  
  // Update episode title
  episodeTitle.textContent = `Episode ${episode.episode_number}: ${episode.title}`;

  // Update episode views (best-effort, avoid blocking UI)
  supabase
    .from('episode')
    .update({ views: episode.views + 1 })
    .eq('id', episodeId)
    .then(() => {})
    .catch(e => console.error('Failed to update episode views', e));

  // Update film views
  if (currentFilmData) {
    supabase
      .from('film')
      .update({ total_views: currentFilmData.total_views + 1 })
      .eq('id', currentFilmId)
      .then(() => {})
      .catch(e => console.error('Failed to update film views', e));
  }

  // Reload film data for UI consistency (non-blocking)
  loadFilmDetail(currentFilmId).catch(()=>{});

  // Update watch history
  updateWatchHistory(currentFilmId, episodeId).catch(()=>{});

  // Update active episode
  updateActiveEpisode();
}

// === UPDATE ACTIVE EPISODE ===
function updateActiveEpisode() {
  // Hapus class active dari semua episode
  document.querySelectorAll('.episode-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Tambah class active ke episode yang sedang diputar
  const activeEpisode = document.querySelector(`.episode-item[data-episode-id="${currentEpisodeId}"]`);
  if (activeEpisode) {
    activeEpisode.classList.add('active');
    
    // Tampilkan semua episode jika tersembunyi
    if (activeEpisode.style.display === 'none') {
      document.querySelectorAll('.episode-item').forEach(item => {
        item.style.display = 'flex';
      });
    }
    
    // Scroll ke episode yang aktif
    activeEpisode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// === CLOUDFLARE R2 URL HELPER ===
function getCloudflareR2Url(filePath) {
  // Jika sudah full URL, return langsung
  if (!filePath) return '';
  if (filePath.startsWith('http')) {
    return filePath;
  }
  
  const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
  return `${CLOUDFLARE_R2_BASE_URL}/${cleanPath}`;
}

// === LOAD RECOMMENDATIONS ===
async function loadRecommendations() {
  const { data: recommendations, error } = await supabase
    .from('film')
    .select('*')
    .neq('id', currentFilmId)
    .order('rating', { ascending: false })
    .limit(6);

  if (error) {
    console.error('Error loading recommendations:', error);
    return;
  }

  recommendationsContainer.innerHTML = '';

  recommendations.forEach(film => {
    const card = document.createElement('div');
    card.className = 'film-card';
    card.innerHTML = `
      <a href="film.html?id=${film.id}">
        <div class="thumbnail-container">
          <img src="${getCloudflareR2Url(film.image_url)}" alt="${film.title}">
        </div>
        <h4>${film.title}</h4>
        <div class="film-meta">
          <span>⭐ ${film.rating}</span>
          <span>${film.release_year}</span>
        </div>
      </a>
    `;
    recommendationsContainer.appendChild(card);
  });
}

// === LOAD COMMENTS ===
async function loadComments(filmId) {
  const { data: comments, error } = await supabase
    .from('reviews')
    .select(`
      *,
      user_profiles:user_id (
        username,
        avatar_url
      )
    `)
    .eq('film_id', filmId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading comments:', error);
    return;
  }

  commentsList.innerHTML = '';

  if (!comments || comments.length === 0) {
    commentsList.innerHTML = '<p class="no-comments">Belum ada komentar. Jadilah yang pertama berkomentar!</p>';
    return;
  }

  comments.forEach(comment => {
    const commentElement = document.createElement('div');
    commentElement.className = 'comment-item';
    commentElement.innerHTML = `
      <div class="comment-header">
        <div class="user-info">
          <img src="${comment.user_profiles?.avatar_url || 'https://via.placeholder.com/40'}" 
               alt="${comment.user_profiles?.username || 'User'}" class="user-avatar">
          <span class="username">${comment.user_profiles?.username || 'Anonymous'}</span>
        </div>
        <div class="comment-rating">
          ${generateStarRating(comment.rating)}
        </div>
      </div>
      <p class="comment-text">${comment.comment || ''}</p>
      <div class="comment-date">${formatDate(comment.created_at)}</div>
    `;
    commentsList.appendChild(commentElement);
  });
}

// === SUBMIT COMMENT ===
if (submitComment) {
  submitComment.addEventListener('click', async () => {
    const commentText = commentInput.value.trim();
    
    if (!commentText) {
      alert('Silakan tulis komentar terlebih dahulu!');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert('Silakan login terlebih dahulu untuk berkomentar!');
      return;
    }

    const { error } = await supabase
      .from('reviews')
      .insert({
        user_id: user.id,
        film_id: currentFilmId,
        rating: 5, // Default rating, bisa dikembangkan jadi input bintang
        comment: commentText
      });

    if (error) {
      console.error('Error submitting comment:', error);
      alert('Gagal mengirim komentar!');
      return;
    }

    // Clear input dan reload comments
    commentInput.value = '';
    await loadComments(currentFilmId);
    alert('Komentar berhasil dikirim!');
  });
}

// === CHECK USER INTERACTION (LIKE/FAVORITE) ===
async function checkUserInteraction() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return;

  // Check like status
  const { data: like } = await supabase
    .from('reviews')
    .select('id')
    .eq('user_id', user.id)
    .eq('film_id', currentFilmId)
    .single();

  isLiked = !!like;
  updateLikeButton();

  // Check favorite status
  const { data: favorite } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('film_id', currentFilmId)
    .single();

  isFavorited = !!favorite;
  updateFavoriteButton();
}

// === LIKE/FAVORITE HANDLERS ===
if (likeBtn) {
  likeBtn.addEventListener('click', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert('Silakan login terlebih dahulu!');
      return;
    }

    if (isLiked) {
      // Unlike
      await supabase
        .from('reviews')
        .delete()
        .eq('user_id', user.id)
        .eq('film_id', currentFilmId);
    } else {
      // Like
      await supabase
        .from('reviews')
        .insert({
          user_id: user.id,
          film_id: currentFilmId,
          rating: 5
        });
    }

    isLiked = !isLiked;
    updateLikeButton();
  });
}

if (favoriteBtn) {
  favoriteBtn.addEventListener('click', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert('Silakan login terlebih dahulu!');
      return;
    }

    if (isFavorited) {
      // Remove from favorites
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('film_id', currentFilmId);
    } else {
      // Add to favorites
      await supabase
        .from('favorites')
        .insert({
          user_id: user.id,
          film_id: currentFilmId
        });
    }

    isFavorited = !isFavorited;
    updateFavoriteButton();
  });
}

// === SHARE HANDLER ===
if (shareBtn) {
  shareBtn.addEventListener('click', () => {
    const shareUrl = window.location.href;
    const shareText = `Tonton "${currentFilmData?.title}" di Dunia Kultivator!`;
    
    if (navigator.share) {
      navigator.share({
        title: currentFilmData?.title,
        text: shareText,
        url: shareUrl
      });
    } else {
      // Fallback untuk browser yang tidak support Web Share API
      navigator.clipboard.writeText(shareUrl);
      alert('Link berhasil disalin ke clipboard!');
    }
  });
}

// === UPDATE WATCH HISTORY ===
async function updateWatchHistory(filmId, episodeId = null) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return;

  const watchData = {
    user_id: user.id,
    film_id: filmId,
    episode_id: episodeId,
    last_watch_time: videoPlayer.currentTime,
    total_duration: videoPlayer.duration
  };

  await supabase
    .from('watch_history')
    .upsert(watchData, { onConflict: 'user_id,film_id,episode_id' });
}

// === HELPER FUNCTIONS ===
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return 'N/A';
  const mins = Math.floor(seconds / 60);
  return `${mins} min`;
}

function formatReleaseDate(dateString) {
  if (!dateString) return 'TBA';
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 7) {
    if (diffDays === 0) return 'Hari ini';
    if (diffDays === 1) return 'Kemarin';
    return `${diffDays} hari lalu`;
  }
  
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short'
  });
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('id-ID');
}

function generateStarRating(rating) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += i <= rating ? '⭐' : '☆';
  }
  return stars;
}

function updateLikeButton() {
  if (!likeBtn) return;
  const icon = likeBtn.querySelector('i');
  if (isLiked) {
    icon.className = 'fas fa-thumbs-up';
    likeBtn.style.color = '#0090cc';
  } else {
    icon.className = 'far fa-thumbs-up';
    likeBtn.style.color = '';
  }
}

function updateFavoriteButton() {
  if (!favoriteBtn) return;
  const icon = favoriteBtn.querySelector('i');
  if (isFavorited) {
    icon.className = 'fas fa-bookmark';
    favoriteBtn.style.color = '#ff6b6b';
  } else {
    icon.className = 'far fa-bookmark';
    favoriteBtn.style.color = '';
  }
}

// === SETUP GENERAL EVENT LISTENERS ===
function setupEventListeners() {
  // Auto-save progress every 10 seconds
  setInterval(() => {
    if (currentFilmId && !videoPlayer.paused) {
      updateWatchHistory(currentFilmId, currentEpisodeId);
    }
  }, 10000);
  
  // Handle video play events
  videoPlayer.addEventListener('play', () => {
    isPlaying = true;
  });

  videoPlayer.addEventListener('pause', () => {
    isPlaying = false;
  });
  
  // Handle autoplay with user interaction
  document.addEventListener('click', () => {
    if (videoPlayer.paused && !isPlaying) {
      videoPlayer.play().catch(e => console.log('Play failed:', e));
    }
  });
  
  // Handle scroll for episodes hidden
  if (episodesList) {
    episodesList.addEventListener('scroll', () => {
      const scrollPosition = episodesList.scrollTop + episodesList.clientHeight;
      const scrollHeight = episodesList.scrollHeight;
      
      // If user scroll to bottom, show all episodes
      if (scrollPosition >= scrollHeight - 50) {
        document.querySelectorAll('.episode-item').forEach(item => {
          item.style.display = 'flex';
        });
        scrollIndicator.style.display = 'none';
      }
    });
  }
}