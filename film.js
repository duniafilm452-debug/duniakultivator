// === KONEKSI KE SUPABASE ===
const SUPABASE_URL = "https://sjdytaaatjndhgjfsxfc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqZHl0YWFhdGpuZGhnamZzeGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NzI2NDIsImV4cCI6MjA3NTE0ODY0Mn0.-EYx3sDrtfdJAweZO_V_gPHyD-Cqdg6YczuaXzl2J1E";
const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === ELEMEN DOM ===
const videoPlayer = document.getElementById('videoPlayer');
const videoSource = document.getElementById('videoSource');
const filmTitle = document.getElementById('filmTitle');
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

// Custom Controls
const playPauseBtn = document.getElementById('playPauseBtn');
const progressBar = document.getElementById('progressBar');
const currentTime = document.getElementById('currentTime');
const duration = document.getElementById('duration');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const volumeBtn = document.getElementById('volumeBtn');
const volumeBar = document.getElementById('volumeBar');

// Action Buttons
const likeBtn = document.getElementById('likeBtn');
const favoriteBtn = document.getElementById('favoriteBtn');
const shareBtn = document.getElementById('shareBtn');

// === VARIABEL GLOBAL ===
let currentFilmId = null;
let currentEpisodeId = null;
let currentFilmData = null;
let isPlaying = false;
let isLiked = false;
let isFavorited = false;

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

  // Handle episode parameter - jika "latest" maka mainkan episode terbaru
  if (episodeParam === 'latest') {
    await playLatestEpisode();
  } else if (episodeParam) {
    await playEpisode(episodeParam);
  }

  // Setup event listeners
  setupEventListeners();
  setupCustomControls();
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
    .order('episode_number', { ascending: true });

  if (error) {
    console.error('Error loading episodes:', error);
    return;
  }

  episodesList.innerHTML = '';

  if (episodes.length === 0) {
    episodesList.innerHTML = '<p class="no-episodes">Belum ada episode.</p>';
    return;
  }

  episodes.forEach(episode => {
    const episodeElement = document.createElement('div');
    episodeElement.className = 'episode-item';
    episodeElement.innerHTML = `
      <div class="episode-info">
        <span class="episode-number">Episode ${episode.episode_number}</span>
        <span class="episode-title">${episode.title}</span>
        <span class="episode-duration">${formatDuration(episode.duration)}</span>
      </div>
      <button class="play-episode-btn" data-episode-id="${episode.id}">
        <i class="fas fa-play"></i> Putar
      </button>
    `;
    episodesList.appendChild(episodeElement);
  });

  // Add event listeners to episode buttons
  document.querySelectorAll('.play-episode-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const episodeId = e.target.closest('.play-episode-btn').dataset.episodeId;
      await playEpisode(episodeId);
    });
  });
}

// === PLAY LATEST EPISODE (FUNGSI BARU) ===
async function playLatestEpisode() {
  const { data: latestEpisode, error } = await supabase
    .from('episode')
    .select('*')
    .eq('film_id', currentFilmId)
    .order('episode_number', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error loading latest episode:', error);
    // Fallback ke trailer jika tidak ada episode
    videoSource.src = currentFilmData.video_url;
    videoPlayer.load();
    return;
  }

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
  videoSource.src = episode.video_url;
  videoPlayer.load();
  videoPlayer.play();

  // Update episode views
  await supabase
    .from('episode')
    .update({ views: episode.views + 1 })
    .eq('id', episodeId);

  // Update watch history
  await updateWatchHistory(currentFilmId, episodeId);
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
          <img src="${film.image_url}" alt="${film.title}">
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

  if (comments.length === 0) {
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

// === SHARE HANDLER ===
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

// === CUSTOM VIDEO CONTROLS ===
function setupCustomControls() {
  // Play/Pause
  playPauseBtn.addEventListener('click', () => {
    if (videoPlayer.paused) {
      videoPlayer.play();
    } else {
      videoPlayer.pause();
    }
  });

  videoPlayer.addEventListener('play', () => {
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    isPlaying = true;
  });

  videoPlayer.addEventListener('pause', () => {
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    isPlaying = false;
  });

  // Progress Bar
  videoPlayer.addEventListener('timeupdate', () => {
    const progress = (videoPlayer.currentTime / videoPlayer.duration) * 100;
    progressBar.value = progress;
    currentTime.textContent = formatTime(videoPlayer.currentTime);
  });

  progressBar.addEventListener('input', () => {
    const time = (progressBar.value / 100) * videoPlayer.duration;
    videoPlayer.currentTime = time;
  });

  // Duration
  videoPlayer.addEventListener('loadedmetadata', () => {
    duration.textContent = formatTime(videoPlayer.duration);
  });

  // Volume
  volumeBar.addEventListener('input', () => {
    videoPlayer.volume = volumeBar.value;
    updateVolumeIcon();
  });

  volumeBtn.addEventListener('click', () => {
    videoPlayer.volume = videoPlayer.volume === 0 ? 1 : 0;
    volumeBar.value = videoPlayer.volume;
    updateVolumeIcon();
  });

  // Fullscreen
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      videoPlayer.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });
}

// === HELPER FUNCTIONS ===
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  return `${mins} min`;
}

function formatDate(dateString) {
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
  const icon = favoriteBtn.querySelector('i');
  if (isFavorited) {
    icon.className = 'fas fa-bookmark';
    favoriteBtn.style.color = '#ff6b6b';
  } else {
    icon.className = 'far fa-bookmark';
    favoriteBtn.style.color = '';
  }
}

function updateVolumeIcon() {
  const icon = volumeBtn.querySelector('i');
  if (videoPlayer.volume === 0) {
    icon.className = 'fas fa-volume-mute';
  } else if (videoPlayer.volume < 0.5) {
    icon.className = 'fas fa-volume-down';
  } else {
    icon.className = 'fas fa-volume-up';
  }
}

function setupEventListeners() {
  // Auto-save progress every 10 seconds
  setInterval(() => {
    if (currentFilmId && !videoPlayer.paused) {
      updateWatchHistory(currentFilmId, currentEpisodeId);
    }
  }, 10000);
}