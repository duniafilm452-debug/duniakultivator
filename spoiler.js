// === KONEKSI KE SUPABASE ===
const SUPABASE_URL = "https://sjdytaaatjndhgjfsxfc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqZHl0YWFhdGpuZGhnamZzeGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NzI2NDIsImV4cCI6MjA3NTE0ODY0Mn0.-EYx3sDrtfdJAweZO_V_gPHyD-Cqdg6YczuaXzl2J1E";
const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === ELEMEN DOM ===
const spoilerFeed = document.getElementById('spoilerFeed');
const loadingIndicator = document.getElementById('loadingIndicator');

// === VARIABEL GLOBAL ===
let spoilerVideos = [];
let currentPlayingIndex = 0;
let isScrolling = false;
let observer;
let scrollTimeout;
let isUserInteracted = false;

// === LOAD SPOILER VIDEOS ===
document.addEventListener('DOMContentLoaded', async () => {
  document.addEventListener('click', handleFirstUserInteraction, { once: true });
  document.addEventListener('touchstart', handleFirstUserInteraction, { once: true });
  
  await loadSpoilerVideos();
  setupScrollHandler();
});

function handleFirstUserInteraction() {
  isUserInteracted = true;
  const currentVideo = document.querySelector(`.spoiler-item[data-index="${currentPlayingIndex}"] .spoiler-video`);
  if (currentVideo) {
    currentVideo.muted = false;
  }
}

async function loadSpoilerVideos() {
  try {
    loadingIndicator.style.display = 'block';
    document.body.classList.add('scroll-lock');

    const { data: spoilers, error } = await supabase
      .from('spoiler')
      .select(`
        *,
        film:film_id (
          title,
          image_url,
          description
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    spoilerVideos = spoilers || [];
    
    if (spoilerVideos.length === 0) {
      showEmptyState();
      return;
    }

    renderSpoilerVideos();
    setupIntersectionObserver();

  } catch (error) {
    console.error('Error loading spoiler videos:', error);
    showErrorState();
  } finally {
    loadingIndicator.style.display = 'none';
    document.body.classList.remove('scroll-lock');
  }
}

function showEmptyState() {
  spoilerFeed.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-video-slash"></i>
      <p>Belum ada spoiler video</p>
      <p class="subtext">Admin dapat menambahkan spoiler di panel admin</p>
    </div>
  `;
}

function showErrorState() {
  spoilerFeed.innerHTML = `
    <div class="error-state">
      <i class="fas fa-exclamation-triangle"></i>
      <p>Gagal memuat spoiler</p>
      <button onclick="loadSpoilerVideos()" class="retry-btn">
        <i class="fas fa-redo"></i> Coba Lagi
      </button>
    </div>
  `;
}

function renderSpoilerVideos() {
  spoilerFeed.innerHTML = '';

  spoilerVideos.forEach((spoiler, index) => {
    const spoilerItem = document.createElement('div');
    spoilerItem.className = 'spoiler-item';
    spoilerItem.dataset.index = index;

    spoilerItem.innerHTML = `
      <div class="video-container">
        <div class="video-wrapper">
          <video 
            class="spoiler-video" 
            loop 
            preload="auto"
            playsinline
            webkit-playsinline
            muted
          >
            <source src="${spoiler.video_url}" type="video/mp4">
            Browser Anda tidak mendukung video.
          </video>
          
          <div class="video-progress">
            <div class="progress-fill"></div>
          </div>

          <div class="play-pause-overlay visible">
            <i class="fas fa-play"></i>
          </div>

          <button class="volume-btn">
            <i class="fas fa-volume-mute"></i>
          </button>

          <div class="video-loading">
            <div class="spinner"></div>
          </div>

          <div class="video-overlay">
            <div class="video-info">
              <h3 class="film-title">${escapeHtml(spoiler.film?.title || 'Unknown Title')}</h3>
              <div class="episode-info">${escapeHtml(spoiler.title)}</div>
              <p class="spoiler-description">${escapeHtml(spoiler.description || spoiler.film?.description || 'Tidak ada deskripsi')}</p>
            </div>
          </div>
        </div>
      </div>
    `;

    spoilerFeed.appendChild(spoilerItem);
    setupVideoControls(spoilerItem, index);
  });
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setupVideoControls(spoilerItem, index) {
  const video = spoilerItem.querySelector('.spoiler-video');
  const playPauseOverlay = spoilerItem.querySelector('.play-pause-overlay');
  const progressFill = spoilerItem.querySelector('.progress-fill');
  const videoLoading = spoilerItem.querySelector('.video-loading');
  const volumeBtn = spoilerItem.querySelector('.volume-btn');

  video.addEventListener('loadstart', () => {
    videoLoading.style.display = 'flex';
  });

  video.addEventListener('loadeddata', () => {
    videoLoading.style.display = 'none';
    adjustVideoAspectRatio(video);
  });

  video.addEventListener('canplay', () => {
    videoLoading.style.display = 'none';
  });

  video.addEventListener('waiting', () => {
    videoLoading.style.display = 'flex';
  });

  video.addEventListener('playing', () => {
    videoLoading.style.display = 'none';
  });

  playPauseOverlay.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePlayPause(video, playPauseOverlay);
  });

  video.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePlayPause(video, playPauseOverlay);
  });

  volumeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleVolume(video, volumeBtn);
  });

  video.addEventListener('timeupdate', () => {
    if (video.duration) {
      const progress = (video.currentTime / video.duration) * 100;
      progressFill.style.width = `${progress}%`;
    }
  });

  video.addEventListener('ended', () => {
    progressFill.style.width = '0%';
    video.currentTime = 0;
    video.play().catch(e => console.log('Auto-restart prevented:', e));
  });

  video.addEventListener('loadedmetadata', () => {
    adjustVideoAspectRatio(video);
  });

  video.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
}

function toggleVolume(video, volumeBtn) {
  if (video.muted) {
    video.muted = false;
    volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    volumeBtn.classList.add('unmuted');
  } else {
    video.muted = true;
    volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
    volumeBtn.classList.remove('unmuted');
  }
}

function adjustVideoAspectRatio(video) {
  const container = video.closest('.video-container');
  if (!container || !video.videoWidth || !video.videoHeight) return;

  const videoAspectRatio = video.videoWidth / video.videoHeight;
  const containerAspectRatio = container.clientWidth / container.clientHeight;

  if (videoAspectRatio > containerAspectRatio) {
    video.style.width = '100%';
    video.style.height = 'auto';
  } else {
    video.style.width = 'auto';
    video.style.height = '100%';
  }
}

function setupIntersectionObserver() {
  if (observer) {
    observer.disconnect();
  }

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        const spoilerItem = entry.target;
        const index = parseInt(spoilerItem.dataset.index);
        const video = spoilerItem.querySelector('.spoiler-video');
        const playPauseOverlay = spoilerItem.querySelector('.play-pause-overlay');

        if (entry.isIntersecting && entry.intersectionRatio >= 0.8) {
          currentPlayingIndex = index;
          
          document.querySelectorAll('.spoiler-video').forEach((v, i) => {
            if (i !== index && !v.paused) {
              v.pause();
              const otherOverlay = document.querySelector(`.spoiler-item[data-index="${i}"] .play-pause-overlay`);
              if (otherOverlay) {
                otherOverlay.classList.add('visible');
                otherOverlay.querySelector('i').className = 'fas fa-play';
              }
            }
          });

          const playPromise = video.play();
          
          if (playPromise !== undefined) {
            playPromise.then(() => {
              playPauseOverlay.classList.remove('visible');
              if (isUserInteracted) {
                video.muted = false;
                const volumeBtn = spoilerItem.querySelector('.volume-btn');
                if (volumeBtn) {
                  volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
                  volumeBtn.classList.add('unmuted');
                }
              }
            }).catch(e => {
              console.log('Autoplay prevented:', e);
              playPauseOverlay.classList.add('visible');
            });
          }
        } else if (!entry.isIntersecting) {
          if (!video.paused) {
            video.pause();
            playPauseOverlay.classList.add('visible');
            playPauseOverlay.querySelector('i').className = 'fas fa-play';
          }
        }
      });
    },
    {
      threshold: [0, 0.8],
      root: spoilerFeed,
      rootMargin: '0px'
    }
  );

  document.querySelectorAll('.spoiler-item').forEach(item => {
    observer.observe(item);
  });
}

function setupScrollHandler() {
  let isScrolling;
  
  spoilerFeed.addEventListener('scroll', () => {
    window.clearTimeout(isScrolling);
    isScrolling = setTimeout(() => {
      handleScrollEnd();
    }, 150);
  }, { passive: true });
}

function handleScrollEnd() {
  const spoilerItems = document.querySelectorAll('.spoiler-item');
  let closestIndex = 0;
  let closestDistance = Infinity;

  spoilerItems.forEach((item, index) => {
    const rect = item.getBoundingClientRect();
    const distance = Math.abs(rect.top);
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  if (closestIndex !== currentPlayingIndex) {
    currentPlayingIndex = closestIndex;
  }
}

function togglePlayPause(video, overlay) {
  if (video.paused) {
    const playPromise = video.play();
    
    if (playPromise !== undefined) {
      playPromise.then(() => {
        overlay.classList.remove('visible');
        if (isUserInteracted) {
          video.muted = false;
          const volumeBtn = overlay.closest('.video-wrapper').querySelector('.volume-btn');
          if (volumeBtn) {
            volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            volumeBtn.classList.add('unmuted');
          }
        }
      }).catch(e => {
        console.log('Play failed:', e);
        overlay.classList.add('visible');
        overlay.querySelector('i').className = 'fas fa-play';
      });
    }
  } else {
    video.pause();
    overlay.classList.add('visible');
    overlay.querySelector('i').className = 'fas fa-play';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    const currentVideo = document.querySelector(`.spoiler-item[data-index="${currentPlayingIndex}"] .spoiler-video`);
    const currentOverlay = document.querySelector(`.spoiler-item[data-index="${currentPlayingIndex}"] .play-pause-overlay`);
    
    if (currentVideo) {
      togglePlayPause(currentVideo, currentOverlay);
    }
  }

  if (e.code === 'ArrowDown') {
    e.preventDefault();
    const nextIndex = Math.min(currentPlayingIndex + 1, spoilerVideos.length - 1);
    if (nextIndex !== currentPlayingIndex) {
      scrollToIndex(nextIndex);
    }
  }

  if (e.code === 'ArrowUp') {
    e.preventDefault();
    const prevIndex = Math.max(currentPlayingIndex - 1, 0);
    if (prevIndex !== currentPlayingIndex) {
      scrollToIndex(prevIndex);
    }
  }

  if (e.code === 'KeyM') {
    e.preventDefault();
    const currentVideo = document.querySelector(`.spoiler-item[data-index="${currentPlayingIndex}"] .spoiler-video`);
    const volumeBtn = document.querySelector(`.spoiler-item[data-index="${currentPlayingIndex}"] .volume-btn`);
    if (currentVideo && volumeBtn) {
      toggleVolume(currentVideo, volumeBtn);
    }
  }
});

function scrollToIndex(index) {
  const targetItem = document.querySelector(`.spoiler-item[data-index="${index}"]`);
  if (targetItem) {
    targetItem.scrollIntoView({ behavior: 'smooth' });
    currentPlayingIndex = index;
  }
}

let startY = 0;
let currentY = 0;

document.addEventListener('touchstart', (e) => {
  startY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  currentY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', (e) => {
  const diff = startY - currentY;
  const minSwipeDistance = 80;
  
  if (diff < -minSwipeDistance) {
    const nextIndex = Math.min(currentPlayingIndex + 1, spoilerVideos.length - 1);
    if (nextIndex !== currentPlayingIndex) {
      scrollToIndex(nextIndex);
    }
  } else if (diff > minSwipeDistance) {
    const prevIndex = Math.max(currentPlayingIndex - 1, 0);
    if (prevIndex !== currentPlayingIndex) {
      scrollToIndex(prevIndex);
    }
  }
}, { passive: true });

window.addEventListener('resize', () => {
  document.querySelectorAll('.spoiler-video').forEach(video => {
    adjustVideoAspectRatio(video);
  });
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    const currentVideo = document.querySelector(`.spoiler-item[data-index="${currentPlayingIndex}"] .spoiler-video`);
    const currentOverlay = document.querySelector(`.spoiler-item[data-index="${currentPlayingIndex}"] .play-pause-overlay`);
    
    if (currentVideo && !currentVideo.paused) {
      currentVideo.pause();
      if (currentOverlay) {
        currentOverlay.classList.add('visible');
        currentOverlay.querySelector('i').className = 'fas fa-play';
      }
    }
  }
});

window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
});

window.addEventListener('beforeunload', () => {
  if (observer) {
    observer.disconnect();
  }
  
  document.querySelectorAll('.spoiler-video').forEach(video => {
    video.pause();
    video.src = '';
    video.load();
  });
});